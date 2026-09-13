const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const { normalizeHistory, historyStats } = require('../src/features/strength/data/sessionHistory');

// Load the shipped catalog and plan builders, not copied test fixtures.
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

const { EXERCISE_LIBRARY, exerciseById, LEVELS, FOCUS_AREAS } = loadData('exerciseLibrary.js');
const { WORKOUT_PLANS, exerciseSeconds, planMinutes, planEquipment, singleMovePlan } = loadData('workoutPlans.js');
const squat = exerciseById('bodyweight-squat');
const wallSit = exerciseById('wall-sit');
const completeDate = new Date(2026, 8, 12, 12, 0, 0).toISOString();
function input(overrides = {}) {
  return { id: 'session-1', reps: 10, durationSec: 60, completedAt: completeDate, ...overrides };
}

test('Strength history normalization emits only display fields and strips camera/runtime payloads', () => {
  const result = normalizeHistory(input({
    video: 'private', frames: ['private'], landmarks: [{ x: 0.2 }],
    runtime: { engine: 'private' }, bodyMetrics: { kneeAngle: 90 },
    providerKey: 'must-not-persist', unexpectedField: true,
  }), { exercise: squat, sets: 2, workoutId: 'run-1', workoutName: 'A workout' });
  assert.deepEqual(Object.keys(result).sort(), [
    'id', 'exerciseId', 'name', 'focus', 'mode', 'sessionMode', 'sets', 'reps',
    'holdSec', 'durationSec', 'completionState', 'completedAt', 'workoutId', 'workoutName',
  ].sort());
  assert.equal(result.exerciseId, squat.id);
  assert.equal(result.name, squat.name);
  assert.equal(result.workoutId, 'run-1');
});

test('Strength tracked history maps accepted reps and duration without trusting input exercise metadata', () => {
  const pushup = exerciseById('wall-pushup');
  const result = normalizeHistory({
    id: 'camera-1', exerciseId: 'bodyweight-squat-v1', name: 'Wrong movement',
    acceptedReps: 17, durationSeconds: 94.4, completedAt: completeDate,
  }, { exercise: pushup, sets: 3 });
  assert.equal(result.exerciseId, 'wall-pushup');
  assert.equal(result.name, pushup.name);
  assert.equal(result.sessionMode, 'pose');
  assert.equal(result.reps, 17);
  assert.equal(result.durationSec, 94);
});

test('Strength guided holds never invent rep counts', () => {
  const result = normalizeHistory(input({ reps: 100 }), { exercise: wallSit, sets: 2 });
  assert.equal(result.mode, 'hold');
  assert.equal(result.sessionMode, 'guided');
  assert.equal(result.reps, 0);
  assert.equal(result.holdSec, wallSit.holdSec);
});

test('Strength normalized counts reject negative and non-finite values and use integer sets', () => {
  for (const invalid of [-10, NaN, Infinity, 'not-a-number']) {
    const result = normalizeHistory(input({ reps: invalid, durationSec: invalid }), { exercise: squat, sets: invalid });
    assert.equal(result.reps, 0);
    assert.equal(result.durationSec, 0);
    assert.equal(result.sets, 1);
  }
  assert.equal(normalizeHistory(input({ reps: '12.8' }), { exercise: squat, sets: 2.8 }).reps, 12);
  assert.equal(normalizeHistory(input(), { exercise: squat, sets: 2.8 }).sets, 2);
  assert.equal(normalizeHistory(input(), { exercise: squat, sets: 20 }).sets, 5);
});

test('Strength history preserves stopped and abandoned outcomes without claiming completion', () => {
  for (const completionState of ['stopped', 'abandoned', 'completed']) {
    const result = normalizeHistory(input({ completionState }), { exercise: squat, sets: 3 });
    assert.equal(result.completionState, completionState);
  }
  assert.equal(normalizeHistory(input(), { exercise: squat }).completionState, 'completed');
});

test('Strength history requires an identifier and selected exercise', () => {
  assert.throws(() => normalizeHistory({}, { exercise: squat }), /could not be saved/i);
  assert.throws(() => normalizeHistory(input()), /could not be saved/i);
});

test('Strength history preserves distinct workout run identities for repeated plans', () => {
  const first = normalizeHistory(input({ id: 'movement-1' }), { exercise: squat, workoutId: 'run-1', workoutName: 'Everyday strength' });
  const repeat = normalizeHistory(input({ id: 'movement-2' }), { exercise: squat, workoutId: 'run-2', workoutName: 'Everyday strength' });
  assert.notEqual(first.workoutId, repeat.workoutId);
  assert.equal(first.workoutName, repeat.workoutName);
  assert.equal(historyStats([first, repeat]).sessions, 2, 'This statistic counts movement sessions, not distinct plan templates.');
});

test('Strength weekly stats use local calendar dates and exclude the eighth day', () => {
  const now = new Date(2026, 8, 12, 12, 0, 0);
  const records = [
    { completedAt: new Date(2026, 8, 12, 0, 1).toISOString(), durationSec: 60 },
    { completedAt: new Date(2026, 8, 12, 23, 59).toISOString(), durationSec: 120 },
    { completedAt: new Date(2026, 8, 6, 12).toISOString(), durationSec: 180 },
    { completedAt: new Date(2026, 8, 5, 12).toISOString(), durationSec: 240 },
    { completedAt: 'invalid', durationSec: 99999 },
    null,
  ];
  const stats = historyStats(records, now);
  assert.equal(stats.sessions, 4);
  assert.equal(stats.weekSessions, 3);
  assert.equal(stats.activeDays, 2);
  assert.equal(stats.weekMinutes, 6);
  assert.equal(stats.totalMinutes, 10);
  assert.equal(stats.days.length, 7);
  assert.deepEqual(stats.days.map(day => day.key), ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']);
  assert.equal(stats.days[0].count, 1);
  assert.equal(stats.days[6].count, 2);
  assert.equal(stats.days[6].seconds, 180);
});

test('Strength stats keep camera-counted reps separate from guided pacing', () => {
  const records = [
    normalizeHistory(input({ acceptedReps: 14, reps: undefined }), { exercise: squat }),
    normalizeHistory(input({ reps: 9 }), { exercise: squat }),
    normalizeHistory(input({ reps: 100 }), { exercise: wallSit }),
    { completedAt: completeDate, sessionMode: 'pose', reps: -100, durationSec: -50 },
    { completedAt: completeDate, sessionMode: 'guided', reps: NaN, durationSec: NaN },
  ];
  const stats = historyStats(records, new Date(completeDate));
  assert.equal(stats.measuredReps, 14);
  assert.equal(stats.pacedReps, 9);
  assert.equal(stats.totalMinutes, 3);
  assert.deepEqual(stats.areas, [['lower', 3]]);
});

test('Strength empty history has honest zero totals and seven empty calendar bars', () => {
  const stats = historyStats([], new Date(completeDate));
  for (const field of ['sessions', 'weekSessions', 'activeDays', 'weekMinutes', 'totalMinutes', 'measuredReps', 'pacedReps']) {
    assert.equal(stats[field], 0);
  }
  assert.deepEqual(stats.areas, []);
  assert.equal(stats.days.length, 7);
  assert.ok(stats.days.every(day => day.count === 0 && day.seconds === 0));
});

test('Strength plans reference only shipped exercises and supported effort and focus values', () => {
  assert.ok(WORKOUT_PLANS.length > 0);
  const catalogIds = new Set(EXERCISE_LIBRARY.map(exercise => exercise.id));
  const focusIds = new Set(FOCUS_AREAS.map(area => area.id));
  assert.equal(new Set(WORKOUT_PLANS.map(plan => plan.id)).size, WORKOUT_PLANS.length);
  for (const plan of WORKOUT_PLANS) {
    assert.ok(plan.exercises.length > 0, plan.id);
    assert.ok(LEVELS[plan.level], plan.id);
    assert.ok(focusIds.has(plan.focus), plan.id);
    for (const item of plan.exercises) {
      assert.ok(item.exercise && catalogIds.has(item.exercise.id), plan.id);
      assert.equal(item.exercise, exerciseById(item.exercise.id));
      assert.ok(Number.isInteger(item.sets) && item.sets >= 1 && item.sets <= 5, plan.id);
    }
  }
});

test('Strength single-move plans preserve the chosen exercise and set count', () => {
  const plan = singleMovePlan(squat, 4);
  assert.equal(plan.id, squat.id);
  assert.equal(plan.name, squat.name);
  assert.deepEqual(plan.exercises, [{ exercise: squat, sets: 4 }]);
});

test('Strength plan time estimates use whole safe set counts matching session normalization', () => {
  for (const exercise of EXERCISE_LIBRARY) {
    for (const value of [1, 2, 5, 2.8, 0, -1, 20, NaN, Infinity, 'invalid']) {
      const count = normalizeHistory(input(), { exercise, sets: value }).sets;
      const active = exercise.mode === 'hold' ? exercise.holdSec : exercise.defaultReps * exercise.tempoSec;
      const expected = active * count + exercise.restSec * (count - 1) + 3;
      assert.equal(exerciseSeconds(exercise, value), expected, exercise.id + ': ' + String(value));
    }
  }
});

test('Strength plan minutes include configured exercise work, rests, and movement transitions', () => {
  for (const plan of WORKOUT_PLANS) {
    const seconds = plan.exercises.reduce((sum, { exercise, sets }) => {
      const active = exercise.mode === 'hold' ? exercise.holdSec : exercise.defaultReps * exercise.tempoSec;
      return sum + active * sets + exercise.restSec * (sets - 1) + 3;
    }, 0) + (plan.exercises.length - 1) * 30;
    assert.equal(planMinutes(plan), Math.max(1, Math.ceil(seconds / 60)), plan.id);
  }
});

test('Strength plan equipment lists existing support needs without duplicates', () => {
  const repeatedWall = { exercises: [{ exercise: exerciseById('wall-pushup'), sets: 1 }, { exercise: wallSit, sets: 1 }] };
  assert.equal(planEquipment(repeatedWall), 'A stable wall');
  assert.equal(planEquipment(singleMovePlan(exerciseById('glute-bridge'))), 'Mat optional');
});
