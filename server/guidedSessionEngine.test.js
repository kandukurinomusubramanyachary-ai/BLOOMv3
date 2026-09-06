const test = require('node:test');
const assert = require('node:assert/strict');

// Live-guarded Strength session engine (the camera-free guided timing machine
// that the app actually runs). Pure reducer — no React, no timers — so it is
// deterministic and directly testable. This is the seam the previous test
// suite did NOT cover (it only tested the orphaned camera engine).
const {
  COUNTDOWN_SEC,
  initialState,
  reducer,
} = require('../src/features/strength/guidedSessionEngine');

const REPS = { mode: 'reps', defaultReps: 3, tempoSec: 2, restSec: 0, holdSec: 0 };
const HOLD = { mode: 'hold', defaultReps: 0, holdSec: 5, restSec: 0, tempoSec: 2 };

function setOf(s, n) {
  return { ...s, setsPlanned: n };
}
function step(state, deltaMs) {
  return reducer(state, { type: 'TICK', delta: deltaMs });
}
function start(s) {
  return reducer(s, { type: 'START' });
}
function clearCountdown(state, seconds = COUNTDOWN_SEC * 1000) {
  let s = state;
  // drive countdown to active (beginSet) by ticking past the 3s countdown
  s = step(s, seconds);
  return s;
}

test('initial state reflects the exercise and set plan', () => {
  const s = initialState(REPS, 2);
  assert.equal(s.phase, 'idle');
  assert.equal(s.setsPlanned, 2);
  assert.equal(s.repsPerSet, 3);
  assert.equal(s.totalRepsPlanned, 6);
  assert.equal(s.currentSet, 1);
  assert.equal(s.currentRep, 0);
  assert.equal(s.totalRepsDone, 0);
  assert.equal(s.startedAt, null);
});

test('hold mode plans no reps', () => {
  const s = initialState(HOLD, 3);
  assert.equal(s.repsPerSet, 0);
  assert.equal(s.totalRepsPlanned, 0);
});

test('START enters countdown with the fixed countdown and resets counters', () => {
  let s = start(initialState(REPS, 2));
  assert.equal(s.phase, 'countdown');
  assert.equal(s.remaining, COUNTDOWN_SEC);
  assert.equal(s.totalRepsDone, 0);
  assert.equal(s.lastEvent, 'start');
  assert.equal(typeof s.startedAt, 'number');
});

test('countdown ticks down then transitions to the active set', () => {
  let s = start(initialState(REPS, 2));
  s = step(s, 1000);
  assert.equal(s.phase, 'countdown');
  assert.ok(s.remaining < COUNTDOWN_SEC);
  s = step(s, COUNTDOWN_SEC * 1000); // past the 3s countdown
  assert.equal(s.phase, 'active');
  assert.equal(s.currentRep, 0);
  assert.equal(s.lastEvent, 'set-start');
});

test('reps advance deterministically by tempo and never double-count', () => {
  let s = clearCountdown(start(initialState(REPS, 2)));
  assert.equal(s.phase, 'active');

  // tempoSec=2 → a full rep every 2000ms of ticked time.
  s = step(s, 2000);
  assert.equal(s.currentRep, 1);
  assert.equal(s.totalRepsDone, 1);

  s = step(s, 2000);
  assert.equal(s.currentRep, 2);
  assert.equal(s.totalRepsDone, 2);

  // completing the 3rd rep of the set → rest, into set 2
  s = step(s, 2000);
  assert.equal(s.currentRep, 3);
  assert.equal(s.totalRepsDone, 3);
  assert.equal(s.phase, 'rest');
  assert.equal(s.currentSet, 2);
});

test('rest can be skipped into the next set and resets the rep counter', () => {
  let s = clearCountdown(start(initialState(REPS, 2)));
  s = step(s, 2000); s = step(s, 2000); s = step(s, 2000); // finish set 1 → rest
  assert.equal(s.phase, 'rest');
  s = reducer(s, { type: 'SKIP_REST' });
  assert.equal(s.phase, 'active');
  assert.equal(s.currentRep, 0);
  assert.equal(s.currentSet, 2);
});

test('a two-set workout completes with exactly the planned total reps', () => {
  let s = clearCountdown(start(initialState(REPS, 2)));
  const repMs = 2000;
  for (let set = 0; set < 2; set += 1) {
    for (let rep = 0; rep < 3; rep += 1) s = step(s, repMs);
    if (set === 0) {
      assert.equal(s.phase, 'rest');
      s = reducer(s, { type: 'SKIP_REST' });
    }
  }
  assert.equal(s.phase, 'complete');
  assert.equal(s.totalRepsDone, 6); // 3 per set × 2 sets, no double counts
  assert.equal(s.totalRepsPlanned, 6);
});

test('hold mode counts down the hold and completes without counting reps', () => {
  let s = clearCountdown(start(initialState(HOLD, 1)));
  assert.equal(s.phase, 'active');
  assert.equal(s.remaining, 5);
  s = step(s, 5000);
  assert.equal(s.phase, 'complete');
  assert.equal(s.totalRepsDone, 0);
  assert.equal(s.totalRepsPlanned, 0);
});

test('pause freezes elapsed time and resume returns to the typed phase', () => {
  let s = clearCountdown(start(initialState(REPS, 2)));
  s = step(s, 2000); // 1 rep, time elapsed = 2s
  assert.ok(s.elapsedSec > 0);
  s = reducer(s, { type: 'PAUSE' });
  assert.equal(s.phase, 'paused');
  assert.equal(s.resumePhase, 'active');
  const before = s.elapsedSec;
  s = step(s, 5000); // ticking while paused
  assert.equal(s.elapsedSec, before); // no time advances while paused
  s = reducer(s, { type: 'RESUME' });
  assert.equal(s.phase, 'active');
  assert.equal(s.resumePhase, null);
});

test('pause during countdown resumes into countdown, not active', () => {
  let s = start(initialState(REPS, 2));
  s = reducer(s, { type: 'PAUSE' });
  assert.equal(s.resumePhase, 'countdown');
  s = reducer(s, { type: 'RESUME' });
  assert.equal(s.phase, 'countdown');
});

test('RESET returns to idle and re-initialises for a new exercise', () => {
  let s = clearCountdown(start(initialState(REPS, 2)));
  s = step(s, 2000); // some progress
  s = reducer(s, { type: 'RESET', exercise: HOLD, sets: 3 });
  assert.equal(s.phase, 'idle');
  assert.equal(s.exerciseId, HOLD.id || null);
  assert.equal(s.setsPlanned, 3);
  assert.equal(s.totalRepsDone, 0);
  assert.equal(s.startedAt, null);
});

test('SKIP_REST is a no-op outside the rest phase', () => {
  let s = clearCountdown(start(initialState(REPS, 2)));
  assert.equal(s.phase, 'active');
  const after = reducer(s, { type: 'SKIP_REST' });
  assert.equal(after.phase, 'active');
});

test('a single-set workout completes directly with no rest', () => {
  let s = clearCountdown(start(initialState(REPS, 1)));
  s = step(s, 2000); s = step(s, 2000); s = step(s, 2000);
  assert.equal(s.phase, 'complete');
  assert.equal(s.totalRepsDone, 3);
});
