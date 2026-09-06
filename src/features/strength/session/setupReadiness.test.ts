import { LANDMARK } from '../pose/landmarkIds';
import type { PoseFrame } from '../pose/types';
import { SetupReadiness } from './setupReadiness';

function frame(timestamp: number, overrides: Partial<PoseFrame> = {}): PoseFrame {
  return {
    timestamp,
    aspectRatio: 0.75,
    landmarks: [
      { id: LANDMARK.LEFT_SHOULDER, x: 0.3, y: 0.2, visibility: 0.95 },
      { id: LANDMARK.RIGHT_SHOULDER, x: 0.45, y: 0.2, visibility: 0.95 },
      { id: LANDMARK.LEFT_HIP, x: 0.32, y: 0.45, visibility: 0.95 },
      { id: LANDMARK.RIGHT_HIP, x: 0.43, y: 0.45, visibility: 0.95 },
      { id: LANDMARK.LEFT_KNEE, x: 0.32, y: 0.65, visibility: 0.95 },
      { id: LANDMARK.RIGHT_KNEE, x: 0.43, y: 0.65, visibility: 0.95 },
      { id: LANDMARK.LEFT_ANKLE, x: 0.3, y: 0.9, visibility: 0.95 },
      { id: LANDMARK.RIGHT_ANKLE, x: 0.45, y: 0.9, visibility: 0.95 },
    ],
    ...overrides,
  };
}

function ready(detector: SetupReadiness, start = 0): void {
  for (let index = 0; index < 10; index += 1) detector.process(frame(start + index * 50));
}

describe('SetupReadiness', () => {
  test('requires ten consecutive fresh complete observations', () => {
    const detector = new SetupReadiness();
    expect(detector.getResult()).toMatchObject({ ready: false, issue: 'SEARCHING' });
    for (let index = 0; index < 9; index += 1) {
      expect(detector.process(frame(index * 50))).toMatchObject({ ready: false, consecutiveFrames: index + 1 });
    }
    expect(detector.process(frame(450))).toEqual({
      ready: true,
      consecutiveFrames: 10,
      groups: { shoulders: true, hips: true, knees: true, ankles: true },
      issue: null,
    });
    expect(detector.process(frame(500)).consecutiveFrames).toBe(10);
  });

  test.each(Object.values(LANDMARK))('requires an observed %s and resets an interrupted sequence', (id) => {
    const detector = new SetupReadiness();
    detector.process(frame(0));
    const incomplete = frame(50);
    expect(detector.process({ ...incomplete, landmarks: incomplete.landmarks.filter((joint) => joint.id !== id) }))
      .toMatchObject({ ready: false, consecutiveFrames: 0, issue: 'SEARCHING' });
    expect(detector.process(frame(100)).consecutiveFrames).toBe(1);
  });

  test('held landmarks cannot establish or preserve readiness', () => {
    const detector = new SetupReadiness();
    ready(detector);
    expect(detector.process(frame(500, { heldLandmarkIds: [LANDMARK.LEFT_ANKLE] })))
      .toMatchObject({ ready: false, consecutiveFrames: 0, groups: { ankles: false }, issue: 'LOW_CONFIDENCE' });
    for (let index = 0; index < 20; index += 1) {
      expect(detector.process(frame(550 + index * 50, { heldLandmarkIds: [LANDMARK.LEFT_ANKLE] })).ready).toBe(false);
    }
  });

  test.each([0, 0.649, undefined, Number.NaN, Infinity, 1.01])('rejects invalid or insufficient visibility %s', (visibility) => {
    const detector = new SetupReadiness();
    const observation = frame(0);
    expect(detector.process({ ...observation, landmarks: observation.landmarks.map((joint, index) => index === 0 ? { ...joint, visibility } : joint) }))
      .toMatchObject({ ready: false, groups: { shoulders: false }, issue: 'LOW_CONFIDENCE' });
  });

  test('accepts confidence exactly at the configured threshold', () => {
    const observation = frame(0);
    const detector = new SetupReadiness({ requiredFrames: 1 });
    expect(detector.process({ ...observation, landmarks: observation.landmarks.map((joint) => ({ ...joint, visibility: 0.65 })) }).ready).toBe(true);
  });

  test.each([{ x: -0.01 }, { x: 0.76 }, { y: -0.01 }, { y: 1.01 }, { x: Number.NaN }, { y: Infinity }])('rejects clipped or invalid coordinates %p', (coordinate) => {
    const observation = frame(0);
    const detector = new SetupReadiness();
    expect(detector.process({ ...observation, landmarks: observation.landmarks.map((joint, index) => index === 7 ? { ...joint, ...coordinate } : joint) }))
      .toMatchObject({ ready: false, groups: { ankles: false }, issue: 'BODY_CLIPPED' });
  });

  test('uses image-height x bounds for a landscape frame', () => {
    const observation = frame(0, { aspectRatio: 1.5 });
    const detector = new SetupReadiness({ requiredFrames: 1 });
    expect(detector.process({ ...observation, landmarks: observation.landmarks.map((joint) => ({ ...joint, x: joint.x + 0.8 })) }).ready).toBe(true);
  });

  test.each([0, -1, Number.NaN, Infinity])('rejects invalid aspect ratio %s', (aspectRatio) => {
    expect(new SetupReadiness().process(frame(0, { aspectRatio })).issue).toBe('BODY_CLIPPED');
  });

  test('requires sufficient shoulder-to-ankle height', () => {
    const observation = frame(0);
    const detector = new SetupReadiness();
    expect(detector.process({ ...observation, landmarks: observation.landmarks.map((joint) => ({ ...joint, y: joint.y * 0.4 })) }))
      .toMatchObject({ ready: false, consecutiveFrames: 0, issue: 'TOO_FAR' });
  });

  test('tracking loss immediately removes readiness', () => {
    const detector = new SetupReadiness();
    ready(detector);
    expect(detector.process(frame(500, { landmarks: [] }))).toMatchObject({ ready: false, consecutiveFrames: 0, issue: 'SEARCHING' });
    expect(detector.process(frame(550)).consecutiveFrames).toBe(1);
  });

  test('duplicate and out-of-order timestamps never advance or replace legitimate observations', () => {
    const detector = new SetupReadiness();
    detector.process(frame(100));
    expect(detector.process(frame(100)).consecutiveFrames).toBe(1);
    expect(detector.process(frame(50)).consecutiveFrames).toBe(1);
    ready(detector, 150);
    expect(detector.process(frame(600, { landmarks: [] })).ready).toBe(true);
    expect(detector.process(frame(550, { landmarks: [] })).ready).toBe(true);
  });

  test.each([Number.NaN, Infinity, -1])('invalid timestamps %s cannot establish or retain readiness', (timestamp) => {
    const detector = new SetupReadiness();
    ready(detector);
    expect(detector.process(frame(timestamp))).toMatchObject({ ready: false, consecutiveFrames: 0, issue: 'SEARCHING' });
  });

  test('a gap at the freshness boundary restarts from one observed frame', () => {
    const detector = new SetupReadiness();
    ready(detector);
    expect(detector.process(frame(949)).ready).toBe(true);
    expect(detector.process(frame(1449))).toMatchObject({ ready: false, consecutiveFrames: 1 });
  });

  test('waiting with no frames never produces readiness; owner invalidation clears previous readiness', () => {
    const detector = new SetupReadiness();
    detector.process(frame(0));
    expect(detector.getResult()).toMatchObject({ ready: false, consecutiveFrames: 1 });
    ready(detector, 50);
    detector.invalidate();
    expect(detector.getResult()).toMatchObject({ ready: false, consecutiveFrames: 0, issue: 'SEARCHING' });
    expect(detector.process(frame(0)).consecutiveFrames).toBe(1);
    detector.reset();
    expect(detector.getResult().consecutiveFrames).toBe(0);
  });

  test('duplicate joint IDs do not count as reliable observations', () => {
    const observation = frame(0);
    expect(new SetupReadiness().process({ ...observation, landmarks: [...observation.landmarks, observation.landmarks[0]!] }).issue)
      .toBe('LOW_CONFIDENCE');
  });

  test('custom thresholds are respected and invalid configuration is explicit', () => {
    expect(new SetupReadiness({ requiredFrames: 2, minVisibility: 0.99 }).process(frame(0)).issue).toBe('LOW_CONFIDENCE');
    const detector = new SetupReadiness({ requiredFrames: 2, maxFrameGapMs: 100 });
    detector.process(frame(0));
    expect(detector.process(frame(50)).ready).toBe(true);
    expect(detector.process(frame(150)).ready).toBe(false);
    expect(() => new SetupReadiness({ requiredFrames: 0 })).toThrow(RangeError);
  });
});
