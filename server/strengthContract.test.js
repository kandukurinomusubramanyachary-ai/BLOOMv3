const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GUIDED_ONLY_IDS,
  POSE_ENGINE_BY_EXERCISE,
  POSE_ENGINE_IDS,
  modeForExercise,
  normalizeSetCount,
  poseEngineIdForExercise,
  resolveTargetReps,
  supportsPoseTracking,
} = require('../src/features/strength/poseCapability');
const { EXERCISES, exerciseById } = require('../src/features/strength/exercises');
const { createRepStateMachine } = require('../src/features/strength/engine/repStateMachine');

const baseline = { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } };

// The canonical catalog → pose engine mapping (contract).
test('catalog exercise maps to the correct deterministic pose engine', () => {
  assert.equal(poseEngineIdForExercise('bodyweight-squat'), 'bodyweight-squat-v1');
  assert.equal(poseEngineIdForExercise('wall-pushup'), 'wall-pushup-v1');
  assert.equal(poseEngineIdForExercise('standing-side-leg-raise'), 'side-leg-raise-v1');
});

// Guided-only movements must NOT map to a pose engine.
test('guided-only exercises do not map to a pose engine', () => {
  for (const id of GUIDED_ONLY_IDS) {
    assert.equal(poseEngineIdForExercise(id), null, `${id} must not be pose-tracked`);
  }
  assert.equal(modeForExercise('glute-bridge'), 'guided');
  assert.equal(modeForExercise('calf-raise'), 'guided');
  assert.equal(modeForExercise('bird-dog'), 'guided');
  assert.equal(modeForExercise('dead-bug'), 'guided');
  assert.equal(modeForExercise('wall-sit'), 'guided');
});

// Unknown ID must not silently resolve to squat.
test('unknown exercise ID does not silently resolve to the squat engine', () => {
  assert.equal(poseEngineIdForExercise('bogus'), null);
  assert.equal(exerciseById('bogus'), null, 'exerciseById must return null for an unknown id');
  assert.equal(exerciseById('does-not-exist'), null);
  // And the engine family used by the hook must never silently be squat.
  assert.notEqual(poseEngineIdForExercise('bird-dog'), 'bodyweight-squat-v1');
});

// The engine family is consistent: every mapped engine id really exists.
test('every mapped pose engine id resolves to a real exercise config', () => {
  for (const [catalogId, engineId] of Object.entries(POSE_ENGINE_BY_EXERCISE)) {
    assert.equal(POSE_ENGINE_IDS.has(engineId), true, `${catalogId} -> ${engineId} must be a known engine`);
    const config = exerciseById(engineId);
    assert.notEqual(config, null, `${engineId} must resolve`);
    assert.equal(config.id, engineId);
    // The chosen engine must actually instantiate a state machine.
    assert.doesNotThrow(() => createRepStateMachine(config, baseline));
  }
});

// Selected Wall push-up actually initializes the wall-pushup engine, NOT squat.
test('selecting Wall push-up initializes wall-pushup-v1 (not squat)', () => {
  const engineId = poseEngineIdForExercise('wall-pushup');
  assert.equal(engineId, 'wall-pushup-v1');
  const config = exerciseById(engineId);
  assert.equal(config.id, 'wall-pushup-v1');
  // Distinct engine: wall push-up reads elbow angle, not knee.
  assert.deepEqual(config.measurements, ['elbowAngle', 'elbowVelocity', 'hipDeviation']);
  const engine = createRepStateMachine(config, baseline);
  assert.equal(engine.snapshot().state, config.resetState);
});

// Selected target reps are preserved through the resolver.
test('selected target reps are preserved', () => {
  assert.equal(resolveTargetReps({}, 12, 8), 12);
  assert.equal(resolveTargetReps({}, 10, 8), 10);
  assert.equal(resolveTargetReps({}, 3, 8), 3);
  // No requested value falls back to the configured/default value.
  assert.equal(resolveTargetReps({}, undefined, 8), 8);
  assert.equal(resolveTargetReps({ thresholds: { targetReps: 15 } }, undefined, 8), 15);
  // Never zero or negative.
  assert.equal(resolveTargetReps({}, 0, 8), 8);
  assert.equal(resolveTargetReps({}, -3, 8), 8);
});

// Selected set count is preserved through the resolver.
test('selected set count is preserved', () => {
  assert.equal(normalizeSetCount(3), 3);
  assert.equal(normalizeSetCount(2), 2);
  assert.equal(normalizeSetCount('5'), 5);
  assert.equal(normalizeSetCount('2'), 2);
  // Invalid input clamps to one set rather than 0 or a negative count.
  assert.equal(normalizeSetCount(0), 1);
  assert.equal(normalizeSetCount(-4), 1);
  assert.equal(normalizeSetCount(undefined), 1);
  assert.equal(normalizeSetCount(null), 1);
});

// Unsupported movement routes to guided mode (explicit decision).
test('unsupported movement routes to guided mode', () => {
  assert.equal(modeForExercise('glute-bridge'), 'guided');
  assert.equal(modeForExercise('bird-dog'), 'guided');
  assert.equal(modeForExercise('wall-pushup'), 'pose');
  assert.equal(modeForExercise('bodyweight-squat'), 'pose');
  assert.equal(modeForExercise('standing-side-leg-raise'), 'pose');
});

// The mapping and guided-only sets fully partition the catalog (no gap).
test('every known catalog exercise is either pose-tracked or guided-only', () => {
  const catalog = ['bodyweight-squat', 'glute-bridge', 'calf-raise', 'wall-pushup', 'bird-dog', 'dead-bug', 'wall-sit', 'standing-side-leg-raise'];
  for (const id of catalog) {
    const trackable = supportsPoseTracking(id);
    const guidedOnly = GUIDED_ONLY_IDS.includes(id);
    assert.equal(trackable || guidedOnly, true, `${id} must be classified`);
  }
  // No catalog id should be both.
  for (const id of catalog) {
    assert.equal(supportsPoseTracking(id) && GUIDED_ONLY_IDS.includes(id), false, `${id} cannot be both`);
  }
});

// The tracked engine list has no surprises: exactly the three engines.
test('the implemented pose engine set is exactly the three tracked engines', () => {
  assert.deepEqual([...POSE_ENGINE_IDS].sort(), ['bodyweight-squat-v1', 'side-leg-raise-v1', 'wall-pushup-v1']);
  assert.deepEqual([...new Set(EXERCISES.map((e) => e.id))].sort(), ['bodyweight-squat-v1', 'side-leg-raise-v1', 'wall-pushup-v1']);
});
