// Deterministic, camera-free guided-workout timing engine (pure logic).
//
// This is the single source of truth for the LIVE Strength session state
// machine. `useGuidedSession.js` (React) is a thin wrapper that devolves the
// reducer here. It is intentionally framework-free so it can be unit-tested
// directly (see server/guidedSessionEngine.test.js) without a renderer.
//
// Phases: 'idle' → 'countdown' → 'active' → 'rest' → (loop) → 'complete'.
// 'paused' is a non-ticking overlay that remembers the phase to resume into.

const COUNTDOWN_SEC = 3;
const TICK_MS = 100;

function totalRepsPlanned(exercise, sets) {
  if (!exercise) return 0;
  if (exercise.mode === 'hold') return 0;
  return (exercise.defaultReps || 0) * sets;
}

function initialState(exercise, sets) {
  return {
    phase: 'idle',
    exerciseId: exercise?.id || null,
    setsPlanned: sets,
    repsPerSet: exercise?.mode === 'hold' ? 0 : (exercise?.defaultReps || 0),
    holdSec: exercise?.holdSec || 0,
    tempoSec: exercise?.tempoSec || 4,
    restSec: exercise?.restSec || 40,
    mode: exercise?.mode || 'reps',
    currentSet: 1,
    currentRep: 0,
    // seconds remaining in the current sub-phase (countdown / rest / hold)
    remaining: 0,
    // 0..1 progress of the CURRENT rep (reps mode) — drives the tempo pulse
    repProgress: 0,
    totalRepsDone: 0,
    totalRepsPlanned: totalRepsPlanned(exercise, sets),
    startedAt: null,
    elapsedSec: 0,
    lastEvent: null, // 'rep' | 'set-complete' | 'rest-start' | 'complete' | 'start'
    eventNonce: 0,
  };
}

function beginSet(state) {
  if (state.mode === 'hold') {
    return {
      ...state,
      phase: 'active',
      currentRep: 0,
      repProgress: 0,
      remaining: state.holdSec,
      lastEvent: 'set-start',
      eventNonce: state.eventNonce + 1,
    };
  }
  return {
    ...state,
    phase: 'active',
    currentRep: 0,
    repProgress: 0,
    lastEvent: 'set-start',
    eventNonce: state.eventNonce + 1,
  };
}

function finishWorkout(state) {
  return {
    ...state,
    phase: 'complete',
    repProgress: 0,
    remaining: 0,
    lastEvent: 'complete',
    eventNonce: state.eventNonce + 1,
  };
}

function completeSet(state) {
  const wasLastSet = state.currentSet >= state.setsPlanned;
  if (wasLastSet) {
    return finishWorkout({
      ...state,
      lastEvent: 'set-complete',
      eventNonce: state.eventNonce + 1,
    });
  }
  return {
    ...state,
    phase: 'rest',
    currentSet: state.currentSet + 1,
    remaining: state.restSec,
    repProgress: 0,
    lastEvent: 'rest-start',
    eventNonce: state.eventNonce + 1,
  };
}

function applyTick(state, deltaMs) {
  const delta = deltaMs / 1000;
  const elapsedSec = state.elapsedSec + (state.phase !== 'paused' ? delta : 0);

  if (state.phase === 'countdown') {
    const remaining = state.remaining - delta;
    if (remaining <= 0) return beginSet({ ...state, elapsedSec });
    return { ...state, remaining, elapsedSec };
  }

  if (state.phase === 'rest') {
    const remaining = state.remaining - delta;
    if (remaining <= 0) return beginSet({ ...state, elapsedSec });
    return { ...state, remaining, elapsedSec };
  }

  if (state.phase === 'active') {
    if (state.mode === 'hold') {
      const remaining = state.remaining - delta;
      if (remaining <= 0) return completeSet({ ...state, elapsedSec });
      return { ...state, remaining, elapsedSec };
    }

    // reps mode — advance rep progress by tempo
    const perRep = Math.max(1, state.tempoSec);
    let repProgress = state.repProgress + delta / perRep;
    let currentRep = state.currentRep;
    let totalRepsDone = state.totalRepsDone;
    let lastEvent = state.lastEvent;
    let eventNonce = state.eventNonce;

    if (repProgress >= 1) {
      repProgress -= 1;
      currentRep += 1;
      totalRepsDone += 1;
      lastEvent = 'rep';
      eventNonce += 1;
      if (currentRep >= state.repsPerSet) {
        return completeSet({
          ...state,
          currentRep,
          totalRepsDone,
          repProgress: 0,
          elapsedSec,
          lastEvent: 'rep',
          eventNonce,
        });
      }
    }
    return { ...state, repProgress, currentRep, totalRepsDone, elapsedSec, lastEvent, eventNonce };
  }

  return { ...state, elapsedSec };
}

function reducer(state, action) {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        phase: 'countdown',
        remaining: COUNTDOWN_SEC,
        currentSet: 1,
        currentRep: 0,
        repProgress: 0,
        totalRepsDone: 0,
        startedAt: Date.now(),
        elapsedSec: 0,
        lastEvent: 'start',
        eventNonce: state.eventNonce + 1,
      };
    case 'TICK':
      return applyTick(state, action.delta);
    case 'PAUSE':
      return state.phase === 'active' || state.phase === 'rest' || state.phase === 'countdown'
        ? { ...state, phase: 'paused', resumePhase: state.phase }
        : state;
    case 'RESUME':
      return state.phase === 'paused'
        ? { ...state, phase: state.resumePhase || 'active', resumePhase: null }
        : state;
    case 'SKIP_REST':
      return state.phase === 'rest' ? beginSet(state) : state;
    case 'RESET':
      return initialState(action.exercise, action.sets);
    default:
      return state;
  }
}

module.exports = {
  COUNTDOWN_SEC,
  TICK_MS,
  totalRepsPlanned,
  initialState,
  beginSet,
  finishWorkout,
  completeSet,
  applyTick,
  reducer,
};
