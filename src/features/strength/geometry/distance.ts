import { isFinitePoint, MaybePoint } from './point';

/** Euclidean distance in the input unit; null when invalid or unrepresentable. */
export function distance(a: MaybePoint, b: MaybePoint): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const result = Math.hypot(a.x - b.x, a.y - b.y);
  return Number.isFinite(result) ? result : null;
}
