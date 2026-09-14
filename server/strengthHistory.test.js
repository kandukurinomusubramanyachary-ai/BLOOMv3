const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function memoryStorage() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

function loadStorage(backend) {
  const filename = path.resolve(__dirname, '../src/services/storage.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => {
    if (request === '@react-native-async-storage/async-storage') return backend;
    if (request === 'expo-secure-store') return { isAvailableAsync: async () => false };
    if (request === 'react-native') return { Platform: { OS: 'web' } };
    return require(request);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', transformed.code)(
    localRequire, moduleValue, moduleValue.exports, filename, path.dirname(filename)
  );
  return moduleValue.exports;
}

function summary(id, overrides = {}) {
  return {
    id, exerciseId: 'wall-pushup', name: 'Wall push-up', mode: 'reps',
    sets: 2, reps: 20, holdSec: 0, durationSec: 80,
    completedAt: '2026-09-11T08:00:00.000Z', sessionMode: 'guided', ...overrides,
  };
}

test('Strength device history persists across storage instances and replaces retries by ID', async () => {
  const backend = memoryStorage();
  const first = loadStorage(backend).storage.forUser('alice');
  assert.deepEqual(await first.getStrengthSessions(), []);
  await first.saveStrengthSession(summary('session-1'));
  await first.saveStrengthSession(summary('session-1', { reps: 18, completionState: 'stopped' }));
  const reopened = loadStorage(backend).storage.forUser('alice');
  assert.deepEqual(await reopened.getStrengthSessions(), [summary('session-1', { reps: 18, completionState: 'stopped' })]);
});

test('Strength history keeps the newest 500 records and retains concurrent saves', async () => {
  const backend = memoryStorage();
  const { storage, KEYS } = loadStorage(backend);
  const alice = storage.forUser('alice');
  const older = Array.from({ length: 500 }, (_, i) => summary(`old-${i}`));
  await alice.setItem(KEYS.STRENGTH_SESSIONS, older);
  await Promise.all([
    alice.saveStrengthSession(summary('new-1')),
    storage.forUser('alice').saveStrengthSession(summary('new-2')),
  ]);
  const history = await alice.getStrengthSessions();
  assert.equal(history.length, 500);
  assert.deepEqual(history.slice(0, 2).map((item) => item.id), ['new-2', 'new-1']);
  assert.equal(history.some((item) => item.id === 'old-499'), false);
});

test('Strength save captures its account before async work and never writes into a switched account', async () => {
  const backend = memoryStorage();
  const { storage } = loadStorage(backend);
  storage.setUserScope('alice');
  const savingAlice = storage.saveStrengthSession(summary('alice-1'));
  storage.setUserScope('bob');
  await storage.saveStrengthSession(summary('bob-1'));
  await savingAlice;
  assert.deepEqual((await storage.getStrengthSessions()).map((item) => item.id), ['bob-1']);
  assert.deepEqual((await storage.forUser('alice').getStrengthSessions()).map((item) => item.id), ['alice-1']);
});

test('Strength history participates in export and captured-account deletion', async () => {
  const backend = memoryStorage();
  const { storage } = loadStorage(backend);
  const alice = storage.forUser('alice');
  await alice.saveStrengthSession(summary('alice-1'));
  storage.setUserScope('bob');
  await storage.saveStrengthSession(summary('bob-1'));
  assert.deepEqual((await alice.exportAllData()).STRENGTH_SESSIONS, [summary('alice-1')]);
  await storage.deleteAllData('alice');
  assert.deepEqual(await alice.getStrengthSessions(), []);
  assert.deepEqual(await storage.getStrengthSessions(), [summary('bob-1')]);
});

test('Strength failed writes reject without showing a false saved result, and retry succeeds', async () => {
  const backend = memoryStorage();
  const { storage } = loadStorage(backend);
  const alice = storage.forUser('alice');
  await alice.saveStrengthSession(summary('existing'));
  const originalWrite = backend.setItem;
  backend.setItem = async () => { throw new Error('quota exceeded'); };
  await assert.rejects(alice.saveStrengthSession(summary('retry')), /could not save on this device/i);
  backend.setItem = originalWrite;
  assert.deepEqual((await alice.getStrengthSessions()).map((item) => item.id), ['existing']);
  await alice.saveStrengthSession(summary('retry'));
  assert.deepEqual((await alice.getStrengthSessions()).map((item) => item.id), ['retry', 'existing']);
});

test('Strength failed reads do not overwrite prior device history', async () => {
  const backend = memoryStorage();
  const { storage } = loadStorage(backend);
  const alice = storage.forUser('alice');
  await alice.saveStrengthSession(summary('existing'));
  const originalRead = backend.getItem;
  backend.getItem = async () => { throw new Error('unavailable'); };
  await assert.rejects(alice.getStrengthSessions(), /could not read your saved sessions/i);
  await assert.rejects(alice.saveStrengthSession(summary('new')), /could not read your saved sessions/i);
  backend.getItem = originalRead;
  assert.deepEqual(await alice.getStrengthSessions(), [summary('existing')]);
});

test('Strength storage rejects missing account or summary identifiers', async () => {
  const { storage } = loadStorage(memoryStorage());
  await assert.rejects(storage.saveStrengthSession(summary('one')), /signed-in account/i);
  await assert.rejects(storage.forUser('alice').saveStrengthSession({ reps: 3 }), /identifier is missing/i);
});
