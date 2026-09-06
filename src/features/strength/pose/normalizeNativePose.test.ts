import { LANDMARK } from './landmarkIds';
import { NativePosePacket, normalizeNativePose } from './normalizeNativePose';

const packet = (overrides: Partial<NativePosePacket> = {}): NativePosePacket => ({
  timestamp: 100, imageWidth: 1920, imageHeight: 1080, orientation: 'upright', mirrored: false,
  landmarks: [{ index: 25, x: 0.5, y: 0.75, z: -0.1, visibility: 0.95, presence: 0.8 }],
  ...overrides,
});

describe('native pose normalization', () => {
  test('converts x and z from image-width to image-height units', () => {
    const output = normalizeNativePose(packet());
    expect(output).toMatchObject({ timestamp: 100, aspectRatio: 16 / 9, source: 'native' });
    expect(output?.landmarks[0]).toEqual({ id: LANDMARK.LEFT_KNEE, x: 0.5 * 16 / 9, y: 0.75, z: -0.1 * 16 / 9, visibility: 0.8 });
  });

  test('retains off-image points for conservative clipping decisions', () => {
    const output = normalizeNativePose(packet({ landmarks: [{ index: 27, x: -0.1, y: 1.2, visibility: 0.9 }] }));
    expect(output?.landmarks[0].x).toBeCloseTo(-0.1 * 16 / 9);
    expect(output?.landmarks[0].y).toBe(1.2);
  });

  test('uses minimum presence/visibility and does not invent missing evidence', () => {
    const output = normalizeNativePose(packet({ landmarks: [
      { index: 11, x: 0.1, y: 0.1, visibility: 0.7 },
      { index: 12, x: 0.2, y: 0.1, presence: 0.6 },
      { index: 23, x: 0.1, y: 0.5 },
      { index: 24, x: 0.2, y: 0.5, visibility: 0.2, presence: 0.95 },
    ] }));
    expect(output?.landmarks.map((p) => p.visibility)).toEqual([0.7, 0.6, undefined, 0.2]);
  });

  test('clamps finite native confidence to its documented unit interval', () => {
    const output = normalizeNativePose(packet({ landmarks: [
      { index: 11, x: 0, y: 0, visibility: -0.1 },
      { index: 12, x: 0, y: 0, visibility: 1.1 },
    ] }));
    expect(output?.landmarks.map((p) => p.visibility)).toEqual([0, 1]);
  });

  test('unknown, duplicate, invalid coordinate/confidence/depth points are omitted', () => {
    const output = normalizeNativePose(packet({ landmarks: [
      { index: 99, x: 0, y: 0 },
      { index: 25, x: 0.2, y: 0.2 }, { index: 25, x: 0.3, y: 0.3 },
      { index: 11, x: NaN, y: 0 }, { index: 12, x: 0, y: Infinity },
      { index: 23, x: 0, y: 0, visibility: NaN }, { index: 24, x: 0, y: 0, presence: Infinity },
      { index: 27, x: 0, y: 0, z: NaN },
      { index: 28, x: 0.6, y: 0.8, visibility: 0.9 },
    ] }));
    expect(output?.landmarks).toHaveLength(1);
    expect(output?.landmarks[0].id).toBe(LANDMARK.RIGHT_ANKLE);
  });

  test.each([NaN, Infinity, -Infinity, -1])('invalid timestamp %p is dropped', (timestamp) => {
    expect(normalizeNativePose(packet({ timestamp }))).toBeNull();
  });

  test('timestamp zero and empty detections are legitimate frames', () => {
    expect(normalizeNativePose(packet({ timestamp: 0, landmarks: [] }))?.landmarks).toEqual([]);
  });

  test.each([0, -1, NaN, Infinity])('invalid dimensions %p are dropped', (value) => {
    expect(normalizeNativePose(packet({ imageWidth: value }))).toBeNull();
    expect(normalizeNativePose(packet({ imageHeight: value }))).toBeNull();
  });

  test('overflow/underflow aspect ratios are dropped and scaled overflow points omitted', () => {
    expect(normalizeNativePose(packet({ imageWidth: Number.MAX_VALUE, imageHeight: Number.MIN_VALUE }))).toBeNull();
    expect(normalizeNativePose(packet({ imageWidth: Number.MIN_VALUE, imageHeight: Number.MAX_VALUE }))).toBeNull();
    expect(normalizeNativePose(packet({ imageWidth: 2, imageHeight: 1, landmarks: [{ index: 25, x: Number.MAX_VALUE, y: 1 }] }))?.landmarks).toEqual([]);
  });

  test('upright unmirrored contract is enforced rather than silently misinterpreted', () => {
    expect(normalizeNativePose({ ...packet(), mirrored: true } as unknown as NativePosePacket)).toBeNull();
    expect(normalizeNativePose({ ...packet(), orientation: 'landscape' } as unknown as NativePosePacket)).toBeNull();
  });

  test('input arrays remain unchanged and normalization is deterministic', () => {
    const input = packet();
    Object.freeze(input.landmarks[0]);
    Object.freeze(input.landmarks);
    Object.freeze(input);
    expect(normalizeNativePose(input)).toEqual(normalizeNativePose(input));
    expect(input.landmarks[0].x).toBe(0.5);
  });
});
