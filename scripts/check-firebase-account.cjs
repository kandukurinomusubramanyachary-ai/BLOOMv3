// Uses reserved synthetic QA identities, never a founder account or health data.
require('dotenv').config({ path: process.env.BLOOM_QA_CONFIG_FILE || '.env', quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { initializeApp, deleteApp } = require('firebase/app');
const sdkAuth = require('firebase/auth');
const sdkStore = require('firebase/firestore');
sdkStore.setLogLevel('silent');
const fs = require('node:fs');
const { FIREBASE_CONFIG_ENV_NAMES, validateFirebaseConfiguration } = require('../src/services/firebaseConfiguration');
const emulator = process.argv.includes('--emulator');
const apps = [];
const accounts = [];
let stage = 'configuration';
const deadline = setTimeout(() => { console.error('FAIL: QA deadline exceeded at ' + stage + '. Cleanup journal is retained for live QA.'); process.exit(1); }, 90000);
let ownsJournal = false;
const journal = path.resolve(__dirname, '../tmp/release-evidence/qa-cleanup.json');
function saveJournal(projectId) {
  if (emulator || !ownsJournal) return;
  fs.writeFileSync(journal, JSON.stringify({ projectId, accounts: accounts.filter(item => !item.deleted).map(({ uid, email, password }) => ({ uid, email, password })) }));
}

function services(auth, db) {
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const filename = path.resolve(__dirname, '../src/services', name + '.js');
    const code = require('@babel/core').transformFileSync(filename, { babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]] }).code;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(request => {
      if (request === './firebase') return { auth, db, firebaseConfigurationError: null };
      if (request === './userData') return load('userData');
      if (request === './accountWork') return require('../src/services/accountWork');
      if (request === '../utils/dateKey') return require('../src/utils/dateKey');
      if (request === 'firebase/firestore' && process.env.BLOOM_QA_TRACE === '1') return { ...sdkStore, getDoc: async ref => {
        console.log('QA read: ' + ref.path.split('/')[0]);
        try { return await sdkStore.getDoc(ref); } catch (error) { console.log('QA read failed: ' + error.code); throw error; }
      } };
      return require(request);
    }, module, module.exports);
    cache.set(name, module.exports); return module.exports;
  }
  return { ...load('authProfile'), ...load('userData') };
}

async function main() {
  const config = emulator
    ? { apiKey: 'synthetic-emulator-key', authDomain: 'demo-bloom-auth.firebaseapp.com', projectId: 'demo-bloom-auth', appId: '1:123456789:web:synthetic' }
    : Object.fromEntries(Object.entries(FIREBASE_CONFIG_ENV_NAMES).map(([key, name]) => [key, process.env[name]]));
  if (!emulator) {
    assert.equal(process.env.BLOOM_QA_ALLOW_LIVE_ACCOUNTS, '1', 'Live QA account creation/deletion must be explicitly enabled.');
    assert.equal(process.env.BLOOM_QA_EXPECTED_PROJECT, config.projectId, 'Set the exact approved QA project before live checks.');
    assert.deepEqual(validateFirebaseConfiguration(config, { devAuthFlag: '0' }), []);
    fs.mkdirSync(path.dirname(journal), { recursive: true });
    fs.closeSync(fs.openSync(journal, 'wx')); ownsJournal = true;
    saveJournal(config.projectId);
  }
  function client() {
    const app = initializeApp(config, 'qa-' + randomUUID()); apps.push(app);
    const auth = sdkAuth.getAuth(app); const db = sdkStore.getFirestore(app);
    if (emulator) { sdkAuth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); sdkStore.connectFirestoreEmulator(db, '127.0.0.1', 8080); }
    return { auth, db, app, service: services(auth, db) };
  }
  async function create() {
    const c = client();
    c.email = 'bloom-qa-' + randomUUID() + '@example.invalid'; c.password = randomUUID() + '!Aa8';
    const result = await sdkAuth.createUserWithEmailAndPassword(c.auth, c.email, c.password);
    const claims = await sdkAuth.getIdTokenResult(result.user);
    assert.equal(claims.claims.aud, config.projectId, 'QA token audience must match the selected Firebase project.');
    c.uid = result.user.uid; accounts.push(c); saveJournal(config.projectId); return c;
  }
  stage = 'signup and transactional profile creation';
  const first = await create();
  await first.service.ensureAuthProfile(first.auth.currentUser, { firstName: 'Synthetic QA', consent: true, modelImprovementConsent: false });
  const reference = sdkStore.doc(first.db, 'users', first.uid);
  assert.equal((await sdkStore.getDocFromServer(reference)).data().consent, true);
  console.log('PASS: ' + stage);
  stage = 'owner-scoped check-in synchronization';
  await first.service.saveCurrentUserCheckin({ date: '2026-01-02', energy: 5, mood: 'calm', flow: 'none' });
  assert.equal((await first.service.loadCurrentUserData()).checkins.length, 1);
  console.log('PASS: ' + stage);
  stage = 'signout and new login restore the same UID and records';
  await sdkAuth.signOut(first.auth);
  const credential = await sdkAuth.signInWithEmailAndPassword(first.auth, first.email, first.password);
  assert.equal(credential.user.uid, first.uid);
  assert.equal((await first.service.loadCurrentUserData()).checkins.length, 1);
  console.log('PASS: ' + stage);
  stage = 'cross-account reads and writes are rejected';
  const second = await create();
  for (const operation of [() => sdkStore.getDocFromServer(sdkStore.doc(second.db, 'users', first.uid)), () => sdkStore.setDoc(sdkStore.doc(second.db, 'users', first.uid), { firstName: 'Override' }, { merge: true })]) {
    await assert.rejects(operation(), error => /permission-denied/.test(error.code));
  }
  console.log('PASS: ' + stage);
  stage = 'offline cached read and reconnect preserve the owner record';
  await sdkStore.disableNetwork(first.db);
  assert.equal((await sdkStore.getDocFromCache(reference)).data().firstName, 'Synthetic QA');
  await sdkStore.enableNetwork(first.db);
  assert.equal((await sdkStore.getDocFromServer(reference)).data().firstName, 'Synthetic QA');
  console.log('PASS: ' + stage);
  stage = 'tracking export and ordered Firestore/Auth deletion';
  const exported = await first.service.loadCurrentUserData();
  assert.equal(exported.checkins.length, 1);
  await first.service.prepareCurrentUserAccountDeletion(first.uid);
  await first.service.deleteAllCurrentUserTrackingData(first.uid);
  await first.service.deleteCurrentUserProfileDocument(first.uid);
  await sdkAuth.deleteUser(first.auth.currentUser); first.deleted = true;
  await assert.rejects(sdkAuth.signInWithEmailAndPassword(first.auth, first.email, first.password), error => /user-not-found|invalid-credential|invalid-login-credentials/.test(error.code));
  console.log('PASS: ' + stage);
}

main().catch(error => {
  console.error('FAIL: ' + stage + ' (' + (error.code || error.name || 'error') + '). No credentials, account IDs or record contents printed.'); process.exitCode = 1;
}).finally(async () => {
  for (const account of accounts) {
    if (account.deleted) continue;
    try {
      if (!account.auth.currentUser) await sdkAuth.signInWithEmailAndPassword(account.auth, account.email, account.password);
      await account.service.deleteAllCurrentUserTrackingData(account.uid);
      await account.service.deleteCurrentUserProfileDocument(account.uid);
      await sdkAuth.deleteUser(account.auth.currentUser); account.deleted = true;
    } catch { console.error('QA cleanup did not complete; inspect only the reserved bloom-qa identities in the approved QA project.'); process.exitCode = 1; }
  }
  if (ownsJournal) {
    const pending = accounts.filter(item => !item.deleted);
    if (pending.length) saveJournal(process.env.BLOOM_QA_EXPECTED_PROJECT);
    else fs.unlinkSync(journal);
  }
  await Promise.allSettled(apps.map(async app => { await sdkStore.terminate(sdkStore.getFirestore(app)); await deleteApp(app); }));
  clearTimeout(deadline);
});
