import { LANDMARK } from '../../pose/landmarkIds';
import type { PoseFrame } from '../../pose/types';
import { angleRamp, createAngleSequence, createSquatPose, holdAngle } from '../../testing/poseFactory';
import { createSquatSequence, simulatePoseSequence } from '../../testing/poseSequenceSimulator';
import { SQUAT_FIXTURES } from '../../testing/squatFixtures';
import { SquatEngine } from './squat.engine';
import { SQUAT_CONFIG } from './squat.config';

const bottomSequence = () => createAngleSequence([...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90)]);
const finish = (startTimestamp: number) => createAngleSequence([...angleRamp(90, 173), ...holdAngle(173)], { startTimestamp });
const corrupt = (frames: readonly PoseFrame[], edit: (frame: PoseFrame) => PoseFrame) => frames.map(edit);

describe('SquatEngine required fixture matrix', () => {
  test.each(SQUAT_FIXTURES)('$label → $expectedReps repetitions', fixture => {
    const { finalResult, events } = simulatePoseSequence(fixture.createFrames());
    expect(finalResult.reps).toBe(fixture.expectedReps);
    expect(events.filter(event => event.type === 'REP_COMPLETED')).toHaveLength(fixture.expectedReps);
  });

  test('valid repetition traverses the complete explicit state cycle in order', () => {
    const { events, finalResult } = simulatePoseSequence(createSquatSequence());
    expect(events.map(event => event.type === 'STATE_CHANGED' ? event.state : event.type)).toEqual(['DESCENDING', 'BOTTOM', 'ASCENDING', 'STANDING', 'REP_COMPLETED']);
    expect(finalResult.state).toBe('STANDING');
    expect(events[events.length - 1]).toMatchObject({ type: 'REP_COMPLETED', exercise: 'SQUAT', reps: 1 });
  });

  test('reset clears completed reps, pending transitions, timing and baseline', () => {
    const engine = new SquatEngine();
    simulatePoseSequence(createSquatSequence({ repetitions: 3 }), engine);
    engine.reset();
    expect(engine.getResult()).toMatchObject({ state: 'STANDING', reps: 0, trackingStatus: 'INITIALIZING', confidence: 0, events: [] });
    expect(simulatePoseSequence(createSquatSequence(), engine).finalResult.reps).toBe(1);
  });

  test('temporary loss preserves state but never increases reps', () => {
    const engine = new SquatEngine();
    const bottom = bottomSequence();
    simulatePoseSequence(bottom, engine);
    const timestamp = bottom[bottom.length - 1].timestamp;
    const lost = engine.process({ timestamp: timestamp + 50, landmarks: [] });
    expect(lost).toMatchObject({ state: 'BOTTOM', reps: 0, trackingStatus: 'NO_POSE', confidence: 0, events: [] });
    expect(simulatePoseSequence(finish(timestamp + 100), engine).finalResult.reps).toBe(1);
  });

  test('long tracking loss invalidates the partial cycle even when invalid frames keep arriving', () => {
    const engine = new SquatEngine();
    const frames = bottomSequence();
    simulatePoseSequence(frames, engine);
    let timestamp = frames[frames.length - 1].timestamp;
    for (let index = 0; index < 15; index += 1) engine.process({ timestamp: timestamp += 50, landmarks: [] });
    expect(simulatePoseSequence(finish(timestamp + 50), engine).finalResult.reps).toBe(0);
  });

  test('recovery crossing tracking-loss timeout invalidates partial cycle', () => {
    const engine = new SquatEngine();
    const frames = bottomSequence();
    simulatePoseSequence(frames, engine);
    const timestamp = frames[frames.length - 1].timestamp;
    for (let delta = 100; delta <= 600; delta += 100) engine.process({ timestamp: timestamp + delta, landmarks: [] });
    expect(simulatePoseSequence(finish(timestamp + 650), engine).finalResult.reps).toBe(0);
  });

  test('a long capture gap invalidates the partial cycle', () => {
    const frames = bottomSequence();
    expect(simulatePoseSequence([...frames, ...finish(frames[frames.length - 1].timestamp + 2000)]).finalResult.reps).toBe(0);
  });

  test.each(['duplicate', 'out-of-order'] as const)('%s timestamps cannot complete or replay a repetition', mode => {
    const engine = new SquatEngine();
    const frames = bottomSequence();
    simulatePoseSequence(frames, engine);
    const timestamp = frames[frames.length - 1].timestamp;
    expect(engine.process(createSquatPose({ timestamp: timestamp - (mode === 'duplicate' ? 0 : 1), kneeAngle: 90 })).events).toEqual([]);
    expect(simulatePoseSequence(finish(timestamp + 50), engine).finalResult.reps).toBe(0);
  });

  test('duplicate completed frame preserves rep count and emits no repeated event', () => {
    const engine = new SquatEngine();
    const frames = createSquatSequence();
    const { results } = simulatePoseSequence(frames, engine);
    const repFrameIndex = results.findIndex(result => result.events.some(event => event.type === 'REP_COMPLETED'));
    const duplicate = engine.process(frames[repFrameIndex]);
    expect(duplicate.reps).toBe(1);
    expect(duplicate.events).toEqual([]);
    expect(engine.getResult().events).toEqual([]);
  });

  test('starting at bottom never counts without a stable standing baseline', () => {
    expect(simulatePoseSequence(createAngleSequence([...holdAngle(90), ...angleRamp(90, 173), ...holdAngle(173)])).finalResult.reps).toBe(0);
  });

  test('one standing baseline frame is insufficient to arm a cycle', () => {
    const frames = createAngleSequence([173, ...angleRamp(173, 90), ...holdAngle(90), ...angleRamp(90, 173), ...holdAngle(173)]);
    expect(simulatePoseSequence(frames).finalResult.reps).toBe(0);
  });

  test('one noisy bottom frame never satisfies depth stability', () => {
    const angles = [...holdAngle(173), ...angleRamp(173, 130), ...holdAngle(130), 90, ...holdAngle(130), ...angleRamp(130, 173), ...holdAngle(173)];
    const result = simulatePoseSequence(createAngleSequence(angles));
    expect(result.finalResult.reps).toBe(0);
    expect(result.events.some(event => event.type === 'STATE_CHANGED' && event.state === 'BOTTOM')).toBe(false);
  });

  test('one noisy return-to-standing frame cannot finish a rep', () => {
    const angles = [...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90), ...angleRamp(90, 145), ...holdAngle(145), 173, ...holdAngle(145)];
    expect(simulatePoseSequence(createAngleSequence(angles)).finalResult.reps).toBe(0);
  });

  test('bouncing through multiple bottom/ascent oscillations yields only one final rep', () => {
    const angles = [...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90), ...holdAngle(135), ...holdAngle(90), ...holdAngle(130), ...holdAngle(90), ...angleRamp(90, 173), ...holdAngle(173)];
    expect(simulatePoseSequence(createAngleSequence(angles)).finalResult.reps).toBe(1);
  });

  test('skipping observed ascent with a jump from bottom to standing does not count', () => {
    const frames = [...bottomSequence(), ...createAngleSequence(holdAngle(173), { startTimestamp: 1600 })];
    expect(simulatePoseSequence(frames).finalResult.reps).toBe(0);
  });

  test('unrealistic millisecond frame burst cannot meet temporal stability', () => {
    expect(simulatePoseSequence(createSquatSequence({ frameIntervalMs: 1 })).finalResult.reps).toBe(0);
  });

  test('maximum cycle duration bounds a stalled partial squat', () => {
    const angles = [...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90, 330), ...angleRamp(90, 173), ...holdAngle(173)];
    expect(simulatePoseSequence(createAngleSequence(angles)).finalResult.reps).toBe(0);
  });

  test('suspending tracking preserves completed work and requires a new baseline', () => {
    const engine = new SquatEngine();
    simulatePoseSequence(createSquatSequence(), engine);
    const partial = bottomSequence().map(frame => ({ ...frame, timestamp: frame.timestamp + 3000 }));
    simulatePoseSequence(partial, engine);
    const snapshot = engine.invalidateTracking();
    expect(snapshot).toMatchObject({ reps: 1, state: 'STANDING', confidence: 0, trackingStatus: 'NO_POSE', events: [] });
    expect(Object.values(snapshot.metrics).every(value => value === null)).toBe(true);
    expect(simulatePoseSequence(finish(partial[partial.length - 1].timestamp + 50), engine).finalResult.reps).toBe(1);
  });
});

describe('SquatEngine evidence validation', () => {
  test.each([NaN, Infinity, -1])('rejects invalid timestamp %s with no numeric leakage', timestamp => {
    const result = new SquatEngine().process(createSquatPose({ timestamp }));
    expect(result.trackingStatus).toBe('LOW_CONFIDENCE');
    expect(result.reps).toBe(0);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });

  test('undefined visibility is never assumed confident', () => {
    const result = simulatePoseSequence(corrupt(createSquatSequence(), frame => ({ ...frame, landmarks: frame.landmarks.map(({ visibility: _visibility, ...point }) => point) })));
    expect(result.finalResult).toMatchObject({ reps: 0, confidence: 0, trackingStatus: 'LOW_CONFIDENCE' });
  });

  test('held smoother landmarks cannot advance any transition', () => {
    const frames = createSquatSequence().map(frame => ({ ...frame, heldLandmarkIds: [LANDMARK.LEFT_KNEE] }));
    const result = simulatePoseSequence(frames);
    expect(result.events).toEqual([]);
    expect(result.finalResult).toMatchObject({ reps: 0, trackingStatus: 'LOW_CONFIDENCE' });
  });

  test.each([NaN, Infinity, -Infinity, 1e300])('invalid coordinate %s cannot create a rep or NaN metric', value => {
    const frames = corrupt(createSquatSequence(), frame => ({ ...frame, landmarks: frame.landmarks.map(point => point.id === LANDMARK.LEFT_KNEE ? { ...point, x: value } : point) }));
    const result = simulatePoseSequence(frames);
    expect(result.finalResult.reps).toBe(0);
    for (const output of result.results) {
      expect(Number.isFinite(output.confidence)).toBe(true);
      expect(Object.values(output.metrics).every(metric => metric === null || Number.isFinite(metric))).toBe(true);
    }
  });

  test('duplicate required IDs are ambiguous', () => {
    const result = simulatePoseSequence(corrupt(createSquatSequence(), frame => ({ ...frame, landmarks: [...frame.landmarks, frame.landmarks[0]] })));
    expect(result.finalResult).toMatchObject({ reps: 0, trackingStatus: 'LOW_CONFIDENCE' });
  });

  test('clipped bodies receive a visibility observation and cannot count', () => {
    const result = new SquatEngine().process(createSquatPose({ offsetY: 0.2 }));
    expect(result.trackingStatus).toBe('LOW_CONFIDENCE');
    expect(result.formFlags[0].code).toBe('BODY_NOT_VISIBLE');
  });

  test('small distant poses are not accepted', () => {
    const result = new SquatEngine().process(createSquatPose({ scale: 0.3 }));
    expect(result.trackingStatus).toBe('LOW_CONFIDENCE');
    expect(result.formFlags[0].code).toBe('TOO_FAR');
  });

  test('confidence changes with actual landmark evidence', () => {
    const high = new SquatEngine().process(createSquatPose({ visibility: 0.98 }));
    const lower = new SquatEngine().process(createSquatPose({ visibility: 0.75 }));
    expect(high.confidence).toBeGreaterThan(lower.confidence);
    expect(lower.confidence).toBeGreaterThan(0.7);
    expect(high.confidence).toBeLessThanOrEqual(1);
  });

  test('inputs are immutable', () => {
    const frames = createSquatSequence();
    const before = JSON.stringify(frames);
    frames.forEach(frame => { frame.landmarks.forEach(Object.freeze); Object.freeze(frame.landmarks); Object.freeze(frame); });
    expect(simulatePoseSequence(frames).finalResult.reps).toBe(1);
    expect(JSON.stringify(frames)).toBe(before);
  });

  test('shallow-range observation follows an incomplete cycle', () => {
    const result = simulatePoseSequence(createSquatSequence({ bottomKneeAngle: 130 }));
    expect(result.results.some(frame => frame.formFlags.some(flag => flag.code === 'SHALLOW_RANGE'))).toBe(true);
  });

  test('torso lean is a conservative observation, not a medical judgment', () => {
    const result = new SquatEngine().process(createSquatPose({ torsoLeanDegrees: 45 }));
    expect(result.formFlags).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TORSO_LEAN', severity: 'INFO' })]));
  });

  test('invalid hysteresis/stability config is rejected; target is fixed at eight', () => {
    expect(SQUAT_CONFIG.targetReps).toBe(8);
    expect(() => new SquatEngine({ bottomAngle: 170 })).toThrow();
    expect(() => new SquatEngine({ stableFrames: 1 })).toThrow();
    expect(() => new SquatEngine({ minimumVisibility: NaN })).toThrow();
    expect(() => new SquatEngine({ targetReps: 12 })).toThrow();
  });
});
