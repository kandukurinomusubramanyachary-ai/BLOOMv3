const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Run the actual hook with React, a navigation focus signal, deterministic
// timers and injected camera/storage boundaries. Rep accuracy has its own
// real-engine suite; these cases exercise the glue that pure helpers missed.
function sessionFixture(t, options = {}) {
  let focused = true;
  let current;
  let renderer;
  let clock = 10000;
  let timerId = 0;
  let rejectSave = Boolean(options.rejectSave);
  let props = { uid: 'test-owner', exerciseId: 'bodyweight-squat-v1', sets: 1, targetReps: 8, ...options.props };
  const timers = new Map();
  const listeners = new Map();
  const saves = [];
  const engines = [];
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const voice = new Proxy({ muted: false, available: false }, { get: (target, key) => key in target ? target[key] : () => {} });
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const mocks = {
    react: React,
    'react-native': { Platform: { OS: 'web' } },
    '@react-navigation/native': {
      useIsFocused: () => focused,
      useFocusEffect: fn => React.useEffect(() => focused ? fn() : undefined, [focused, fn]),
    },
    './engine/positioningCoach': { createPositioningCoach: () => ({ process: () => ({ ready: true, ok: true, shouldPublish: true, instruction: 'In view' }) }) },
    './engine/cueScheduler': { createCueScheduler: () => ({ snapshot: () => ({ slowDown: 1 }), schedule: () => null }) },
    './engine/repStateMachine': { createRepStateMachine: () => {
      let reps = 0;
      const engine = {
        snapshot: () => ({ reps }), interrupt() {},
        process: frame => ({ events: frame.accept ? [{ type: 'repAccepted', count: ++reps, durationMs: 1500 }] : [] }),
      };
      engines.push(engine);
      return engine;
    } },
    './services/voiceCoach': { createVoiceCoach: () => voice },
    './services/strengthAnalytics': { trackStrengthEvent() {} },
    './services/strengthStorage': {
      flushStrengthOutbox: async () => {},
      saveStrengthSummary: async (uid, summary) => {
        saves.push({ uid, summary });
        if (rejectSave) throw new Error('Device storage unavailable');
        return { summary, synced: false };
      },
    },
  };
  const filename = path.resolve(__dirname, '../src/features/strength/useStrengthSession.web.js');
  const transformed = babel.transformFileSync(filename, { babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]] });
  const mod = { exports: {} };
  const load = name => mocks[name] || (name.startsWith('.') ? require(path.resolve(path.dirname(filename), name)) : require(name));
  new Function('require', 'module', 'exports', 'document', 'setTimeout', 'clearTimeout', 'Date', transformed.code)(
    load, mod, mod.exports, document,
    (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: clock + delay }); return id; },
    id => timers.delete(id), ClockDate,
  );
  function Harness() { current = mod.exports.default(props); return null; }
  act(() => { renderer = create(React.createElement(Harness)); });
  t.after(() => act(() => renderer.unmount()));
  const update = () => renderer.update(React.createElement(Harness));
  const call = (name, ...args) => act(() => { current[name](...args); });
  const frame = (accept = false) => call('onFrame', {
    ts: clock, accept, poseCount: 1, sourceWidth: 640, sourceHeight: 480,
    landmarks: Array.from({ length: 33 }, (_, id) => ({ id, x: 0.5, y: id / 36, visibility: 1 })),
  });
  const advance = ms => {
    const end = clock + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      clock = next[1].at; timers.delete(next[0]); act(() => next[1].fn());
    }
    clock = end;
  };
  const setup = () => { call('beginCamera'); call('cameraReady'); frame(); };
  return {
    get session() { return current; }, saves, engines, call, frame, advance, setup,
    start: () => { setup(); call('startCountdown'); advance(3000); assert.equal(current.phase, 'active'); },
    focus: value => act(() => { focused = value; update(); }),
    hide: value => act(() => { document.hidden = value; listeners.get('visibilitychange')(); }),
    props: patch => act(() => { props = { ...props, ...patch }; update(); }),
    allowSave: () => { rejectSave = false; },
    settle: () => act(async () => { await Promise.resolve(); await Promise.resolve(); }),
  };
}

test('actual tracked hook pauses on tab blur, preserves reps, and reframes on return', async t => {
  const f = sessionFixture(t); f.start(); f.frame(true); f.frame(true);
  assert.equal(f.session.reps, 2);
  f.focus(false);
  assert.equal(f.session.phase, 'paused');
  assert.equal(f.session.inferenceActive, false);
  f.frame(true);
  assert.equal(f.session.reps, 2);
  f.hide(true); f.hide(false); // Page visibility cannot override navigation blur.
  assert.equal(f.session.inferenceActive, false);
  f.focus(true);
  assert.equal(f.session.phase, 'resuming');
  f.call('beginResume'); f.frame(); f.advance(3000);
  assert.equal(f.session.phase, 'active');
  assert.equal(f.session.reps, 2);
  f.frame(true);
  assert.equal(f.session.reps, 3);
});

test('first-set countdown cannot start a workout while the page is hidden', t => {
  const f = sessionFixture(t); f.setup(); f.call('startCountdown');
  f.hide(true); f.advance(5000);
  assert.equal(f.session.phase, 'ready');
  assert.equal(f.session.hasProgress, false);
  assert.equal(f.session.inferenceActive, false);
  f.hide(false);
  assert.equal(f.session.phase, 'calibrating');
  f.frame();
  assert.equal(f.session.phase, 'ready');
});

test('returning from a ready screen can calibrate again instead of getting stuck', t => {
  const f = sessionFixture(t); f.setup();
  assert.equal(f.session.phase, 'ready');
  f.focus(false); f.focus(true);
  assert.equal(f.session.phase, 'calibrating');
  f.frame(); assert.equal(f.session.phase, 'ready');
});

test('failed save shows the retry phase and retries the same summary without losing reps', async t => {
  const f = sessionFixture(t, { rejectSave: true }); f.start(); f.frame(true); f.frame(true);
  f.call('stop'); await f.settle();
  assert.equal(f.session.phase, 'save_error');
  assert.match(f.session.summaryError, /try again/i);
  assert.equal(f.session.cameraActive, false);
  f.allowSave(); f.call('retrySummary'); await f.settle();
  assert.equal(f.session.phase, 'summary');
  assert.equal(f.session.summaryResult.summary.acceptedReps, 2);
  assert.equal(f.saves.length, 2);
  assert.equal(f.saves[0].summary.id, f.saves[1].summary.id);
});

test('exercise transition cannot continue through a save failure and preserves cue totals', async t => {
  const f = sessionFixture(t, { rejectSave: true, props: { hasNext: true, targetReps: 1 } });
  f.start(); f.frame(true); await f.settle();
  assert.equal(f.session.phase, 'workout_rest');
  assert.ok(f.session.transitionSaveError);
  f.call('continueAfterRest');
  assert.equal(f.session.phase, 'workout_rest');
  assert.deepEqual(f.saves[0].summary.cueCounts, { slowDown: 1 });
  f.allowSave(); f.call('retryTransitionSave'); await f.settle();
  assert.equal(f.saves[0].summary.id, f.saves[1].summary.id);
  f.call('continueAfterRest'); // Parent has not advanced yet.
  assert.equal(f.session.phase, 'workout_rest');
  f.props({ exerciseId: 'wall-pushup-v1' });
  f.frame(); f.call('continueAfterRest');
  assert.equal(f.session.phase, 'countdown');
});
