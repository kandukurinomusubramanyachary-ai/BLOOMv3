const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadCoach(filename) {
  const transformed = babel.transformFileSync(path.resolve(__dirname, '../src/features/strength/services', filename), {
    babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', transformed.code)(require, module, module.exports);
  return module.exports.createVoiceCoach;
}
const createVoiceCoach = loadCoach('voiceCoach.web.js');

function fixture(t, options = {}) {
  const calls = [];
  const listeners = new Map();
  const saved = new Map();
  let current = null;
  let timestamp = 1000;
  let voices = options.voices || [{ lang: 'en-GB', name: 'English' }];
  let cancellations = 0;
  const env = {
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
      resume() {},
      speak(utterance) { assert.equal(current, null, 'speech must never overlap'); current = utterance; calls.push(utterance); },
      cancel() { cancellations++; current = null; },
    },
  };
  const create = () => {
    const coach = createVoiceCoach({ env, now: () => timestamp, minimumGapMs: 0, ...options });
    t.after(() => coach.dispose());
    return coach;
  };
  return {
    env, calls, listeners, saved, create, coach: create(),
    get cancellations() { return cancellations; },
    advance(ms) { timestamp += ms; },
    finish() { const previous = current; current = null; previous?.onend(); },
    loadVoices(next) { voices = next; listeners.get('voiceschanged')?.(); },
  };
}

test('speech starts synchronously in the intentional activation and waits silently beforehand', t => {
  const f = fixture(t);
  assert.equal(f.coach.speak('Too early'), false);
  assert.equal(f.calls.length, 0);
  assert.equal(f.listeners.size, 0, 'rendering the coach has no event listener side effects');
  f.coach.activate('Starting in three.');
  assert.equal(f.calls[0].text, 'Starting in three.');
  assert.equal(f.calls[0].voice.lang, 'en-GB');
});

test('empty mobile voice lists use the OS default immediately and select a loaded English voice later', t => {
  const f = fixture(t, { voices: [] });
  f.coach.activate('Ready.');
  assert.equal(f.calls[0].voice, undefined);
  f.finish();
  f.loadVoices([{ lang: 'fr-FR' }, { lang: 'en-IN', name: 'India English' }]);
  f.coach.speak('Begin your set.');
  assert.equal(f.calls[1].voice.lang, 'en-IN');
  assert.equal(f.calls[1].lang, 'en-IN');
});

test('rapid repeated pose cues stay bounded, deduplicated and behind higher priority cues', t => {
  const f = fixture(t);
  f.coach.activate('Ready.');
  for (let index = 0; index < 100; index++) {
    f.coach.speak('Keep your torso steady.', { id: 'torso', channel: 'form', priority: 70 });
    f.coach.speak('Halfway.', { id: 'halfway', channel: 'milestone', priority: 30, dropIfBusy: true });
  }
  assert.equal(f.calls.length, 1);
  f.finish();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].text, 'Keep your torso steady.');
  f.finish();
  assert.equal(f.calls.length, 2);
  assert.equal(f.coach.speak('Keep your torso steady.', { id: 'torso' }), false);
  f.advance(10001);
  assert.equal(f.coach.speak('Keep your torso steady.', { id: 'torso' }), true);
});

test('important set transitions cancel obsolete speech and late callbacks cannot clear the new cue', t => {
  const f = fixture(t);
  f.coach.activate('Keep moving.');
  const old = f.calls[0];
  f.coach.speak('Old form cue.', { channel: 'form' });
  f.coach.speak('Set complete.', { channel: 'session', priority: 100, interrupt: true });
  assert.equal(f.calls[1].text, 'Set complete.');
  old.onend();
  assert.equal(f.calls.length, 2);
  f.finish();
  assert.equal(f.calls.length, 2, 'interrupted form cues must not replay after completion');
});

test('routine cues respect the speech gap even if short utterances end immediately', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { minimumGapMs: 3000 });
  f.coach.activate('Ready.');
  f.finish();
  f.coach.speak('Keep a comfortable pace.');
  f.advance(2999);
  t.mock.timers.tick(2999);
  assert.equal(f.calls.length, 1);
  f.advance(1);
  t.mock.timers.tick(1);
  assert.equal(f.calls.length, 2);
});

test('resolved conditions and expired queues never speak stale positioning guidance', t => {
  const f = fixture(t);
  f.coach.activate('Ready.');
  f.coach.speak('Step back.', { channel: 'positioning' });
  f.coach.clearChannel('positioning');
  f.finish();
  assert.equal(f.calls.length, 1);
  f.coach.activate('Begin.');
  f.coach.speak('Old condition.', { ttlMs: 1000 });
  f.advance(1001);
  f.finish();
  assert.equal(f.calls.length, 2);
});

test('resolving an active positioning cue stops it and preserves useful queued session speech', t => {
  const f = fixture(t);
  f.coach.activate('Step back.', { channel: 'positioning' });
  const stale = f.calls[0];
  f.coach.speak('Ready for your next set.', { channel: 'session', priority: 90 });
  f.coach.clearChannel('positioning');
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].text, 'Ready for your next set.');
  stale.onend();
  assert.equal(f.calls.length, 2);
});

test('mute cancels speech, persists on refresh, and intentional unmute restores future cues', t => {
  const f = fixture(t);
  f.coach.activate('Ready.');
  f.coach.setMuted(true);
  assert.equal(f.coach.speak('Must stay silent.'), false);
  const reopened = f.create();
  assert.equal(reopened.muted, true);
  reopened.activate('Still silent.');
  assert.equal(f.calls.length, 1);
  reopened.setMuted(false);
  reopened.activate('Voice guidance on.');
  f.finish();
  reopened.speak('Future guidance.');
  assert.equal(f.calls.at(-1).text, 'Future guidance.');
});

test('pause flushes exercise cues and resume restores only current guidance', t => {
  const f = fixture(t);
  f.coach.activate('Ready.');
  f.coach.speak('Stale form cue.');
  f.coach.pause('Paused. Take your time.');
  assert.equal(f.calls.at(-1).text, 'Paused. Take your time.');
  f.finish();
  assert.equal(f.coach.speak('Inappropriate movement cue.'), false);
  f.coach.resume('Resuming.');
  assert.equal(f.calls.at(-1).text, 'Resuming.');
  f.finish();
  f.coach.speak('Current guidance.');
  assert.equal(f.calls.at(-1).text, 'Current guidance.');
});

test('leaving a workout removes voice listeners, timers and queued speech', t => {
  const f = fixture(t);
  f.coach.activate('Ready.');
  const utterance = f.calls[0];
  f.coach.speak('Queued.');
  f.coach.dispose();
  assert.equal(f.listeners.size, 0);
  utterance.onend();
  assert.equal(f.calls.length, 1);
  assert.equal(f.coach.speak('After leaving.'), false);
  f.coach.resume('Re-entered after a new gesture.');
  assert.equal(f.calls.at(-1).text, 'Re-entered after a new gesture.');
});

test('mobile not-allowed failures clear stale cues and permit retry from a later gesture', t => {
  const f = fixture(t);
  f.coach.activate('First try.');
  f.coach.speak('Stale queue.');
  f.calls[0].onerror({ error: 'not-allowed' });
  assert.equal(f.coach.speak('Still blocked.'), false);
  f.coach.activate('Try again after tapping Start.');
  assert.equal(f.calls.at(-1).text, 'Try again after tapping Start.');
});

test('unsupported speech and throwing storage or browser speech APIs never block Strength', t => {
  for (const create of [createVoiceCoach, loadCoach('voiceCoach.js')]) {
    const coach = create({ env: {} });
    assert.equal(coach.available, false);
    assert.equal(coach.activate('Ready.'), false);
    assert.equal(coach.speak('No API.'), false);
    assert.doesNotThrow(() => { coach.pause(); coach.resume(); coach.setMuted(true); coach.dispose(); });
  }
  const f = fixture(t);
  f.env.localStorage.getItem = f.env.localStorage.setItem = () => { throw new Error('storage denied'); };
  f.env.speechSynthesis.getVoices = f.env.speechSynthesis.addEventListener = f.env.speechSynthesis.speak = () => { throw new Error('speech unavailable'); };
  const coach = f.create();
  assert.doesNotThrow(() => { coach.activate('Ready.'); coach.setMuted(true); coach.pause(); coach.dispose(); });
});
