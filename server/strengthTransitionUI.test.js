const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const colors = new Proxy({}, { get: () => '#333333' });
const theme = { STRENGTH_TYPE: {}, useStrengthStyles: sheet => ({ colors, styles: sheet(colors) }) };
const Frame = props => React.createElement('Frame', {}, props.header, props.children, props.footer);
const ui = Object.fromEntries(['StrengthButton', 'StrengthHeader', 'StrengthNote', 'SetProgress', 'StrengthEmpty', 'StrengthSkeleton'].map(name => [name, name]));
ui.StrengthScreenFrame = Frame;
const native = {
  Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'web' }, BackHandler: { addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  Animated: { Value: class { stopAnimation() {} setValue() {} }, Text: 'Text' }, Easing: {},
};

function load(filename, mocks, timerCallbacks = []) {
  const absolute = path.resolve(__dirname, '../src/features/strength', filename);
  const transformed = babel.transformFileSync(absolute, { babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]] });
  const mod = { exports: {} };
  const dependencies = { react: React, 'react-native': native, './strengthTheme': theme, './components/StrengthUI': ui, ...mocks };
  const localRequire = name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('./components/') || name.endsWith('/Icon')) return name;
    return name.startsWith('.') ? require(path.resolve(path.dirname(absolute), name)) : require(name);
  };
  new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', transformed.code)(
    localRequire, mod, mod.exports, fn => { timerCallbacks.push(fn); return timerCallbacks.length; }, () => {},
  );
  return mod.exports.default;
}

test('tracked transition waits for history persistence, exposes retry and advances exactly once', async t => {
  let rejectHistory = true;
  const completed = [];
  let advances = 0;
  let starts = 0;
  const timers = [];
  const exercise = { id: 'bodyweight-squat', name: 'Bodyweight squat', restSec: 0 };
  const result = { summary: { id: 'finished-move', acceptedReps: 16, totalSets: 2, completedSets: 2, completionState: 'completed' } };
  const session = {
    phase: 'workout_rest', currentSet: 1, totalSets: 2, reps: 0, cameraActive: true,
    summaryResult: result, hasProgress: true, transitionSaving: false,
    continueAfterRest: () => { starts++; },
  };
  const Component = load('TrackedStrengthScreen.web.js', {
    '../../context/AuthContext': { useAuth: () => ({ user: { uid: 'owner' } }) },
    '../../components/Motion': { useReducedMotion: () => true },
    './useStrengthSession.web': () => session,
  }, timers);
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Component, {
      exercise, sets: 2, nextExercise: { exercise: { id: 'wall-pushup', name: 'Wall push-up' } },
      onEndWorkout() {}, onAdvance: () => { advances++; },
      onComplete: async (...args) => { completed.push(args); if (rejectHistory) throw new Error('Device full'); },
    }));
  });
  t.after(() => act(() => renderer.unmount()));
  const button = title => renderer.root.findAllByType('StrengthButton').find(node => node.props.title === title);
  assert.equal(advances, 0);
  assert.equal(button('Finish workout').props.disabled, true);
  assert.ok(button('Retry workout history save'));
  act(() => { timers.forEach(fn => fn()); });
  assert.equal(starts, 0, 'expired rest must not start movement automatically');
  rejectHistory = false;
  await act(async () => { await button('Retry workout history save').props.onPress(); });
  assert.equal(advances, 1);
  assert.equal(completed.length, 2);
  for (const [history, metadata] of completed) {
    assert.equal(history.id, 'finished-move');
    assert.equal(history.exerciseId, 'bodyweight-squat');
    assert.equal(metadata.exercise, exercise);
  }
  assert.equal(button('Finish workout').props.disabled, false);
});

test('a camera-to-guided workout uses a saved summary before mounting the next player', async t => {
  const squat = { id: 'bodyweight-squat', name: 'Squat', mode: 'reps', defaultReps: 8, focus: 'lower' };
  const bridge = { id: 'glute-bridge', name: 'Bridge', mode: 'reps', defaultReps: 8, focus: 'lower' };
  const plan = { id: 'everyday-strength', name: 'Test workout', level: 'steady', focus: 'full', exercises: [{ exercise: squat, sets: 1 }, { exercise: bridge, sets: 1 }] };
  const local = { getStrengthSessions: async () => [], saveStrengthSession: async record => [record] };
  const navigation = { setOptions() {} };
  const Component = load('StrengthExperience.js', {
    '@react-navigation/native': { useNavigation: () => navigation },
    '../../context/AuthContext': { useAuth: () => ({ user: { uid: 'transition-test' } }) },
    '../../services/storage': { storage: { forUser: () => local } },
    './data/exerciseLibrary': { EXERCISE_LIBRARY: [squat, bridge], FOCUS_AREAS: [], LEVELS: { steady: { label: 'Steady' } } },
    './data/workoutPlans': { WORKOUT_PLANS: [plan], planMinutes: () => 5, planEquipment: () => '', singleMovePlan: exercise => ({ ...plan, exercises: [{ exercise, sets: 1 }] }) },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Component, { TrackedPlayer: 'TrackedPlayer' })); });
  t.after(() => act(() => renderer.unmount()));
  const press = title => act(() => { renderer.root.findAllByType('StrengthButton').find(node => node.props.title === title).props.onPress(); });
  press('View today’s workout'); press('Start workout');
  const tracked = renderer.root.findByType('TrackedPlayer');
  assert.equal(tracked.props.exercise.id, 'bodyweight-squat');
  assert.equal(tracked.props.nextExercise, undefined, 'a guided move must never keep a pose transition alive');
  assert.equal(tracked.props.onAdvance, undefined);
  assert.equal(tracked.props.nextLabel, 'Next exercise');
  await act(async () => { await tracked.props.onComplete({ id: 'saved-squat', sessionMode: 'pose', reps: 8, completionState: 'completed' }); });
  act(() => tracked.props.onNext());
  press('I’m ready');
  const guided = renderer.root.findByType('./components/SessionPlayer');
  assert.equal(guided.props.exercise.id, 'glute-bridge');
  assert.equal(renderer.root.findAllByType('TrackedPlayer').length, 0);
});
