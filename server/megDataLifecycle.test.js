const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { InMemoryBackend, JsonBackend } = require('../meg-engine-v2/src/memory/memoryStore');
const { SQLiteStore } = require('../meg-engine-v2/src/persistence/sqlite');
const { createMegV2Bridge } = require('./megV2Bridge');
const { createApp } = require('./index');
const { deleteAccountInOrder } = require('../src/services/accountLifecycle');
const { ResponseCache } = require('../meg-engine-v2/src/cache/responseCache');
const accountWork = require('../src/services/accountWork');
const { requestPasswordRecovery } = require('../src/services/passwordRecovery');
const { createRequireFirebaseAuth } = require('./firebaseAuth');
const { buildAdminOptions } = require('./firebaseAdmin');
const logger = { info() {}, warn() {}, error() {} };

function seed(store, userId) {
  store.appendMessage({ userId, conversationId: `${userId}-chat`, role: 'user', content: 'private fixture' });
  store.addMemory({ userId, conversationId: `${userId}-chat`, layer: 'long_term', content: 'private memory' });
  store.addMemory({ userId, layer: 'long_term', content: 'unattached memory' });
  const request = { userId, conversationId: `${userId}-chat`, messageId: 'one', requestHash: 'hash' };
  store.beginRequest(request);
  store.completeRequest({ ...request, responseText: 'private reply', responseMeta: { traceId: `${userId}-trace` } });
  store.saveProviderMetric({ traceId: `${userId}-trace` });
}

for (const driver of ['memory', 'json', 'sqlite']) {
  test(`${driver}: deletion covers user, conversation, messages, memories, replay records and survives restart`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloom-delete-test-'));
    const create = () => driver === 'sqlite' ? new SQLiteStore({ filename: path.join(directory, 'meg.db') })
      : driver === 'json' ? new JsonBackend(path.join(directory, 'meg.json')) : new InMemoryBackend();
    let store = create();
    try {
      seed(store, 'alice'); seed(store, 'bob');
      store.saveProviderMetric({ userId: 'alice', conversationId: 'alice-chat', traceId: 'orphan-alice' });
      store.saveProviderMetric({ userId: 'bob', conversationId: 'bob-chat', traceId: 'orphan-bob' });
      const bob = store.exportUserData({ userId: 'bob' });
      store.deleteConversation({ userId: 'alice', conversationId: 'bob-chat' });
      assert.deepEqual(store.exportUserData({ userId: 'bob' }), bob);
      store.deleteConversation({ userId: 'alice', conversationId: 'alice-chat' });
      assert.equal(store.exportUserData({ userId: 'alice' }).requests.length, 0);
      store.deleteUserData({ userId: 'alice' });
      store.deleteUserData({ userId: 'alice' });
      store.deleteUserData({ userId: 'never-existed' });
      if (driver !== 'memory') { store.close(); store = create(); }
      assert.deepEqual(store.exportUserData({ userId: 'alice' }), { user: null, conversations: [], messages: [], memories: [], requests: [] });
      assert.deepEqual(store.exportUserData({ userId: 'bob' }), bob);
      if (driver === 'sqlite') {
        assert.equal(store.db.prepare('SELECT COUNT(*) AS total FROM provider_metrics WHERE user_id = ?').get('alice').total, 0);
        assert.equal(store.db.prepare('SELECT COUNT(*) AS total FROM provider_metrics WHERE user_id = ?').get('bob').total, 1);
      } else {
        assert.equal(store.providerMetrics.some((item) => item.userId === 'alice'), false);
        assert.equal(store.providerMetrics.some((item) => item.userId === 'bob'), true);
      }
    } finally { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
}

test('HTTP data operations require verified auth, ignore client UID, are idempotent, and fail safely', async () => {
  const store = new InMemoryBackend(); seed(store, 'alice'); seed(store, 'bob');
  const bridge = createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, logger } });
  const app = createApp({ megV2Bridge: bridge, allowedOrigins: [], logger, verifyIdToken: async (token) => {
    if (token !== 'alice-token') throw new Error('internal auth detail');
    return { uid: 'alice' };
  } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/meg/data`;
  try {
    for (const token of [null, 'invalid', 'dev-token']) {
      assert.equal((await fetch(url, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })).status, 401);
    }
    const headers = { Authorization: 'Bearer alice-token', 'Content-Type': 'application/json' };
    const exported = await (await fetch(url, { headers })).json();
    assert.equal(exported.messages.length, 1);
    assert.doesNotMatch(JSON.stringify(exported), /bob/);
    for (let i = 0; i < 2; i++) {
      const response = await fetch(url, { method: 'DELETE', headers, body: JSON.stringify({ uid: 'bob', userId: 'bob' }) });
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
    }
    assert.equal(store.exportUserData({ userId: 'bob' }).messages.length, 1);
    store.deleteUserData = () => { throw new Error('secret filesystem path'); };
    const failed = await fetch(url, { method: 'DELETE', headers });
    assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /secret|filesystem/);
  } finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }
});

test('deletion waits for in-flight Meg work and prevents late memory/replay recreation', async () => {
  let release;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const store = new InMemoryBackend();
  const bridge = createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, logger,
    providerManager: { status: () => ({}), async *stream(_request, state) { entered(); await gate; state.provider = 'fixture'; yield 'fixture reply'; } },
  } });
  const chat = bridge.chat({ uid: 'alice', body: { conversationId: 'chat', messageId: 'one', message: 'I prefer gentle reminders' } });
  await started;
  const deletion = bridge.deleteUserData({ uid: 'alice' });
  await assert.rejects(bridge.chat({ uid: 'alice', body: {} }), (error) => error.status === 409);
  release(); await Promise.allSettled([chat]); await deletion;
  await new Promise(setImmediate);
  assert.deepEqual(store.exportUserData({ userId: 'alice' }), { user: null, conversations: [], messages: [], memories: [], requests: [] });
});

test('educational response cache cannot share personalised replies across users or support modes', () => {
  const cache = new ResponseCache();
  const request = { userId: 'alice', conversationId: 'same', intent: 'simple_health', message: 'What is PCOS?' };
  cache.set(request, 'private contextual fixture');
  assert.equal(cache.get({ ...request, userId: 'bob' }), null);
  assert.equal(cache.get({ ...request, supportMode: 'doctor' }), null);
});

test('account deletion stops at each failure and clears local data only after Auth deletion', async () => {
  const names = ['reauthenticate', 'deleteMeg', 'deleteAppData', 'deleteAuth', 'clearLocal'];
  for (let failure = -1; failure < names.length; failure++) {
    const calls = [];
    const steps = Object.fromEntries(names.map((name, index) => [name, async () => {
      calls.push(name); if (index === failure) throw new Error('fixture failure');
    }]));
    if (failure < 0) await deleteAccountInOrder(steps);
    else await assert.rejects(deleteAccountInOrder(steps), (error) => error.stage === failure && error.accountDeleted === (failure === 4));
    assert.deepEqual(calls, names.slice(0, failure < 0 ? 5 : failure + 1));
  }
});

test('client deletion cancels pending token/network work without cancelling another account', () => {
  const alice = accountWork.request('client-alice');
  const bob = accountWork.request('client-bob');
  const oldEpoch = accountWork.epoch('client-alice');
  const resume = accountWork.pause('client-alice');
  assert.equal(alice.signal.aborted, true);
  assert.throws(alice.check);
  assert.throws(() => accountWork.request('client-alice'));
  assert.doesNotThrow(bob.check);
  resume();
  assert.equal(accountWork.isCurrent('client-alice', oldEpoch), false);
  const fresh = accountWork.request('client-alice');
  assert.doesNotThrow(fresh.check);
  alice.close(); bob.close(); fresh.close();
});

test('password recovery normalizes email and never reveals whether an account exists', async () => {
  let sent;
  const known = await requestPasswordRecovery('  Example@Email.test  ', async (email) => { sent = email; });
  assert.equal(sent, 'example@email.test');
  const unknown = await requestPasswordRecovery('missing@email.test', async () => { throw { code: 'auth/user-not-found' }; });
  assert.equal(known, unknown);
  await assert.rejects(requestPasswordRecovery('not-an-email', async () => assert.fail('Must not send')), (error) => error.field === 'email');
  await assert.rejects(requestPasswordRecovery('a@email.test', async () => { throw new Error('private provider internals'); }), (error) => !error.message.includes('internals'));
});

test('dev auth never bypasses verification in production, including whitespace and casing', async () => {
  const oldMode = process.env.NODE_ENV; const oldFlag = process.env.MEG_DEV_AUTH;
  try {
    process.env.MEG_DEV_AUTH = '1';
    for (const mode of ['production', ' Production ', 'PRODUCTION', '']) {
      process.env.NODE_ENV = mode;
      let status;
      const middleware = createRequireFirebaseAuth({ logger, verifyIdToken: async () => { throw new Error('invalid'); } });
      const response = { status(value) { status = value; return this; }, json() {} };
      await middleware({ get: () => 'Bearer dev-token' }, response, () => assert.fail('Bypass'));
      assert.equal(status, 401);
    }
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
    if (oldFlag === undefined) delete process.env.MEG_DEV_AUTH; else process.env.MEG_DEV_AUTH = oldFlag;
  }
});

test('production Firebase Admin rejects emulator credential bypass configuration', () => {
  for (const field of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    assert.throws(() => buildAdminOptions({ NODE_ENV: ' Production ', [field]: '127.0.0.1:9099' }), /must not be configured in production/);
  }
});

test('HTTP readiness is truthful and chat rate limits are UID scoped', async () => {
  let ready = false;
  const app = createApp({ logger, allowedOrigins: [], rateLimit: 1,
    verifyIdToken: async (uid) => ({ uid }),
    megV2Bridge: { health: () => ({ ready }), chat: async () => ({ message: 'fixture' }) },
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/health`)).status, 503);
    assert.equal((await fetch(`${base}/live`)).status, 200);
    ready = true; assert.equal((await fetch(`${base}/health`)).status, 200);
    const send = (uid) => fetch(`${base}/api/meg/chat`, { method: 'POST', headers: { Authorization: `Bearer ${uid}` } });
    assert.equal((await send('alice')).status, 200);
    assert.equal((await send('alice')).status, 429);
    assert.equal((await send('bob')).status, 200);
  } finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }
});
