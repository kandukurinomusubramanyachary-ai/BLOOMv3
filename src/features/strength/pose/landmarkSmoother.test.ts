import { LANDMARK } from './landmarkIds';
import { LandmarkSmoother } from './landmarkSmoother';
import { PoseFrame } from './types';

const frame = (timestamp: number, x = 0.5, visibility = 0.95): PoseFrame => ({
  timestamp, source: 'simulator', aspectRatio: 1,
  landmarks: [{ id: LANDMARK.LEFT_KNEE, x, y: 0.6, z: 0, visibility }],
});
const empty = (timestamp: number): PoseFrame => ({ timestamp, landmarks: [] });

describe('landmark EMA smoothing', () => {
  test('reduces jitter with configurable, bounded latency', () => {
    const smoother = new LandmarkSmoother({ alpha: 0.5 });
    const inputs = [0.5, 0.6, 0.4, 0.6, 0.4].map((x, i) => frame(i * 33, x));
    const outputs = inputs.map((f) => smoother.process(f).landmarks[0].x);
    expect(outputs[1]).toBeCloseTo(0.55);
    expect(Math.max(...outputs) - Math.min(...outputs)).toBeLessThan(0.2);
    expect(new LandmarkSmoother({ alpha: 1 }).process(frame(0, 0.8)).landmarks[0].x).toBe(0.8);
  });

  test('does not mutate input arrays or points', () => {
    const input = frame(0);
    Object.freeze(input.landmarks[0]);
    Object.freeze(input.landmarks);
    Object.freeze(input);
    const smoother = new LandmarkSmoother();
    smoother.process(input);
    smoother.process(frame(33, 0.7));
    expect(input.landmarks[0].x).toBe(0.5);
  });

  test('low-confidence observations cannot move or refresh a retained point', () => {
    const smoother = new LandmarkSmoother({ maxHoldMs: 100 });
    smoother.process(frame(0));
    const held = smoother.process(frame(50, 0.9, 0.2));
    expect(held.landmarks[0].x).toBe(0.5);
    expect(held.heldLandmarkIds).toEqual([LANDMARK.LEFT_KNEE]);
    expect(smoother.process(frame(101, 0.9, 0.2)).landmarks).toEqual([]);
  });

  test('undefined/nonfinite confidence and nonfinite coordinates never seed trusted state', () => {
    const smoother = new LandmarkSmoother();
    const inputs: PoseFrame[] = [
      { timestamp: 0, landmarks: [{ id: LANDMARK.LEFT_KNEE, x: 0, y: 0 }] },
      frame(1, 0.5, NaN), frame(2, Infinity), frame(3, NaN), frame(4, 0.5, 1.1),
      { timestamp: 5, landmarks: [{ id: LANDMARK.LEFT_KNEE, x: 0, y: 0, z: Infinity, visibility: 1 }] },
    ];
    for (const input of inputs) expect(smoother.process(input).landmarks).toEqual([]);
  });

  test('temporarily missing landmarks are held at most the configured gap', () => {
    const smoother = new LandmarkSmoother({ maxHoldMs: 100 });
    smoother.process(frame(0));
    expect(smoother.process(empty(100))).toMatchObject({ landmarks: [{ x: 0.5 }], heldLandmarkIds: [LANDMARK.LEFT_KNEE] });
    expect(smoother.process(empty(101))).toMatchObject({ landmarks: [], heldLandmarkIds: [] });
  });

  test('reappearing after a long gap does not blend stale coordinates', () => {
    const smoother = new LandmarkSmoother({ alpha: 0.1, maxHoldMs: 100 });
    smoother.process(frame(0, 0.2));
    expect(smoother.process(frame(101, 0.9)).landmarks[0].x).toBe(0.9);
  });

  test('pre-held or duplicate IDs cannot seed or refresh trusted points', () => {
    const smoother = new LandmarkSmoother();
    const input = frame(0);
    expect(smoother.process({ ...input, heldLandmarkIds: [LANDMARK.LEFT_KNEE] }).landmarks).toEqual([]);
    expect(smoother.process({ ...frame(1), landmarks: [...input.landmarks, ...input.landmarks] }).landmarks).toEqual([]);
  });

  test('reset clears history and timestamp ordering', () => {
    const smoother = new LandmarkSmoother({ alpha: 0.1 });
    smoother.process(frame(500, 0.2));
    smoother.reset();
    expect(smoother.process(frame(0, 0.9)).landmarks[0].x).toBe(0.9);
    smoother.reset();
    expect(smoother.process(empty(0)).landmarks).toEqual([]);
  });

  test('duplicate, stale and invalid timestamps preserve latest output deterministically', () => {
    const smoother = new LandmarkSmoother();
    const previous = smoother.process(frame(100));
    expect(smoother.process(frame(100, 0.9))).toBe(previous);
    expect(smoother.process(frame(90, 0.9))).toBe(previous);
    expect(smoother.process(frame(NaN, 0.9))).toBe(previous);
    expect(smoother.process(frame(Infinity, 0.9))).toBe(previous);
    expect(smoother.process(frame(-1, 0.9))).toBe(previous);
    expect(new LandmarkSmoother().process(frame(NaN))).toEqual({ timestamp: 0, landmarks: [], heldLandmarkIds: [] });
  });

  test('replaying the same sequence produces the same outputs', () => {
    const inputs = [frame(0), frame(33, 0.6), empty(66), frame(99, 0.8, 0.2), frame(132, 0.4), empty(400)];
    const a = new LandmarkSmoother();
    const b = new LandmarkSmoother();
    expect(inputs.map((f) => a.process(f))).toEqual(inputs.map((f) => b.process(f)));
  });

  test.each([{ alpha: 0 }, { alpha: 1.1 }, { alpha: NaN }, { maxHoldMs: -1 }, { maxHoldMs: Infinity }, { minVisibility: -0.1 }, { minVisibility: 1.1 }])('rejects invalid configuration %p', (options) => {
    expect(() => new LandmarkSmoother(options)).toThrow(RangeError);
  });
});
