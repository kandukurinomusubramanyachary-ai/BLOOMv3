import { isFinitePoint, MaybePoint, scaledVector } from './point';

/** Interior angle ABC in degrees [0, 180]; null for invalid or coincident points. */
export function calculateAngle(a: MaybePoint, b: MaybePoint, c: MaybePoint): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b) || !isFinitePoint(c)) return null;
  const scale = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y), Math.abs(c.x), Math.abs(c.y));
  if (scale === 0) return null;
  const ab = scaledVector(a, b, scale);
  const cb = scaledVector(c, b, scale);
  const abLength = Math.hypot(ab.x, ab.y);
  const cbLength = Math.hypot(cb.x, cb.y);
  if (abLength === 0 || cbLength === 0) return null;
  const cosine = (ab.x / abLength) * (cb.x / cbLength) + (ab.y / abLength) * (cb.y / cbLength);
  const result = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  return Number.isFinite(result) ? result : null;
}
