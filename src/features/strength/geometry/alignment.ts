import { isFinitePoint, MaybePoint, scaledVector } from './point';

/** Unsigned deviation from the vertical axis, degrees [0, 90]. */
export function verticalAlignment(a: MaybePoint, b: MaybePoint): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const scale = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y));
  if (scale === 0) return null;
  const delta = scaledVector(a, b, scale);
  if (delta.x === 0 && delta.y === 0) return null;
  const result = Math.atan2(Math.abs(delta.x), Math.abs(delta.y)) * 180 / Math.PI;
  return Number.isFinite(result) ? result : null;
}
