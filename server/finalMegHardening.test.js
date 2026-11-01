const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('./index');
const { createMegV2Bridge } = require('./megV2Bridge');
const { InMemoryBackend, JsonBackend } = require('../meg-engine-v2/src/memory/memoryStore');
const { SQLiteStore } = require('../meg-engine-v2/src/persistence/sqlite');
const logger = { info() {}, warn() {}, error() {} };

test('no cloud keys and disabled local fallback fail closed instead of counting default Ollama', () => {
  const bridge = createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store: new InMemoryBackend(), logger } });
  assert.equal(bridge.health().ready, false);
  assert.equal(bridge.health().providers.ollama.configured, false);
});

for (const driver of ['memory', 'sqlite']) {
  test(driver + ': history and feedback restore, remain UID scoped, and allow explicit rating removal', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloom-meg-final-'));
    const filename = path.join(directory, 'meg.db');
    let store = driver === 'sqlite' ? new SQLiteStore({ filename }) : new InMemoryBackend();
    const bridgeFor = () => createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, logger } });
    let bridge = bridgeFor();
    try {
      store.appendMessage({ userId: 'alice', conversationId: 'chat', role: 'user', content: 'Synthetic greeting', clientMessageId: 'client-id' });
      const answer = store.appendMessage({ userId: 'alice', conversationId: 'chat', role: 'assistant', content: 'Synthetic reply' });
      const rated = bridge.updateFeedback({ uid: 'alice', conversationId: 'chat', messageId: answer.id, feedback: 'helpful' });
      assert.equal(rated.ok, true);
      assert.throws(() => bridge.updateFeedback({ uid: 'bob', conversationId: 'chat', messageId: answer.id, feedback: 'not_helpful' }), error => error.status === 404);
      assert.throws(() => bridge.updateFeedback({ uid: 'alice', conversationId: 'chat', messageId: answer.id, feedback: 'arbitrary' }), error => error.status === 400);
      assert.deepEqual(bridge.listConversations({ uid: 'bob' }), { conversations: [] });
      if (driver === 'sqlite') { store.close(); store = new SQLiteStore({ filename }); bridge = bridgeFor(); }
      let history = bridge.listConversations({ uid: 'alice' }).conversations;
      assert.equal(history[0].messages[0].id, 'client-id');
      assert.equal(history[0].messages[1].feedback, 'helpful');
      assert.ok(history[0].messages[1].feedbackUpdatedAt);
      assert.doesNotMatch(JSON.stringify(history), /request_hash|memories|user_id/);
      bridge.updateFeedback({ uid: 'alice', conversationId: 'chat', messageId: answer.id, feedback: null });
      history = bridge.listConversations({ uid: 'alice' }).conversations;
      assert.equal(history[0].messages[1].feedback, null);
      await bridge.deleteUserData({ uid: 'bob' });
      assert.equal(history[0].messages.length, 2);
    } finally { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
}

test('history and feedback HTTP endpoints reject unverified users and client supplied ownership', async () => {
  const store = new InMemoryBackend();
  const answer = store.appendMessage({ userId: 'alice', conversationId: 'chat', role: 'assistant', content: 'Synthetic reply' });
  const bridge = createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, logger } });
  const app = createApp({ megV2Bridge: bridge, allowedOrigins: [], logger, verifyIdToken: async token => {
    if (!['alice', 'bob'].includes(token)) throw Error('invalid');
    return { uid: token };
  } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/meg/conversations')).status, 401);
    assert.equal((await fetch(base + '/api/meg/conversations', { headers: { Authorization: 'Bearer dev-token' } })).status, 401);
    const other = await fetch(base + '/api/meg/conversations?uid=alice', { headers: { Authorization: 'Bearer bob' } });
    assert.deepEqual(await other.json(), { conversations: [] });
    const patch = await fetch(base + '/api/meg/conversations/chat/messages/' + answer.id + '/feedback', {
      method: 'PATCH', headers: { Authorization: 'Bearer bob', 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 'alice', feedback: 'helpful' }),
    });
    assert.equal(patch.status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('synthetic provider response and retry survive SQLite restart without duplicate replies', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloom-replay-final-'));
  const filename = path.join(directory, 'meg.db');
  let calls = 0;
  const providerManager = { status: () => ({ synthetic: { configured: true, state: 'CLOSED' } }), async *stream(_request, state) { calls++; state.provider = 'synthetic'; yield 'A synthetic connection reply.'; } };
  let store = new SQLiteStore({ filename });
  const make = () => createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, providerManager, logger } });
  let bridge = make();
  const request = { uid: 'synthetic-user', body: { conversationId: 'synthetic-chat', messageId: 'synthetic-message', message: 'Hello' } };
  try {
    const first = await bridge.chat(request);
    store.close(); store = new SQLiteStore({ filename }); bridge = make();
    const replay = await bridge.chat(request);
    assert.equal(replay.messageId, first.messageId);
    assert.equal(replay.message, first.message);
    assert.equal(calls, 1);
    assert.equal(bridge.listConversations({ uid: 'synthetic-user' }).conversations[0].messages.length, 2);
  } finally { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Bloom memory opt-out suppresses backend retrieval, extraction and previously cached personalised replies', async () => {
  const store = new InMemoryBackend(); let reads = 0; let writes = 0; let calls = 0;
  store.listMemories = () => { reads++; return []; };
  store.addMemory = () => { writes++; };
  const providerManager = { status: () => ({}), async *stream() { calls++; yield 'A synthetic educational response.'; } };
  const bridge = createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, providerManager, logger } });
  const body = { conversationId: 'privacy-chat', messageId: 'off', message: 'What is PCOS?', memoryEnabled: false };
  await bridge.chat({ uid: 'synthetic-privacy', body });
  assert.equal(reads, 0); assert.equal(writes, 0);
  await bridge.chat({ uid: 'synthetic-privacy', body: { ...body, messageId: 'on', memoryEnabled: true } });
  assert.ok(reads > 0);
  assert.equal(calls, 2, 'cache must distinguish memory consent');
});

test('safety metadata survives SQLite history and idempotent replay after restart', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloom-safety-final-'));
  const filename = path.join(directory, 'meg.db'); let store = new SQLiteStore({ filename });
  const make = () => createMegV2Bridge({ environment: { NODE_ENV: 'test' }, engineOverrides: { store, logger } });
  let bridge = make(); const request = { uid: 'synthetic-crisis', body: { conversationId: 'crisis', messageId: 'crisis-1', message: 'I want to kill myself' } };
  try {
    const first = await bridge.chat(request); assert.equal(first.urgent, true); assert.ok(first.safety);
    // Simulate a completed request written by the older metadata implementation.
    const row = store.db.prepare('SELECT response_meta FROM request_dedup').get();
    store.db.prepare('UPDATE request_dedup SET response_meta = ?').run(JSON.stringify({ ...JSON.parse(row.response_meta), messageId: request.body.messageId }));
    store.close(); store = new SQLiteStore({ filename }); bridge = make();
    const replay = await bridge.chat(request);
    assert.equal(replay.messageId, first.messageId); assert.equal(replay.safety, first.safety); assert.equal(replay.urgent, true);
    const history = bridge.listConversations({ uid: request.uid }).conversations[0].messages;
    assert.equal(history.length, 2); assert.equal(history[1].urgent, true); assert.equal(history[1].safety, first.safety);
  } finally { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

for (const driver of ['memory', 'json', 'sqlite']) {
  test(driver + ': identical conversation IDs in different accounts keep independent metadata and history', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloom-collision-'));
    const filename = path.join(directory, driver === 'json' ? 'meg.json' : 'meg.db');
    const create = () => driver === 'memory' ? new InMemoryBackend() : driver === 'json' ? new JsonBackend(filename) : new SQLiteStore({ filename });
    let store = create();
    try {
      for (const userId of ['alice', 'bob']) store.appendMessage({ userId, conversationId: 'same-id', role: 'user', content: userId + ' synthetic message' });
      if (driver !== 'memory') { store.close(); store = create(); }
      const alice = store.exportUserData({ userId: 'alice' }); const bob = store.exportUserData({ userId: 'bob' });
      assert.equal(alice.conversations.length, 1); assert.equal(bob.conversations.length, 1);
      assert.equal(alice.messages[0].content, 'alice synthetic message');
      assert.equal(bob.messages[0].content, 'bob synthetic message');
      store.deleteConversation({ userId: 'alice', conversationId: 'same-id' });
      assert.deepEqual(store.exportUserData({ userId: 'bob' }), bob);
      assert.equal(store.exportUserData({ userId: 'alice' }).conversations.length, 0);
    } finally { store.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
}
