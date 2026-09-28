const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function createMemoryStorage(initialEntries = []) {
  const values = new Map(initialEntries);
  return {
    values,
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

function createMemorySecureStore(initialEntries = []) {
  const values = new Map(initialEntries);
  return {
    values,
    async isAvailableAsync() { return true; },
    async getItemAsync(key) { return values.has(key) ? values.get(key) : null; },
    async setItemAsync(key, value) { values.set(key, value); },
    async deleteItemAsync(key) { values.delete(key); },
  };
}

function loadStorageModule(storageBackend, secureBackend = createMemorySecureStore()) {
  const filename = path.resolve(__dirname, '../src/services/storage.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => {
    if (request === '@react-native-async-storage/async-storage') return storageBackend;
    if (request === 'expo-secure-store') return secureBackend;
    if (request === 'react-native') return { Platform: { OS: 'ios' } };
    return require(request);
  };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(localRequire, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

test('account cleanup after sign-out targets the captured UID, never the newly signed-in account', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);
  storage.setUserScope('alice');
  await storage.setMegConversations([{ id: 'alice-chat' }]);
  storage.setUserScope('bob');
  await storage.setMegConversations([{ id: 'bob-chat' }]);
  await storage.deleteAllData('alice');
  assert.deepEqual(await storage.getMegConversations(), [{ id: 'bob-chat' }]);
  storage.setUserScope('alice');
  assert.equal(await storage.getMegConversations(), null);
});

test('UID-bound storage keeps multi-step callbacks isolated after a global account switch', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);
  const alice = storage.forUser('alice');
  storage.setUserScope('bob');
  await storage.setSettings({ theme: 'dark' });
  await alice.setSettings({ theme: 'light' });
  await alice.setMegConversations([{ id: 'private' }]);
  assert.deepEqual(await storage.getSettings(), { theme: 'dark' });
  assert.equal(await storage.getMegConversations(), null);
});

test('storage JSON and AsyncStorage safety helpers return controlled fallbacks', async () => {
  const backend = createMemoryStorage();
  const helpers = loadStorageModule(backend);
  const fallback = { fallback: true };
  const cyclic = {};
  cyclic.self = cyclic;

  assert.deepEqual(helpers.safeParseJson(JSON.stringify({ valid: true }), fallback), { valid: true });
  assert.equal(helpers.safeParseJson('{invalid', fallback), fallback);
  assert.equal(helpers.safeStringifyJson(cyclic, fallback), fallback);
  assert.equal(await helpers.safeGetItem('key', { getItem: async () => { throw new Error(); } }), null);
  assert.equal(await helpers.safeSetItem('key', 'value', { setItem: async () => { throw new Error(); } }), false);
  assert.equal(await helpers.safeRemoveItem('key', { removeItem: async () => { throw new Error(); } }), false);
});

test('storage uses versioned UID keys and migrates the prior UID-scoped key', async () => {
  const legacyKey = '@bloom_user:user%2Fone:bloom_settings';
  const backend = createMemoryStorage([[legacyKey, JSON.stringify({ language: 'en' })]]);
  const { storage } = loadStorageModule(backend);
  storage.setUserScope(' user/one ');

  assert.deepEqual(await storage.getSettings(), { language: 'en' });
  assert.equal(backend.values.has(legacyKey), false);
  assert.equal(backend.values.has('@bloom_user:v1:user%2Fone:bloom_settings'), true);
});

test('onboarding drafts are UID-scoped and removed with account data', async () => {
  const legacyKey = '@bloom:v3:onboarding:draft';
  const backend = createMemoryStorage([[legacyKey, JSON.stringify({ answers: { firstName: 'Legacy' } })]]);
  const { storage } = loadStorageModule(backend);
  const alice = storage.forUser('alice');
  const bob = storage.forUser('bob');

  assert.throws(() => storage.forUser('   '), /signed-in account/);
  await alice.setOnboardingDraft({ answers: { firstName: 'Alice' }, step: 2 });
  assert.equal(await bob.getOnboardingDraft(), null);
  await bob.setOnboardingDraft({ answers: { firstName: 'Bob' }, step: 1 });
  await alice.removeLegacyUnscopedOnboardingDraft();
  assert.equal(backend.values.has(legacyKey), false);

  await storage.deleteAllData('alice');
  assert.equal(await alice.getOnboardingDraft(), null);
  assert.equal((await bob.getOnboardingDraft()).answers.firstName, 'Bob');
});

test('concurrent device collection saves serialize without dropping or duplicating records', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);
  storage.setUserScope('queue-user');

  await Promise.all([
    storage.saveMeal({ id: 'meal-a', name: 'First' }),
    storage.saveMeal({ id: 'meal-b', name: 'Second' }),
    storage.saveMeal({ id: 'meal-a', name: 'Updated' }),
  ]);

  const meals = await storage.getMeals();
  assert.deepEqual(meals.map(item => item.id).sort(), ['meal-a', 'meal-b']);
  assert.equal(meals.find(item => item.id === 'meal-a').name, 'Updated');
});

test('a failed device read blocks a destructive collection overwrite and a retry remains safe', async () => {
  const key = '@bloom_user:v1:retry-user:bloom_meals';
  const backend = createMemoryStorage([[key, JSON.stringify([{ id: 'existing' }])]]);
  const originalGetItem = backend.getItem.bind(backend);
  const { storage } = loadStorageModule(backend);
  storage.setUserScope('retry-user');
  backend.getItem = async () => { throw new Error('synthetic read failure'); };

  await assert.rejects(storage.saveMeal({ id: 'new' }), /could not read saved device data/i);
  assert.deepEqual(JSON.parse(backend.values.get(key)), [{ id: 'existing' }]);

  backend.getItem = originalGetItem;
  await storage.saveMeal({ id: 'new' });
  assert.deepEqual((await storage.getMeals()).map(item => item.id), ['existing', 'new']);
});

test('account deletion waits for a direct device write so late work cannot recreate data', async () => {
  const backend = createMemoryStorage();
  const originalSetItem = backend.setItem.bind(backend);
  let releaseWrite;
  backend.setItem = (key, value) => new Promise((resolve) => {
    releaseWrite = async () => { await originalSetItem(key, value); resolve(); };
  });
  const { storage } = loadStorageModule(backend);
  const alice = storage.forUser('alice');
  const writing = alice.setSchemaVersion(2);
  await new Promise(setImmediate);

  let deletionFinished = false;
  const deleting = storage.deleteAllData('alice').then(() => { deletionFinished = true; });
  await new Promise(setImmediate);
  assert.equal(deletionFinished, false);

  await releaseWrite();
  await Promise.all([writing, deleting]);
  assert.equal(backend.values.has('@bloom_user:v1:alice:bloom_schema_version'), false);
});

test('app-lock PIN migrates from AsyncStorage into protected storage', async () => {
  const pinKey = '@bloom_user:v1:user-one:bloom_app_lock_pin';
  const backend = createMemoryStorage([[pinKey, JSON.stringify('2468')]]);
  const secureBackend = createMemorySecureStore();
  const { storage } = loadStorageModule(backend, secureBackend);
  storage.setUserScope('user-one');

  assert.equal(await storage.getAppLockPin(), '2468');
  assert.equal(backend.values.has(pinKey), false);
  assert.equal(secureBackend.values.get('bloom.v1.user-one._bloom_app_lock_pin'), '2468');
});

test('storage removes malformed JSON and tolerates structurally invalid collections', async () => {
  const corruptKey = '@bloom_user:v1:user-one:bloom_settings';
  const mealsKey = '@bloom_user:v1:user-one:bloom_meals';
  const backend = createMemoryStorage([
    [corruptKey, '{invalid'],
    [mealsKey, JSON.stringify({ not: 'an-array' })],
  ]);
  const { storage } = loadStorageModule(backend);
  storage.setUserScope('user-one');

  assert.equal(await storage.getSettings(), null);
  assert.equal(backend.values.has(corruptKey), false);
  assert.deepEqual(await storage.saveMeal({ id: 'meal-one' }), [{ id: 'meal-one' }]);
});

test('meal logs and reflections remain isolated when the signed-in account changes', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);

  storage.setUserScope('user-a');
  await storage.saveMeal({
    id: 'meal-a',
    name: 'A meal',
    reflection: { outcome: 'steady_energy' },
  });

  storage.setUserScope('user-b');
  assert.equal(await storage.getMeals(), null);
  await storage.saveMeal({ id: 'meal-b', name: 'B meal' });

  storage.setUserScope('user-a');
  assert.deepEqual((await storage.getMeals()).map((meal) => meal.id), ['meal-a']);
  assert.equal((await storage.getMeals())[0].reflection.outcome, 'steady_energy');
  await storage.deleteMeal('meal-a');
  assert.deepEqual(await storage.getMeals(), []);

  storage.setUserScope('user-b');
  assert.deepEqual((await storage.getMeals()).map((meal) => meal.id), ['meal-b']);
});

test('Meg retry state remains UID-scoped in device storage', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);

  storage.setUserScope('user-a');
  await storage.setMegConversations([{ id: 'chat-a', messages: [{ deliveryStatus: 'failed' }] }]);
  storage.setUserScope('user-b');
  assert.equal(await storage.getMegConversations(), null);
  await storage.setMegConversations([{ id: 'chat-b', messages: [] }]);

  storage.setUserScope('user-a');
  assert.equal((await storage.getMegConversations())[0].id, 'chat-a');
  assert.equal((await storage.getMegConversations())[0].messages[0].deliveryStatus, 'failed');
});

test('theme preference and Strength outbox remain isolated by signed-in UID', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);

  storage.setUserScope('user-a');
  await storage.setSettings({ theme: 'dark' });
  await storage.setStrengthOutbox([{ summary: { id: 'strength-a' }, queuedAt: 1 }]);

  storage.setUserScope('user-b');
  assert.equal(await storage.getSettings(), null);
  assert.equal(await storage.getStrengthOutbox(), null);
  await storage.setSettings({ theme: 'light' });

  storage.setUserScope('user-a');
  assert.equal((await storage.getSettings()).theme, 'dark');
  assert.equal((await storage.getStrengthOutbox())[0].summary.id, 'strength-a');
});

test('water reminder settings persist in existing account-scoped settings storage', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);
  storage.setUserScope('water-user');
  const waterReminders = {
    enabled: true,
    intervalHours: 3,
    startTime: '08:00',
    endTime: '23:00',
    notificationIds: ['bloom-water-reminders-example'],
  };

  await storage.setSettings({ waterReminders });
  assert.deepEqual((await storage.getSettings()).waterReminders, waterReminders);
});
