const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const babel = require('@babel/core');
const configuration = require('../src/services/firebaseConfiguration');
const { validateReleaseConfiguration } = require('../scripts/check-release-config.cjs');

// Deliberately synthetic public identifiers. These tests never contact Firebase.
const validConfig = Object.freeze({
  apiKey: 'synthetic-public-api-key', authDomain: 'bloom-test.firebaseapp.com',
  projectId: 'bloom-test', storageBucket: 'bloom-test.firebasestorage.app',
  messagingSenderId: '123456789', appId: '1:123456789:web:abc123',
});
const environment = config => Object.fromEntries(Object.entries(configuration.FIREBASE_CONFIG_ENV_NAMES)
  .map(([key, name]) => [name, config[key]]));
const releaseEnvironment = () => ({
  ...environment(validConfig), EXPO_PUBLIC_BLOOM_DEV_AUTH: '0', MEG_DEV_AUTH: '0', EXPO_PUBLIC_BLOOM_STRENGTH: '0',
  EXPO_PUBLIC_MEG_API_URL: 'https://api.bloom-test.example',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://bloom-test.example/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://bloom-test.example/terms', EXPO_PUBLIC_SUPPORT_URL: 'https://bloom-test.example/support',
});

const compiledFirebase = babel.transformFileSync(path.resolve(__dirname, '../src/services/firebase.js'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;

function loadFirebase(options = {}) {
  const calls = { app: 0, auth: [], firestore: 0, nativeStorage: null, failures: [] };
  const apps = [...(options.apps || [])];
  const auth = { currentUser: null };
  const db = {};
  const storage = {};
  let stage;
  let failure = options.failure;
  const dependencies = {
    'react-native': { Platform: { OS: options.platform || 'web' } },
    '@react-native-async-storage/async-storage': storage,
    'firebase/app': {
      getApps: () => apps,
      getApp: () => apps.find(app => app.name === '[DEFAULT]'),
      initializeApp(config) {
        calls.app++;
        if (failure === 'app') throw new Error('synthetic app failure');
        const app = { name: '[DEFAULT]', options: config }; apps.push(app); return app;
      },
    },
    'firebase/auth': {
      browserLocalPersistence: 'browser-local',
      ...(options.noNativePersistence ? {} : { getReactNativePersistence(value) { calls.nativeStorage = value; return 'native-storage'; } }),
      initializeAuth(app, settings) {
        calls.auth.push(settings);
        if (failure === 'auth') throw new Error('synthetic auth failure');
        if (options.authAlreadyInitialized) throw Object.assign(new Error('already initialized'), { code: 'auth/already-initialized' });
        return auth;
      },
      getAuth: () => auth,
    },
    'firebase/firestore': { getFirestore() { calls.firestore++; if (failure === 'firestore') throw new Error('synthetic Firestore failure'); return db; } },
    './firebaseConfiguration': configuration,
    '../diagnostics/startupDiagnostics': {
      setStartupStage(value) { stage = value; }, getStartupStage: () => stage,
      recordStartupFailure(error, at) { const result = { stage: at, message: typeof error === 'string' ? error : error.message }; calls.failures.push(result); return result; },
    },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', '__DEV__', compiledFirebase)(
    name => { if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`); return dependencies[name]; },
    module, module.exports, { env: { ...environment(options.config || validConfig), ...options.env } }, options.isDevelopment === true,
  );
  return { service: module.exports, calls, auth, db, storage, recover: () => { failure = null; } };
}

test('missing and whitespace Firebase configuration reports field names without initializing the SDK', () => {
  const f = loadFirebase({ config: { apiKey: '  ' } });
  assert.equal(f.service.firebaseConfigurationIssues.length, 6);
  for (const name of Object.values(configuration.FIREBASE_CONFIG_ENV_NAMES)) assert.ok(f.service.firebaseConfigurationError.includes(name));
  const result = f.service.initializeFirebaseServices();
  assert.equal(result.failure.stage, 'configuration-check');
  assert.equal(result.auth, null); assert.equal(result.db, null); assert.equal(f.calls.app, 0);
});

test('Firebase configuration normalizes surrounding whitespace and rejects placeholders or malformed auth domains', () => {
  const spaced = Object.fromEntries(Object.entries(validConfig).map(([key, value]) => [key, ` ${value} `]));
  assert.deepEqual(configuration.normalizeFirebaseConfiguration(spaced), validConfig);
  assert.deepEqual(configuration.validateFirebaseConfiguration(spaced), []);
  for (const value of ['YOUR_API_KEY', '<project-key>', 'a b']) {
    const issues = configuration.validateFirebaseConfiguration({ ...validConfig, apiKey: value });
    assert.equal(issues.length, 1); assert.ok(issues[0].startsWith('EXPO_PUBLIC_FIREBASE_API_KEY'));
    assert.equal(issues[0].includes(value), false);
  }
  for (const authDomain of ['https://bloom-test.firebaseapp.com', 'bloom-test.firebaseapp.com/path', 'user@domain.example', 'domain..example']) {
    assert.match(configuration.validateFirebaseConfiguration({ ...validConfig, authDomain })[0], /AUTH_DOMAIN/);
  }
});

test('development auth requires an explicit development build and flag, and production fails closed', () => {
  assert.equal(configuration.isDevelopmentAuthEnabled(true, '1'), true);
  for (const flag of [undefined, '0', 'true', ' 1 ']) assert.equal(configuration.isDevelopmentAuthEnabled(true, flag), false);
  for (const flag of ['1', 'true', ' TRUE ', ' 1 ']) {
    const f = loadFirebase({ env: { EXPO_PUBLIC_BLOOM_DEV_AUTH: flag } });
    assert.equal(f.service.developmentAuthEnabled, false);
    assert.match(f.service.initializeFirebaseServices().failure.message, /DEV_AUTH must be disabled/);
    assert.equal(f.calls.app, 0);
  }
  assert.equal(loadFirebase({ isDevelopment: true, env: { EXPO_PUBLIC_BLOOM_DEV_AUTH: '1' } }).service.developmentAuthEnabled, true);
});

test('web Firebase initialization uses local persistence and reuses successful services', () => {
  const f = loadFirebase();
  assert.equal(f.calls.app, 0, 'import remains lazy');
  const first = f.service.initializeFirebaseServices();
  assert.equal(first.failure, null); assert.equal(first.auth, f.auth); assert.equal(first.db, f.db);
  assert.deepEqual(f.calls.auth, [{ persistence: 'browser-local' }]);
  assert.equal(f.service.initializeFirebaseServices().auth, f.auth);
  assert.equal(f.calls.app, 1); assert.equal(f.calls.firestore, 1);
});

test('native Firebase initialization uses AsyncStorage persistence and fails clearly when the adapter is absent', () => {
  const native = loadFirebase({ platform: 'ios' });
  assert.equal(native.service.initializeFirebaseServices().failure, null);
  assert.equal(native.calls.nativeStorage, native.storage);
  assert.deepEqual(native.calls.auth, [{ persistence: 'native-storage' }]);
  const unavailable = loadFirebase({ platform: 'android', noNativePersistence: true });
  assert.match(unavailable.service.initializeFirebaseServices().failure.message, /persistence is unavailable/);
  assert.equal(unavailable.service.auth, null);
});

test('SDK app, Auth and Firestore initialization failures remain recoverable', () => {
  for (const failure of ['app', 'auth', 'firestore']) {
    const f = loadFirebase({ failure });
    const result = f.service.initializeFirebaseServices();
    assert.ok(result.failure); assert.equal(result.auth, null); assert.equal(result.db, null);
    assert.ok(f.service.firebaseInitializationError);
    f.recover();
    assert.equal(f.service.initializeFirebaseServices().failure, null);
    assert.equal(f.service.firebaseInitializationError, null);
  }
});

test('Firebase reuses only a matching default app, preserving named apps and rejecting a different project', () => {
  const defaultApp = { name: '[DEFAULT]', options: { ...validConfig } };
  const existing = loadFirebase({ apps: [defaultApp], authAlreadyInitialized: true });
  assert.equal(existing.service.initializeFirebaseServices().app, defaultApp); assert.equal(existing.calls.app, 0);
  const named = loadFirebase({ apps: [{ name: 'secondary', options: {} }] });
  assert.equal(named.service.initializeFirebaseServices().failure, null); assert.equal(named.calls.app, 1);
  const mismatch = loadFirebase({ apps: [{ ...defaultApp, options: { ...validConfig, projectId: 'other-project' } }] });
  assert.match(mismatch.service.initializeFirebaseServices().failure.message, /configuration changed/);
  assert.equal(mismatch.calls.auth.length, 0);
});

test('release validation accepts complete configuration and flags missing, local and unsafe public fields', () => {
  assert.deepEqual(validateReleaseConfiguration(releaseEnvironment()), []);
  assert.deepEqual(validateReleaseConfiguration({ ...releaseEnvironment(), EXPO_PUBLIC_BLOOM_STRENGTH: '1' }), []);
  assert.ok(validateReleaseConfiguration({ ...releaseEnvironment(), MEG_DEV_AUTH: '1' }).some(issue => issue.startsWith('MEG_DEV_AUTH')));
  const bad = { ...releaseEnvironment(), EXPO_PUBLIC_FIREBASE_APP_ID: '', EXPO_PUBLIC_BLOOM_DEV_AUTH: '1', EXPO_PUBLIC_MEG_API_URL: 'http://localhost:3001', EXPO_PUBLIC_SUPPORT_URL: 'https://192.168.1.2/support', EXPO_PUBLIC_PRIVATE_KEY: 'never-print-this-value' };
  const issues = validateReleaseConfiguration(bad);
  for (const name of ['EXPO_PUBLIC_FIREBASE_APP_ID', 'EXPO_PUBLIC_BLOOM_DEV_AUTH', 'EXPO_PUBLIC_MEG_API_URL', 'EXPO_PUBLIC_SUPPORT_URL', 'EXPO_PUBLIC_PRIVATE_KEY']) assert.ok(issues.some(issue => issue.startsWith(name)));
  assert.equal(issues.join('\n').includes('never-print-this-value'), false);
  assert.equal(issues.join('\n').includes('192.168.1.2'), false);
});

test('release CLI prints names and status only, and exits unsuccessfully for invalid configuration', () => {
  const filename = path.resolve(__dirname, '../scripts/check-release-config.cjs');
  const source = fs.readFileSync(filename, 'utf8');
  function run(env) {
    const output = [];
    const module = { exports: {} };
    const localRequire = createRequire(filename);
    const requireMock = name => name === 'dotenv' ? { config() {} } : localRequire(name);
    requireMock.main = module;
    const processMock = { env, exitCode: 0 };
    vm.runInNewContext(source, { module, require: requireMock, process: processMock, URL, console: { log: text => output.push(text), error: text => output.push(text) } }, { filename });
    return { output: output.join('\n'), exitCode: processMock.exitCode };
  }
  const good = run(releaseEnvironment()); assert.equal(good.exitCode, 0); assert.match(good.output, /configuration is present/);
  const bad = run({ ...releaseEnvironment(), EXPO_PUBLIC_FIREBASE_API_KEY: 'YOUR_API_KEY', EXPO_PUBLIC_SERVICE_ACCOUNT_JSON: 'sensitive-content-sentinel' });
  assert.equal(bad.exitCode, 1); assert.match(bad.output, /EXPO_PUBLIC_FIREBASE_API_KEY/);
  for (const value of ['YOUR_API_KEY', 'sensitive-content-sentinel', ...Object.values(validConfig)]) assert.equal(bad.output.includes(value), false);
});
