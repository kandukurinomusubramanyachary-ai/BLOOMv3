// Single source of truth for which catalog exercises have a deterministic
// pose engine, and which engine they map to. Used by the web tracked flow and
// by the contract tests. Never guess exercise IDs.
//
// Written as CommonJS so both the Node test suite (require) and the babel/Metro
// app bundle (ESM named imports) can consume it.

const POSE_ENGINE_BY_EXERCISE = Object.freeze({
  'bodyweight-squat': 'bodyweight-squat-v1',
  'wall-pushup': 'wall-pushup-v1',
  'standing-side-leg-raise': 'side-leg-raise-v1',
});

// The pose engine IDs that are actually implemented. Anything absent from this
// set is NOT trackable and must route to the guided fallback.
const POSE_ENGINE_IDS = new Set([
  'bodyweight-squat-v1',
  'wall-pushup-v1',
  'side-leg-raise-v1',
]);

// Catalog exercises that are intentionally guided-only (no pose engine).
const GUIDED_ONLY_IDS = [
  'glute-bridge',
  'calf-raise',
  'bird-dog',
  'dead-bug',
  'wall-sit',
];

// Return the pose engine id for a catalog exercise, or null if unsupported.
function poseEngineIdForExercise(catalogExerciseId) {
  const id = POSE_ENGINE_BY_EXERCISE[catalogExerciseId];
  return id && POSE_ENGINE_IDS.has(id) ? id : null;
}

// Does this catalog exercise have a real deterministic pose engine?
function supportsPoseTracking(catalogExerciseId) {
  return poseEngineIdForExercise(catalogExerciseId) !== null;
}

// Explicit session mode decision: 'pose' when trackable, 'guided' otherwise.
function modeForExercise(catalogExerciseId) {
  return supportsPoseTracking(catalogExerciseId) ? 'pose' : 'guided';
}

// Preserve the user's chosen set count, clamped to a sane positive integer.
function normalizeSetCount(sets) {
  const n = Number(sets);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

// Resolve the per-set target reps from (in order of priority):
//   requested target (from the selected exercise/config) -> exercise config ->
//   STRENGTH_DEFAULTS target. Returns a positive integer.
function resolveTargetReps(exercise, requestedTargetReps, fallback) {
  const requested = Number(requestedTargetReps);
  if (Number.isFinite(requested) && requested > 0) return Math.floor(requested);
  const config = Number(exercise?.thresholds?.targetReps);
  if (Number.isFinite(config) && config > 0) return Math.floor(config);
  const fb = Number(fallback);
  return Number.isFinite(fb) && fb > 0 ? Math.floor(fb) : 8;
}

module.exports = {
  GUIDED_ONLY_IDS,
  POSE_ENGINE_BY_EXERCISE,
  POSE_ENGINE_IDS,
  modeForExercise,
  normalizeSetCount,
  poseEngineIdForExercise,
  resolveTargetReps,
  supportsPoseTracking,
};
