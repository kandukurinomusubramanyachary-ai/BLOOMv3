const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStoreBuilds } = require('../scripts/check-store-builds.cjs');
const { validateNativeConfiguration } = require('../scripts/check-native-config.cjs');

test('native release gate rejects unsupported SDK, target and store configuration', () => {
  const pkg = { version: '1.1.0', dependencies: { expo: '~57.0.24' } };
  const config = {
    version: '1.1.0', orientation: 'portrait',
    ios: { buildNumber: '3' }, android: { versionCode: 5 },
    plugins: [['expo-build-properties', { android: { targetSdkVersion: 36 }, ios: { deploymentTarget: '16.4' } }]],
  };
  const eas = { build: { production: { distribution: 'store', android: { buildType: 'app-bundle', image: 'sdk-57' }, ios: { simulator: false, image: 'sdk-57' } } } };
  assert.deepEqual(validateNativeConfiguration(pkg, config, eas), []);
  for (const mutate of [
    (p) => { p.dependencies.expo = '~51.0.0'; },
    (_, c) => { c.plugins[0][1].android.targetSdkVersion = 34; },
    (_, c) => { c.plugins[0][1].ios.deploymentTarget = '15.1'; },
    (_, c) => { c.ios.buildNumber = '0'; },
    (_, c) => { c.newArchEnabled = false; },
    (_, c) => { c.version = '1.0.0'; },
    (_, c, e) => { e.build.production.android.buildType = 'apk'; },
    (_, c, e) => { e.build.production.ios.simulator = true; },
    (_, c, e) => { e.build.production.ios.image = 'latest'; },
  ]) {
    const args = structuredClone([pkg, config, eas]); mutate(...args);
    assert.ok(validateNativeConfiguration(...args).length);
  }
});

const commit = 'a'.repeat(40);
const app = { version: '1.1.0', android: { versionCode: 5 }, ios: { buildNumber: '3' } };
const evidence = () => ['ANDROID', 'IOS'].map(platform => ({
  id: `test-${platform}`, platform, status: 'FINISHED', gitCommitHash: commit,
  app: { id: 'test-project' }, buildProfile: 'production', distribution: 'STORE',
  isForIosSimulator: false, appVersion: '1.1.0', appBuildVersion: platform === 'IOS' ? '3' : '5',
  artifacts: { applicationArchiveUrl: 'https://expo.dev/test-artifact' },
}));

test('store gate accepts both completed artifacts for the exact release commit', () => {
  assert.deepEqual(validateStoreBuilds(evidence(), commit, app, 'test-project'), []);
});

test('store gate rejects queued, missing, unrelated, unsigned-scope and stale-version builds', () => {
  for (const patch of [
    { status: 'IN_QUEUE' }, { status: 'ERRORED' }, { gitCommitHash: 'b'.repeat(40) },
    { app: { id: 'wrong-project' } }, { buildProfile: 'preview' }, { distribution: 'INTERNAL' },
    { appVersion: '1.0.0' }, { appBuildVersion: '1' }, { artifacts: {} },
  ]) {
    const builds = evidence(); Object.assign(builds[0], patch);
    assert.ok(validateStoreBuilds(builds, commit, app, 'test-project').length, JSON.stringify(patch));
  }
  assert.ok(validateStoreBuilds(evidence().slice(0, 1), commit, app, 'test-project').length);
  assert.ok(validateStoreBuilds([...evidence(), evidence()[0]], commit, app, 'test-project').length);
  const simulator = evidence(); simulator[1].isForIosSimulator = true;
  assert.ok(validateStoreBuilds(simulator, commit, app, 'test-project').length);
});
