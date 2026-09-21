const test = require('node:test');
const assert = require('node:assert/strict');
const { decideOnFocusLost, decideOnFocusGained } = require('../src/features/strength/engine/sessionRetention');

// Regression guard for the tab-switch data-loss bug: leaving Strength used to
// call resetRuntime() + setPhase('select'), destroying an active workout.
// Accepted reps, exercise, set, and the parent workout index must survive.

test('leaving Strength mid-set pauses without destroying the session', () => {
  assert.equal(decideOnFocusLost({ phase: 'active', started: true }), 'pause');
});

test('leaving Strength during the countdown rolls back to a fresh framing (never select)', () => {
  assert.equal(decideOnFocusLost({ phase: 'countdown', started: true }), 'rollback');
});

test('leaving Strength during rest keeps the wall-clock rest running', () => {
  assert.equal(decideOnFocusLost({ phase: 'between_sets', started: true }), 'keep');
  assert.equal(decideOnFocusLost({ phase: 'workout_rest', started: true }), 'keep');
});

test('leaving before the first set starts keeps setup (nothing to preserve yet)', () => {
  assert.equal(decideOnFocusLost({ phase: 'loading', started: false }), 'keep');
  assert.equal(decideOnFocusLost({ phase: 'calibrating', started: false }), 'keep');
  assert.equal(decideOnFocusLost({ phase: 'ready', started: false }), 'keep');
});

test('leaving while already paused keeps the pause', () => {
  assert.equal(decideOnFocusLost({ phase: 'paused', started: true }), 'keep');
});

test('no focus loss ever resets: reset is not a possible decision', () => {
  const phases = [
    'select', 'loading', 'calibrating', 'ready', 'countdown', 'active',
    'paused', 'resuming', 'between_sets', 'workout_rest', 'saving',
    'summary', 'save_error', 'permission',
  ];
  for (const phase of phases) {
    for (const started of [true, false]) {
      const decision = decideOnFocusLost({ phase, started });
      assert.ok(
        ['pause', 'rollback', 'keep'].includes(decision),
        `phase=${phase} started=${started} must not reset`,
      );
      assert.notEqual(decision, 'reset');
    }
  }
});

test('returning after a paused set offers the continue prompt', () => {
  assert.equal(decideOnFocusGained({ phase: 'paused', returning: true, started: true }), 'prompt');
});

test('returning after a rolled-back countdown offers the continue prompt', () => {
  assert.equal(decideOnFocusGained({ phase: 'ready', returning: true, started: true }), 'prompt');
});

test('returning with no pending interruption changes nothing', () => {
  assert.equal(decideOnFocusGained({ phase: 'ready', returning: false, started: true }), 'none');
  assert.equal(decideOnFocusGained({ phase: 'active', returning: true, started: true }), 'none');
  assert.equal(decideOnFocusGained({ phase: 'between_sets', returning: false, started: true }), 'none');
  assert.equal(decideOnFocusGained({ phase: 'select', returning: false, started: false }), 'none');
});

test('returning mid-calibration (pre-start) forces a fresh framing hold', () => {
  assert.equal(decideOnFocusGained({ phase: 'calibrating', returning: false, started: false }), 'reframe');
  assert.equal(decideOnFocusGained({ phase: 'ready', returning: false, started: false }), 'reframe');
});

test('round trip: active -> pause -> prompt keeps the run intact', () => {
  const lost = decideOnFocusLost({ phase: 'active', started: true });
  assert.equal(lost, 'pause');
  const gained = decideOnFocusGained({ phase: 'paused', returning: true, started: true });
  assert.equal(gained, 'prompt');
  // After the prompt, resuming re-enters through a framing hold, not a reset.
  const second = decideOnFocusLost({ phase: 'resuming', started: true });
  assert.equal(second, 'keep');
  const regained = decideOnFocusGained({ phase: 'resuming', returning: false, started: true });
  assert.equal(regained, 'none');
});
