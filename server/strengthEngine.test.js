const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepStateMachine } = require('../src/features/strength/engine/repStateMachine');
const { createCueScheduler } = require('../src/features/strength/engine/cueScheduler');
const { createLandmarkSmoother } = require('../src/features/strength/engine/landmarkSmoothing');
const { createCoverTransform, mapNormalizedPoint } = require('../src/features/strength/engine/poseTransform');
const { createPositioningCoach } = require('../src/features/strength/engine/positioningCoach');
const {
  SUMMARY_KEYS,
  assertPrivacySafeObject,
  serializeStrengthSummary,
} = require('../src/features/strength/engine/strengthPrivacy');
const { EXERCISES } = require('../src/features/strength/exercises');
const { enqueueSummary, pruneOutbox } = require('../src/features/strength/services/strengthOutbox');

function repeat(value, count = 5) {
  return Array.from({ length: count }, () => ({ ...value }));
}

const sequences = {
  'bodyweight-squat-v1': {
    reset: { kneeAngle: 170, hipAngle: 170, hipX: 0.5, kneeVelocity: 0 },
    phases: [
      { kneeAngle: 150, hipAngle: 145, hipX: 0.5, kneeVelocity: -50 },
      { kneeAngle: 100, hipAngle: 110, hipX: 0.5, kneeVelocity: -30 },
      { kneeAngle: 145, hipAngle: 150, hipX: 0.5, kneeVelocity: 40 },
      { kneeAngle: 170, hipAngle: 170, hipX: 0.5, kneeVelocity: 20 },
    ],
  },
  'wall-pushup-v1': {
    reset: { elbowAngle: 170, elbowVelocity: 0, hipDeviation: 0 },
    phases: [
      { elbowAngle: 145, elbowVelocity: -40, hipDeviation: 0 },
      { elbowAngle: 95, elbowVelocity: -30, hipDeviation: 0 },
      { elbowAngle: 145, elbowVelocity: 35, hipDeviation: 0 },
      { elbowAngle: 170, elbowVelocity: 20, hipDeviation: 0 },
    ],
  },
  'side-leg-raise-v1': {
    reset: { abduction: 5, abductionVelocity: 0, shoulderMidX: 0.5 },
    phases: [
      { abduction: 26, abductionVelocity: 30, shoulderMidX: 0.5 },
      { abduction: 35, abductionVelocity: 20, shoulderMidX: 0.5 },
      { abduction: 14, abductionVelocity: -25, shoulderMidX: 0.5 },
      { abduction: 5, abductionVelocity: -10, shoulderMidX: 0.5 },
    ],
  },
};

function drive(engine, frames, startTs = 0, stepMs = 100) {
  const events = [];
  let ts = startTs;
  for (const measurements of frames) {
    ts += stepMs;
    events.push(...engine.process({ ts, measurements, confident: true, poseCount: 1 }).events);
  }
  return { events, ts };
}

for (const exercise of EXERCISES) {
  test(`${exercise.id} counts exactly ten complete deterministic reps`, () => {
    const engine = createRepStateMachine(exercise, { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } });
    const definition = sequences[exercise.id];
    const frames = repeat(definition.reset);
    for (let rep = 0; rep < 10; rep += 1) {
      for (const phase of definition.phases) frames.push(...repeat(phase));
    }
    const result = drive(engine, frames);
    assert.equal(result.events.filter((event) => event.type === 'repAccepted').length, 10);
    assert.equal(engine.snapshot().reps, 10);
  });

  test(`${exercise.id} does not count five partial movements`, () => {
    const engine = createRepStateMachine(exercise, { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } });
    const definition = sequences[exercise.id];
    const frames = repeat(definition.reset);
    for (let rep = 0; rep < 5; rep += 1) frames.push(...repeat(definition.phases[0]), ...repeat(definition.reset));
    drive(engine, frames);
    assert.equal(engine.snapshot().reps, 0);
  });

  test(`${exercise.id} ignores jitter inside its reset deadband`, () => {
    const engine = createRepStateMachine(exercise, { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } });
    const reset = sequences[exercise.id].reset;
    const jittered = Array.from({ length: 20 }, (_, index) => Object.fromEntries(
      Object.entries(reset).map(([key, value]) => [key, typeof value === 'number' ? value + (index % 2 ? 4 : -4) : value])
    ));
    const result = drive(engine, jittered);
    assert.equal(result.events.filter((event) => event.type === 'stateChanged').length, 0);
    assert.equal(engine.snapshot().reps, 0);
  });
}

test('low confidence pauses without producing form cues', () => {
  const exercise = EXERCISES[0];
  const engine = createRepStateMachine(exercise, { activeSide: 'left' });
  const events = [];
  for (let ts = 0; ts <= 2100; ts += 100) events.push(...engine.process({ ts, landmarks: [], poseCount: 1 }).events);
  assert.equal(events.filter((event) => event.type === 'pauseRequested' && event.reason === 'low_confidence').length, 1);
  assert.equal(events.some((event) => event.type === 'cueCondition'), false);
});

test('a second pose pauses the rep engine immediately', () => {
  const engine = createRepStateMachine(EXERCISES[0], { activeSide: 'left' });
  const result = engine.process({ ts: 100, landmarks: [], poseCount: 2 });
  assert.deepEqual(result.events, [{ type: 'pauseRequested', reason: 'multi_person' }]);
});

test('cue scheduler preempts by priority and enforces cooldown and rate limits', () => {
  const scheduler = createCueScheduler({ cueMinimumGapMs: 3000, cueWindowLimit: 4 });
  const form = { id: 'form', priority: 70, cooldownMs: 10000, text: 'Form cue.' };
  const tracking = { id: 'tracking', priority: 90, cooldownMs: 1000, text: 'Tracking cue.' };
  assert.equal(scheduler.schedule([form], 0).cue.id, 'form');
  const preempt = scheduler.schedule([tracking], 500);
  assert.equal(preempt.cue.id, 'tracking');
  assert.equal(preempt.cancel, true);
  assert.equal(scheduler.schedule([form], 4000), null);
  assert.equal(scheduler.schedule([form], 11000).cue.id, 'form');
  assert.equal(scheduler.schedule([form], 12000), null);
  assert.deepEqual(scheduler.snapshot(), { form: 2, tracking: 1 });
});

test('landmark smoothing rejects a large one-frame body-relative jump', () => {
  const smoother = createLandmarkSmoother();
  const first = smoother.smooth([{ id: 11, x: 0.2, y: 0.2, visibility: 1 }], 0, 0.6);
  const second = smoother.smooth([{ id: 11, x: 0.9, y: 0.9, visibility: 1 }], 100, 0.6);
  assert.equal(first[0].x, 0.2);
  assert.equal(second[0].x, 0.2);
  assert.equal(second[0].y, 0.2);
});

test('landmark smoothing recovers after a sustained legitimate position change', () => {
  const smoother = createLandmarkSmoother();
  smoother.smooth([{ id: 11, x: 0.2, y: 0.2, visibility: 1, presence: 1 }], 0, 0.6);
  const rejected = smoother.smooth([{ id: 11, x: 0.8, y: 0.8, visibility: 1, presence: 1 }], 100, 0.6);
  const recovered = smoother.smooth([{ id: 11, x: 0.81, y: 0.79, visibility: 1, presence: 1 }], 200, 0.6);
  assert.equal(rejected[0].x, 0.2);
  assert.equal(rejected[0].stale, true);
  assert.equal(recovered[0].x, 0.81);
  assert.equal(recovered[0].y, 0.79);
  assert.equal(recovered[0].stale, false);
});

test('landmark smoothing provides a short visual grace then hides missing points', () => {
  const smoother = createLandmarkSmoother({ confidenceGraceMs: 300 });
  smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 1, presence: 1 }], 0, 0.6);
  const grace = smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 0.1, presence: 0.1 }], 250, 0.6);
  const hidden = smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 0.1, presence: 0.1 }], 301, 0.6);
  assert.equal(grace[0].stale, true);
  assert.equal(hidden[0], null);
});

test('landmark smoothing keeps the last pose briefly when detection drops a frame', () => {
  const smoother = createLandmarkSmoother({ confidenceGraceMs: 300 });
  smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 1, presence: 1 }], 0, 0.6);
  const grace = smoother.smooth([], 200, 0.6);
  const hidden = smoother.smooth([], 301, 0.6);
  assert.equal(grace[11].stale, true);
  assert.equal(hidden[11], undefined);
});

test('cover transform aligns a landscape camera with a portrait preview crop', () => {
  const transform = createCoverTransform({
    sourceWidth: 960,
    sourceHeight: 720,
    viewWidth: 300,
    viewHeight: 400,
  });
  assert.equal(Math.round(transform.renderedWidth), 533);
  assert.equal(Math.round(transform.offsetX), -117);
  assert.deepEqual(mapNormalizedPoint({ x: 0.5, y: 0.5 }, transform), { x: 150, y: 200 });
});

test('cover transform mirrors overlay geometry in preview coordinates', () => {
  const transform = createCoverTransform({
    sourceWidth: 960,
    sourceHeight: 720,
    viewWidth: 300,
    viewHeight: 400,
    mirrored: true,
  });
  const left = mapNormalizedPoint({ x: 0.25, y: 0.5 }, transform);
  const right = mapNormalizedPoint({ x: 0.75, y: 0.5 }, transform);
  assert.ok(left.x > right.x);
  assert.equal(Math.round(left.x + right.x), 300);
  assert.equal(left.y, 200);
});

test('positioning coach requires a continuous ready hold', () => {
  const coach = createPositioningCoach({
    readyHoldMs: 2000,
    issueDwellMs: 300,
    uiMinimumGapMs: 0,
    evaluate: (frame) => frame.result,
  });
  assert.equal(coach.process({ ts: 0, result: { ok: true, instruction: 'Good.' } }).ready, false);
  assert.equal(coach.process({ ts: 1500, result: { ok: true, instruction: 'Good.' } }).ready, false);
  coach.process({ ts: 1600, result: { ok: false, reason: 'off_centre', instruction: 'Move left.' } });
  assert.equal(coach.process({ ts: 1700, result: { ok: true, instruction: 'Good.' } }).ready, false);
  assert.equal(coach.process({ ts: 3700, result: { ok: true, instruction: 'Good.' } }).ready, true);
});

test('positioning coach dwells before publishing a transient issue', () => {
  const coach = createPositioningCoach({
    readyHoldMs: 2000,
    issueDwellMs: 300,
    uiMinimumGapMs: 0,
    evaluate: (frame) => frame.result,
  });
  coach.process({ ts: 0, result: { ok: true, instruction: 'Good.' } });
  const jitter = coach.process({ ts: 100, result: { ok: false, reason: 'off_centre', instruction: 'Move left.' } });
  assert.equal(jitter.ok, true);
  const stableIssue = coach.process({ ts: 400, result: { ok: false, reason: 'off_centre', instruction: 'Move left.' } });
  assert.equal(stableIssue.ok, false);
  assert.equal(stableIssue.instruction, 'Move left.');
});

test('strength summary serializer emits only the privacy allowlist', () => {
  const summary = serializeStrengthSummary({
    id: 'session-1', exerciseId: 'bodyweight-squat-v1', exerciseVersion: 1,
    startedAt: '2026-08-24T00:00:00.000Z', completedAt: '2026-08-24T00:03:04.000Z',
    durationSeconds: 184, targetReps: 8, acceptedReps: 8, pauseCount: 1,
    cueCounts: { finishStanding: 2 }, completionState: 'completed', platform: 'web',
    landmarks: [{ x: 1 }], video: 'forbidden',
  });
  assert.deepEqual(Object.keys(summary).sort(), [...SUMMARY_KEYS].sort());
  assert.equal(Object.hasOwn(summary, 'landmarks'), false);
  assert.equal(Object.hasOwn(summary, 'video'), false);
});

test('privacy scan blocks media and geometry keys at any depth', () => {
  for (const value of [
    { landmarks: [] }, { nested: { cameraFrame: 'x' } }, { payload: { audio: 'x' } },
    { result: { coordinates: [1, 2] } }, { screenshot: 'x' },
  ]) assert.throws(() => assertPrivacySafeObject(value), /privacy_forbidden_key/);
});

test('outbox keeps only allowlisted summaries and expires old retries', () => {
  const now = Date.parse('2026-08-24T12:00:00.000Z');
  const summary = {
    id: 'session-outbox', exerciseId: 'wall-pushup-v1', exerciseVersion: 1,
    startedAt: '2026-08-24T11:58:00.000Z', completedAt: '2026-08-24T12:00:00.000Z',
    durationSeconds: 120, targetReps: 8, acceptedReps: 6, pauseCount: 1,
    completionState: 'stopped', platform: 'web', privacyVersion: 1,
  };
  const queue = enqueueSummary([], { ...summary, cameraFrames: ['forbidden'] }, now);
  assert.equal(queue.length, 1);
  assert.equal(Object.hasOwn(queue[0].summary, 'cameraFrames'), false);
  assert.deepEqual(pruneOutbox([
    ...queue,
    { summary: { ...summary, id: 'expired' }, queuedAt: now - 8 * 24 * 60 * 60 * 1000, attempts: 4 },
  ], now), queue);
});

// ---------------------------------------------------------------------------
// Squat robustness regression suite (deterministic; does not alter the
// behaviors asserted by the 23 tests above).
// ---------------------------------------------------------------------------

const squat = EXERCISES.find((e) => e.id === 'bodyweight-squat-v1');
const squatBaseline = { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } };

function squatEngine() {
  return createRepStateMachine(squat, squatBaseline);
}

function m(kneeAngle, hipAngle = 180, hipX = 0.5, kneeVelocity = 0) {
  return { kneeAngle, hipAngle, hipX, kneeVelocity };
}

// A valid engine frame carries measurements in a nested `measurements` field.
function fm(measurement) {
  return { measurements: measurement };
}

// Build a timestamped stream from [frame, count] phases.
function stream(phases, stepMs = 100) {
  const frames = [];
  let ts = 0;
  for (const [frame, count] of phases) {
    for (let i = 0; i < count; i += 1) { ts += stepMs; frames.push({ ...frame, ts }); }
  }
  return frames;
}

function run(engine, frames) {
  const events = [];
  for (const frame of frames) {
    const payload = { ...frame };
    if (payload.measurements) payload.confident = payload.confident !== false;
    events.push(...engine.process(payload).events);
  }
  return { events };
}

// 1. Ankle loss: dropping the ankle landmark mid-rep must pause (low
//    confidence) and never phantom-count, while preserving the in-flight cycle.
test('bodyweight-squat-v1 holds state and does not phantom-count when the ankle is lost mid-rep', () => {
  const engine = squatEngine();
  const build = (kA) => {
    const L = 0.45, knee = { x: 0.5, y: 0.5 }, hip = { x: 0.5, y: 0.95 }, sho = { x: 0.5, y: 1.3 };
    const a = kA * Math.PI / 180;
    const ankle = { x: knee.x + L * Math.sin(a), y: knee.y + L * Math.cos(a) };
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 1.0, visibility: 0.9 }));
    const set = (id, p) => { lm[id] = { x: p.x, y: p.y, visibility: 0.9 }; };
    set(11, sho); set(12, { x: 0.46, y: 0.98 }); set(23, hip); set(24, { x: 0.54, y: 0.93 });
    set(25, knee); set(27, ankle); set(29, { x: ankle.x, y: ankle.y + 0.05 });
    set(26, { x: 0.46, y: 0.5 }); set(28, { x: 0.54, y: 0.5 }); set(30, { x: 0.46, y: 0.4 });
    return lm;
  };
  const standing = build(170);
  const down = build(100);
  // Drop the ankle (landmarks 27 / 29) to invisibility mid-rep.
  const dropped = down.map((p, i) => (i === 27 || i === 29 ? { ...p, visibility: 0 } : p));
  const frames = stream([
    [{ landmarks: standing }, 3],
    [{ landmarks: down }, 3],
    [{ landmarks: dropped }, 30],
    [{ landmarks: standing }, 8],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'pauseRequested' && e.reason === 'low_confidence').length >= 1, true);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 0);
  assert.equal(engine.snapshot().reps, 0);
  // The engine only ever reports a valid squat state — never a corrupted one.
  assert.equal(['standing', 'descending', 'bottom', 'rising'].includes(engine.snapshot().state), true);
});

// 2. Visibility recovery/loss: confident=false frames pause, then recovery
//    resumes and the in-flight rep still completes.
test('bodyweight-squat-v1 pauses on visibility loss and resumes without dropping an in-flight rep', () => {
  const engine = squatEngine();
  const frames = stream([
    [fm(m(170)), 5],
    [fm(m(150)), 5],
    [fm(m(100)), 5],
    [fm(m(145)), 5],
    [fm(m(150)), 3],
    [{ measurements: m(150), confident: false }, 20],
    [fm(m(150)), 5],
    [fm(m(170)), 5],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'pauseRequested' && e.reason === 'low_confidence').length >= 1, true);
  assert.equal(events.some((e) => e.type === 'stateChanged' && e.from === 'paused'), true);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
});

// 3. Deep squat well past the bottom threshold counts exactly one rep.
test('bodyweight-squat-v1 counts a single rep for a deep squat well past the bottom', () => {
  const engine = squatEngine();
  const frames = stream([
    [fm(m(170)), 5], [fm(m(150)), 5], [fm(m(70)), 5], [fm(m(145)), 5], [fm(m(170)), 5],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
  assert.equal(engine.snapshot().reps, 1);
});

// 4. Direction: a cycle must descend -> bottom -> rise -> stand. Knees that
//    only extend (never crossing the descent threshold) produce no rep.
test('bodyweight-squat-v1 respects movement direction and rejects a reverse cycle', () => {
  const engine = squatEngine();
  const frames = stream([
    [fm(m(170)), 3],
    [fm(m(168)), 2],
    [fm(m(172)), 2],
    [fm(m(168)), 2],
    [fm(m(170)), 4],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 0);
  assert.equal(engine.snapshot().reps, 0);
  assert.equal(engine.snapshot().state, 'standing');
});

// 5. Seeded noise around thresholds still yields exactly one clean rep.
test('bodyweight-squat-v1 is robust to seeded measurement noise and still counts one clean rep', () => {
  let seed = 123456789;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const noise = (value, amp) => value + (rand() - 0.5) * 2 * amp;
  const noisy = (v) => m(noise(v, 4), noise(180, 3), noise(0.5, 0.01), noise(0, 20));
  const engine = squatEngine();
  const frames = stream([
    [fm(noisy(170)), 5],
    [fm(noisy(130)), 5],
    [fm(noisy(100)), 5],
    [fm(noisy(145)), 5],
    [fm(noisy(170)), 5],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
  assert.equal(engine.snapshot().reps, 1);
});

// 6. Incomplete rep after visibility loss is not retroactively counted.
test('bodyweight-squat-v1 does not count an incomplete rep after visibility is lost before the bottom', () => {
  const engine = squatEngine();
  const frames = stream([
    [fm(m(170)), 3],
    [fm(m(140)), 2],
    [{ measurements: m(140), confident: false }, 20],
    [fm(m(170)), 8],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 0);
  assert.equal(engine.snapshot().reps, 0);
});

// 7. Two partial descents that never return to standing never sum to a rep.
test('bodyweight-squat-v1 never phantom-counts partial descents that never finish standing', () => {
  const engine = squatEngine();
  const frames = stream([
    [fm(m(170)), 3],
    [fm(m(120)), 4],
    [fm(m(150)), 2],
    [fm(m(120)), 4],
    [fm(m(170)), 3],
    [fm(m(120)), 4],
    [fm(m(150)), 2],
    [fm(m(120)), 4],
    [fm(m(170)), 3],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 0);
  assert.equal(engine.snapshot().reps, 0);
});

// 8. Stale / duplicated timestamps must not throw or prematurely satisfy a
//    transition, and a valid cycle still counts once when timestamps resume.
test('bodyweight-squat-v1 tolerates stale and duplicated timestamps without premature counting', () => {
  const engine = squatEngine();
  // Stuck (frozen) then backward timestamps must not throw nor corrupt state.
  const stuck = [fm(m(170)), fm(m(100)), fm(m(100)), fm(m(100)), fm(m(170))]
    .map((frame) => ({ ...frame, ts: 1000 }));
  assert.doesNotThrow(() => run(engine, [...stuck, { ...fm(m(170)), ts: 0 }]));
  // Then a valid monotonic cycle still counts exactly one rep.
  const engine2 = squatEngine();
  const valid = stream([
    [fm(m(170)), 5], [fm(m(150)), 5], [fm(m(100)), 5], [fm(m(145)), 5], [fm(m(170)), 5],
  ]);
  const { events } = run(engine2, valid);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
  assert.equal(engine.snapshot().reps, 0);
});

// ---------------------------------------------------------------------------
// Additional squat robustness coverage (brief/long visibility, landmark noise,
// impossible geometry). Deterministic; additive only.
// ---------------------------------------------------------------------------

// Build a copy of the squat landmark layout so we can perturb specific joints.
function squatLandmarksAt(kneeAngle) {
  const L = 0.45, knee = { x: 0.5, y: 0.5 }, hip = { x: 0.5, y: 0.95 }, sho = { x: 0.5, y: 1.3 };
  const a = kneeAngle * Math.PI / 180;
  const ankle = { x: knee.x + L * Math.sin(a), y: knee.y + L * Math.cos(a) };
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 1.0, visibility: 0.9 }));
  const set = (id, p) => { lm[id] = { x: p.x, y: p.y, visibility: 0.9 }; };
  set(11, sho); set(12, { x: 0.46, y: 0.98 }); set(23, hip); set(24, { x: 0.54, y: 0.93 });
  set(25, knee); set(27, ankle); set(29, { x: ankle.x, y: ankle.y + 0.05 });
  set(26, { x: 0.46, y: 0.5 }); set(28, { x: 0.54, y: 0.5 }); set(30, { x: 0.46, y: 0.4 });
  return lm;
}

const dropAnkle = (lm) => lm.map((p, i) => ((i === 27 || i === 29) ? { ...p, visibility: 0 } : p));
const dropAllButHip = (lm) => lm.map((p, i) => (i === 23 ? p : { ...p, visibility: 0 }));

// Brief ankle loss (a few frames) must recover without counting a phantom rep.
test('bodyweight-squat-v1 recovers from a brief ankle loss without a phantom rep', () => {
  const engine = squatEngine();
  const frames = stream([
    [{ landmarks: squatLandmarksAt(170) }, 5],
    [{ landmarks: squatLandmarksAt(150) }, 5],
    [{ landmarks: squatLandmarksAt(100) }, 5],
    [{ landmarks: dropAnkle(squatLandmarksAt(100)) }, 3],   // brief loss (< lowConfidenceMs)
    [{ landmarks: squatLandmarksAt(145) }, 5],
    [{ landmarks: squatLandmarksAt(170) }, 5],
  ]);
  const { events } = run(engine, frames);
  // Brief (<1500ms) loss does not force a pause; the rep still completes once.
  assert.equal(events.filter((e) => e.type === 'pauseRequested').length, 0);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
});

// Long visibility loss pauses, then a clean recovery completes the rep.
test('bodyweight-squat-v1 pauses on a long visibility loss and still completes the rep on recovery', () => {
  const engine = squatEngine();
  const frames = stream([
    [fm(m(170)), 5],
    [fm(m(150)), 5],
    [fm(m(100)), 5],
    [{ measurements: m(100), confident: false }, 20],
    [fm(m(145)), 5],   // re-entry (reentryFrames=5)
    [fm(m(170)), 12],  // bottom -> rising -> standing, with hold time
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'pauseRequested' && e.reason === 'low_confidence').length >= 1, true);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
});

// Landmark-level jitter (not measurement-level) still yields exactly one rep.
test('bodyweight-squat-v1 is robust to noisy landmarks and counts one clean rep', () => {
  let seed = 987654321;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const jitter = (lm, amp) => lm.map((p) => ({
    ...p, x: p.x + (rand() - 0.5) * amp, y: p.y + (rand() - 0.5) * amp,
  }));
  const engine = squatEngine();
  const frames = stream([
    [{ landmarks: jitter(squatLandmarksAt(170), 0.01) }, 5],
    [{ landmarks: jitter(squatLandmarksAt(130), 0.01) }, 5],
    [{ landmarks: jitter(squatLandmarksAt(100), 0.01) }, 5],
    [{ landmarks: jitter(squatLandmarksAt(145), 0.01) }, 5],
    [{ landmarks: jitter(squatLandmarksAt(170), 0.01) }, 5],
  ]);
  const { events } = run(engine, frames);
  assert.equal(events.filter((e) => e.type === 'repAccepted').length, 1);
  assert.equal(engine.snapshot().reps, 1);
});

// Impossible geometry (degenerate / zero-length limbs) must not crash or count.
test('bodyweight-squat-v1 handles impossible geometry without crashing or phantom-counting', () => {
  const engine = squatEngine();
  // All landmarks superimposed -> zero-length joint vectors -> null angles.
  const degenerate = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  const frames = stream([
    [{ landmarks: degenerate }, 10],
    [{ landmarks: dropAllButHip(degenerate) }, 10],
    [{ landmarks: squatLandmarksAt(170) }, 5],
  ]);
  assert.doesNotThrow(() => run(engine, frames));
  assert.equal(engine.snapshot().reps, 0);
});
