const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

const compiled = new Map();

function loadDeletionServices({ records = {}, onRead, onCommit, onServerDelete } = {}) {
  const auth = { currentUser: { uid: 'alice' } };
  const calls = { reads: [], commits: [], deleted: [], server: [] };
  const reference = (parent, ...parts) => ({ path: [parent.path, ...parts].filter(Boolean).join('/') });
  const firestore = {
    collection: reference,
    doc: reference,
    async getDocs(ref) {
      calls.reads.push(ref.path);
      await onRead?.({ auth, ref, calls });
      return { docs: (records[ref.path] || []).map((id) => ({ ref: reference(ref, id) })) };
    },
    async deleteDoc(ref) { calls.deleted.push(ref.path); },
    writeBatch() {
      const pending = [];
      return {
        delete(ref) { pending.push(ref.path); },
        async commit() {
          calls.commits.push(pending);
          await onCommit?.({ auth, calls });
        },
      };
    },
  };
  function load(name) {
    const filename = path.resolve(__dirname, `../src/services/${name}.js`);
    if (!compiled.has(filename)) {
      compiled.set(filename, babel.transformFileSync(filename, {
        babelrc: false,
        configFile: false,
        presets: [['babel-preset-expo', { lazyImports: false }]],
      }).code);
    }
    const moduleValue = { exports: {} };
    const localRequire = (request) => {
      if (request === 'firebase/firestore') return firestore;
      if (request === './firebase') return { auth, db: {}, firebaseConfigurationError: null };
      if (request === './userData') return { stripUndefined: (value) => value };
      if (request === '../utils/dateKey') return { requireLocalDateKey: (value) => value };
      if (request === './megAccountData') return {
        async requestMegAccountData(options) {
          calls.server.push(options);
          await onServerDelete?.({ auth, calls });
          return { ok: true };
        },
      };
      return require(request);
    };
    new Function('require', 'module', 'exports', compiled.get(filename))(
      localRequire, moduleValue, moduleValue.exports
    );
    return moduleValue.exports;
  }
  return { auth, calls, tracking: load('userData'), meg: load('megData') };
}

test('account deletion rejects a switched or signed-out user before selecting private records', async () => {
  for (const currentUser of [{ uid: 'bob' }, null]) {
    const { auth, calls, tracking, meg } = loadDeletionServices();
    auth.currentUser = currentUser;
    await assert.rejects(tracking.deleteAllCurrentUserTrackingData('alice'));
    await assert.rejects(tracking.deleteCurrentUserProfileDocument('alice'));
    await assert.rejects(meg.deleteAllCurrentUserMegData({ expectedUid: 'alice' }));
    assert.deepEqual(calls, { reads: [], commits: [], deleted: [], server: [] });
  }
});

test('tracking deletion selects only the expected account and batches more than 450 records', async () => {
  const cycleIds = Array.from({ length: 451 }, (_, index) => `cycle-${index}`);
  const { calls, tracking } = loadDeletionServices({ records: {
    'users/alice/cycleLogs': cycleIds,
    'users/alice/checkIns': ['checkin'],
    'users/alice/strengthSessions': ['summary'],
    'users/bob/cycleLogs': ['private'],
  } });
  await tracking.deleteAllCurrentUserTrackingData('alice');
  await tracking.deleteCurrentUserProfileDocument('alice');
  assert.deepEqual(calls.reads, [
    'users/alice/cycleLogs', 'users/alice/checkIns', 'users/alice/strengthSessions',
  ]);
  assert.deepEqual(calls.commits.map((items) => items.length), [450, 3]);
  assert.ok(calls.commits.flat().every((location) => location.startsWith('users/alice/')));
  assert.deepEqual(calls.deleted, ['users/alice']);
});

test('tracking deletion stops if authentication changes while records are loading', async () => {
  const { calls, tracking } = loadDeletionServices({
    records: { 'users/alice/cycleLogs': ['cycle'] },
    onRead({ auth }) { auth.currentUser = { uid: 'bob' }; },
  });
  await assert.rejects(tracking.deleteAllCurrentUserTrackingData('alice'), /sign-in changed/);
  assert.deepEqual(calls.commits, []);
});

test('tracking deletion stops later batches after a mid-deletion sign-in change', async () => {
  const { calls, tracking } = loadDeletionServices({
    records: { 'users/alice/checkIns': Array.from({ length: 451 }, (_, index) => `record-${index}`) },
    onCommit({ auth }) { auth.currentUser = { uid: 'bob' }; },
  });
  await assert.rejects(tracking.deleteAllCurrentUserTrackingData('alice'), /sign-in changed/);
  assert.equal(calls.commits.length, 1);
  assert.equal(calls.commits[0].length, 450);
});

test('Meg deletion remains bound to the UID verified before the server request', async () => {
  for (const oneConversation of [false, true]) {
    const { calls, meg } = loadDeletionServices({
      onServerDelete({ auth }) { auth.currentUser = { uid: 'bob' }; },
    });
    await assert.rejects(oneConversation
      ? meg.deleteCurrentUserMegConversation('chat')
      : meg.deleteAllCurrentUserMegData({ expectedUid: 'alice' }), /sign-in changed/);
    assert.equal(calls.server[0].expectedUid, 'alice');
    assert.deepEqual(calls.reads, []);
    assert.deepEqual(calls.deleted, []);
  }
});

test('Meg account cleanup deletes nested messages before conversations without repeating server deletion', async () => {
  const { calls, meg } = loadDeletionServices({ records: {
    'users/alice/megConversations': ['chat'],
    'users/alice/megConversations/chat/messages': ['one', 'two'],
    'users/bob/megConversations': ['private'],
  } });
  await meg.deleteAllCurrentUserMegData({ expectedUid: 'alice', serverAlreadyDeleted: true });
  assert.deepEqual(calls.server, []);
  assert.deepEqual(calls.commits, [[
    'users/alice/megConversations/chat/messages/one',
    'users/alice/megConversations/chat/messages/two',
  ]]);
  assert.deepEqual(calls.deleted, ['users/alice/megConversations/chat']);
});

test('Meg cleanup stops before deleting a conversation after a mid-batch sign-in change', async () => {
  const { calls, meg } = loadDeletionServices({
    records: {
      'users/alice/megConversations': ['chat'],
      'users/alice/megConversations/chat/messages': ['one'],
    },
    onCommit({ auth }) { auth.currentUser = null; },
  });
  await assert.rejects(meg.deleteAllCurrentUserMegData({ expectedUid: 'alice', serverAlreadyDeleted: true }));
  assert.equal(calls.commits.length, 1);
  assert.deepEqual(calls.deleted, []);
});
