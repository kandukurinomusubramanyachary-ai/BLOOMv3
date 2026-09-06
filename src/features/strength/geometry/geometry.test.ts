import { calculateAngle, distance, midpoint, symmetry, verticalAlignment } from './index';

describe('pure geometry', () => {
  test('straight joint is 180 degrees', () => {
    expect(calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180);
  });

  test('right angle is 90 degrees', () => {
    expect(calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });

  test('known distance and midpoint', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 1, y: 3 }, { x: 3, y: 7 })).toEqual({ x: 2, y: 5 });
  });

  test('relative symmetry is scale-independent and zero for equal values', () => {
    expect(symmetry(90, 90)).toBe(0);
    expect(symmetry(80, 100)).toBeCloseTo(0.2);
    expect(symmetry(100, 80)).toBeCloseTo(0.2);
    expect(symmetry(0, 0)).toBe(0);
    expect(symmetry(0, 90)).toBe(1);
  });

  test('vertical alignment reports unsigned degrees', () => {
    expect(verticalAlignment({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(0);
    expect(verticalAlignment({ x: 1, y: 2 }, { x: 1, y: 1 })).toBe(0);
    expect(verticalAlignment({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45);
    expect(verticalAlignment({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
  });

  test.each([null, undefined, { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: -Infinity, y: 1 }])('invalid/missing point %p produces null', (bad) => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 1 };
    expect(calculateAngle(bad, a, b)).toBeNull();
    expect(calculateAngle(a, bad, b)).toBeNull();
    expect(calculateAngle(a, b, bad)).toBeNull();
    expect(distance(a, bad)).toBeNull();
    expect(midpoint(bad, a)).toBeNull();
    expect(verticalAlignment(a, bad)).toBeNull();
  });

  test('zero-length vectors never become a valid angle', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 1 };
    expect(calculateAngle(a, a, b)).toBeNull();
    expect(calculateAngle(b, a, a)).toBeNull();
    expect(calculateAngle(a, a, a)).toBeNull();
    expect(verticalAlignment(a, a)).toBeNull();
    expect(distance(a, a)).toBe(0);
  });

  test.each([NaN, Infinity, -Infinity, -1, null, undefined])('symmetry rejects invalid measurement %p', (bad) => {
    expect(symmetry(bad, 90)).toBeNull();
    expect(symmetry(90, bad)).toBeNull();
  });

  test('extreme finite values cannot leak Infinity or NaN', () => {
    const limit = Number.MAX_VALUE;
    expect(calculateAngle({ x: -limit, y: 0 }, { x: 0, y: 0 }, { x: limit, y: 0 })).toBe(180);
    expect(calculateAngle({ x: -limit, y: 0 }, { x: limit, y: 0 }, { x: limit, y: limit })).toBe(90);
    expect(distance({ x: -limit, y: 0 }, { x: limit, y: 0 })).toBeNull();
    expect(midpoint({ x: limit, y: limit }, { x: limit, y: -limit })).toEqual({ x: limit, y: 0 });
    expect(verticalAlignment({ x: -limit, y: 0 }, { x: limit, y: 0 })).toBe(90);
    expect(symmetry(limit, limit / 2)).toBeCloseTo(0.5);
  });

  test('subnormal coordinates remain finite or explicitly unavailable', () => {
    const tiny = Number.MIN_VALUE;
    const angle = calculateAngle({ x: tiny, y: 0 }, { x: 0, y: 0 }, { x: 0, y: tiny });
    expect(angle).toBe(90);
    expect(distance({ x: tiny, y: 0 }, { x: 0, y: 0 })).toBe(tiny);
  });

  test('inputs are immutable and repeated outputs deterministic', () => {
    const a = Object.freeze({ x: 1, y: 1 });
    const b = Object.freeze({ x: 2, y: 2 });
    const c = Object.freeze({ x: 3, y: 1 });
    expect(calculateAngle(a, b, c)).toEqual(calculateAngle(a, b, c));
    midpoint(a, b);
    distance(a, b);
    verticalAlignment(a, b);
    expect(a).toEqual({ x: 1, y: 1 });
  });
});
