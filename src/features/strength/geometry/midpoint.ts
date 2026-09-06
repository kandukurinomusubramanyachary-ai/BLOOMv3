import { isFinitePoint, MaybePoint, Point } from './point';

/** Null for invalid points. Halving first prevents addition overflow. */
export function midpoint(a: MaybePoint, b: MaybePoint): Point | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  return { x: a.x / 2 + b.x / 2, y: a.y / 2 + b.y / 2 };
}
