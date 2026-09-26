const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const personalization = require('../src/features/onboardingV3/utils/personalization');
const { restoreOnboardingHistory } = require('../src/features/onboardingV3/utils/onboardingDraft');
const { createTourRecord, isTourHandled, productTourStorageKey } = require('../src/components/productTour/tourState');

function loadTourSteps(platform) {
  const filename = path.resolve(__dirname, '../src/components/productTour/tourSteps.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const evaluate = new Function('require', 'module', 'exports', '__filename', '__dirname', transformed.code);
  evaluate(request => request === 'react-native' ? { Platform: { OS: platform } } : require(request), moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

function stableResult(answers) {
  const result = personalization.buildOnboardingResult(answers);
  result.onboardingRecord.completedAt = '<timestamp>';
  return result;
}

test('onboarding personalization is deterministic and never persists Friend as a name', () => {
  const answers = { reasonsForJoining: ['understand_symptoms'], cyclePattern: 'very_irregular', symptoms: ['fatigue'], priorities: ['manage_symptoms'] };
  assert.deepEqual(stableResult(answers), stableResult(answers));
  const result = stableResult(answers);
  assert.equal(result.onboardingRecord.firstName, null);
  assert.equal(result.megHandoff.userName, null);
  assert.equal(result.homePersonalizationHandoff.firstName, null);
  assert.doesNotMatch(JSON.stringify(result), /"Friend"/);
});

test('restored onboarding drafts preserve their real navigation history', () => {
  assert.deepEqual(restoreOnboardingHistory([0, 1, 2, 3, 4], 4), [0, 1, 2, 3, 4]);
  assert.deepEqual(restoreOnboardingHistory(null, 5), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(restoreOnboardingHistory([0, 1, 1, 2], 2), [0, 1, 2]);
});

test('priority resolution is deterministic rather than dependent on tap order', () => {
  const left = personalization.resolvePrimaryFocus({ priorities: ['build_strength', 'manage_symptoms'], reasonsForJoining: [] });
  const right = personalization.resolvePrimaryFocus({ priorities: ['manage_symptoms', 'build_strength'], reasonsForJoining: [] });
  assert.equal(left, 'manage_symptoms');
  assert.equal(right, 'manage_symptoms');
});

test('every onboarding recommendation routes to a real Bloom destination', () => {
  const priorities = ['understand_cycle', 'manage_symptoms', 'emotional_support', 'build_strength', 'improve_consistency', 'prepare_doctor', 'healthier_habits'];
  const realRoutes = new Set(['DailyCheckIn', 'Meg', 'Strength', 'Diet']);
  for (const priority of priorities) {
    const action = personalization.generateFirstAction(personalization.normalizeOnboardingAnswers({ priorities: [priority] }));
    assert.ok(realRoutes.has(action.route), `${priority} uses an unknown route`);
  }
});

test('tour state is scoped per user and completed or skipped tours stay handled', () => {
  const base = '@bloom_product_tours_v3';
  assert.notEqual(productTourStorageKey(base, 'user-a'), productTourStorageKey(base, 'user-b'));
  assert.equal(isTourHandled(createTourRecord('completed', '2026-01-01')), true);
  assert.equal(isTourHandled(createTourRecord('skipped', '2026-01-01')), true);
  assert.equal(isTourHandled(undefined), false);
});

test('tour metadata is truthful by platform and target IDs are unique within each guide', () => {
  const web = loadTourSteps('web');
  const native = loadTourSteps('ios');
  assert.ok(web.TOUR_SETS.strengthWorkout.some(step => step.id === 'strength-reps'));
  assert.ok(!native.TOUR_SETS.strengthWorkout.some(step => step.id === 'strength-reps'));
  assert.match(native.TOUR_SETS.strengthWorkout[1].description, /not measured/i);
  assert.ok(web.GUIDE_METADATA.strengthWorkout.requiresContext);
  assert.ok(web.GUIDE_METADATA.strengthSummary.requiresContext);
  assert.ok(!web.TOUR_SETS.appOverview.some(step => /diet/i.test(step.id)));
  for (const [tourId, steps] of Object.entries(web.TOUR_SETS)) {
    assert.equal(new Set(steps.map(step => step.id)).size, steps.length, `${tourId} contains duplicate target IDs`);
  }
});

test('onboarding and Learn Bloom no longer rely on survey labels, emoji graphics, or fixed replay delays', () => {
  const onboardingDir = path.resolve(__dirname, '../src/features/onboardingV3');
  const sources = fs.readdirSync(path.join(onboardingDir, 'screens')).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(onboardingDir, 'screens', name), 'utf8')).join('\n');
  const learn = fs.readFileSync(path.resolve(__dirname, '../src/screens/LearnBloomScreen.js'), 'utf8');
  const strength = fs.readFileSync(path.resolve(__dirname, '../src/features/strength/StrengthExperience.js'), 'utf8');
  assert.doesNotMatch(sources, /STEP \d+ OF \d+/);
  assert.doesNotMatch(sources, /[🌿🔒💬🌷]/u);
  assert.doesNotMatch(learn, /setTimeout\(/);
  assert.match(learn, /requestTourReplay/);
  assert.doesNotMatch(strength, /ids=\{\['strength-workout-progress', 'strength-guidance', 'strength-reps', 'strength-pause'\]\}/);
});
