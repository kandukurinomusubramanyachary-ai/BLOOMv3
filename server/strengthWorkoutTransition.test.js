const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const { decideOnSetComplete, resolveRestSeconds, WORKOUT_REST_FALLBACK_SEC } = require('../src/features/strength/engine/workoutProgression');
const { supportsPoseTracking } = require('../src/features/strength/poseCapability');
const { serializeStrengthSummary } = require('../src/features/strength/engine/strengthPrivacy');

// Load the shipped plan data (ESM) with the same transform the other data
// tests use — the catalog under test, not a copied fixture.
const loaded = new Map();
function loadData(filename) {
  const resolved = path.resolve(__dirname, '../src/features/strength/data', filename);
  if (loaded.has(resolved)) return loaded.get(resolved).exports;
  const transformed = babel.transformFileSync(resolved, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  loaded.set(resolved, moduleValue);
  const localRequire = (request) => request.startsWith('.')
    ? loadData(path.resolve(path.dirname(resolved), request + (path.extname(request) ? '' : '.js')))
    : require(request);
  new Function('require', 'module', 'exports', transformed.code)(localRequire, moduleValue, moduleValue.exports);
  return moduleValue.exports;
}
const { WORKOUT_PLANS } = loadData('workoutPlans.js');

test('set completion chooses the next set while sets remain', () => {
  assert.equal(decideOnSetComplete({ currentSet: 1, totalSets: 2, hasNext: true }), 'next-set');
  assert.equal(decideOnSetComplete({ currentSet: 1, totalSets: 3, hasNext: false }), 'next-set');
});

test('final set of a non-final exercise is a workout transition (camera stays live)', () => {
  assert.equal(decideOnSetComplete({ currentSet: 2, totalSets: 2, hasNext: true }), 'workout-transition');
  assert.equal(decideOnSetComplete({ currentSet: 3, totalSets: 3, hasNext: true }), 'workout-transition');
});

test('final set of the final exercise completes the workout', () => {
  assert.equal(decideOnSetComplete({ currentSet: 2, totalSets: 2, hasNext: false }), 'workout-complete');
  assert.equal(decideOnSetComplete({ currentSet: 1, totalSets: 1, hasNext: false }), 'workout-complete');
});

test('transition decision is safe against hostile set inputs', () => {
  assert.equal(decideOnSetComplete({ currentSet: NaN, totalSets: 2, hasNext: true }), 'next-set');
  assert.equal(decideOnSetComplete({ currentSet: 0, totalSets: 0, hasNext: false }), 'workout-complete');
  assert.equal(decideOnSetComplete({ currentSet: 99, totalSets: '2', hasNext: true }), 'workout-transition');
});

test('workout rest seconds normalise like every other timer value', () => {
  assert.equal(resolveRestSeconds(45), 45);
  assert.equal(resolveRestSeconds(30.6), 31);
  assert.equal(resolveRestSeconds(-4), 0);
  assert.equal(resolveRestSeconds(undefined), WORKOUT_REST_FALLBACK_SEC);
  assert.equal(resolveRestSeconds('soon'), WORKOUT_REST_FALLBACK_SEC);
  assert.equal(resolveRestSeconds(undefined, 40), 40);
});

test('the acceptance workout (Everyday strength) is fully pose-tracked', () => {
  const plan = WORKOUT_PLANS.find(item => item.id === 'everyday-strength');
  assert.ok(plan, 'Everyday strength plan exists');
  assert.equal(plan.exercises.length, 3);
  for (const item of plan.exercises) {
    assert.ok(supportsPoseTracking(item.exercise.id), `${item.exercise.id} must be pose-tracked for the one-camera workout`);
  }
});

test('a workout transition summary passes the privacy allowlist unchanged', () => {
  const summary = serializeStrengthSummary({
    id: 'strength-123-abc',
    exerciseId: 'bodyweight-squat-v1',
    exerciseVersion: 1,
    startedAt: '2026-09-17T09:00:00.000Z',
    completedAt: '2026-09-17T09:04:30.000Z',
    durationSeconds: 270,
    targetReps: 10,
    acceptedReps: 20,
    totalSets: 2,
    completedSets: 2,
    pauseCount: 0,
    cueCounts: { slowDown: 1 },
    completionState: 'completed',
    platform: 'web',
    privacyVersion: 1,
  });
  assert.equal(summary.completionState, 'completed');
  assert.equal(summary.acceptedReps, 20);
  assert.equal(summary.exerciseId, 'bodyweight-squat-v1');
  assert.equal(summary.totalSets, 2);
  assert.equal(summary.completedSets, 2);
});
