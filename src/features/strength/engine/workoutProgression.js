// Pure workout-level progression decisions.
//
// The rep engine counts ONE set. The session orchestrator (web tracked hook)
// owns sets AND exercises. When a set completes, exactly one of three things
// happens next; this module is the single source of truth for that choice so
// the "one camera, one workout" transition can be unit-tested without a
// renderer.

const WORKOUT_REST_FALLBACK_SEC = 30;

/**
 * Decide what follows a completed set.
 * @param {{ currentSet: number, totalSets: number, hasNext: boolean }} input
 * @returns {'next-set' | 'workout-transition' | 'workout-complete'}
 *   'next-set'           more sets remain for this exercise
 *   'workout-transition' final set done AND the workout has a next exercise
 *                        (camera stays live; workout rest, then re-framing)
 *   'workout-complete'   final set done and this was the last exercise
 */
function decideOnSetComplete({ currentSet, totalSets, hasNext }) {
  const sets = Math.max(1, Math.floor(Number(totalSets) || 1));
  const set = Math.max(1, Math.floor(Number(currentSet) || 1));
  if (set < sets) return 'next-set';
  return hasNext ? 'workout-transition' : 'workout-complete';
}

/**
 * Normalise an exercise's configured rest seconds into a safe non-negative
 * integer. Unusable values fall back to the default rest length.
 */
function resolveRestSeconds(value, fallback = WORKOUT_REST_FALLBACK_SEC) {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  return Math.max(0, Math.floor(Number(fallback) || WORKOUT_REST_FALLBACK_SEC));
}

module.exports = {
  WORKOUT_REST_FALLBACK_SEC,
  decideOnSetComplete,
  resolveRestSeconds,
};
