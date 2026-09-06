export interface Point {
  readonly x: number;
  readonly y: number;
}

export type MaybePoint = Point | null | undefined;

export function isFinitePoint(point: MaybePoint): point is Point {
  return point != null && Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** Scaling before subtraction avoids overflow with extreme finite coordinates. */
export function scaledVector(a: Point, b: Point, scale: number): Point {
  return { x: a.x / scale - b.x / scale, y: a.y / scale - b.y / scale };
}
