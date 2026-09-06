import { PoseFrame, PoseLandmark } from './types';

export interface LandmarkSmootherOptions {
  /** Weight of the newest observation (0, 1]. Larger values reduce latency. */
  readonly alpha?: number;
  readonly minVisibility?: number;
  /** Maximum age of a retained observation, milliseconds. */
  readonly maxHoldMs?: number;
}

interface Observation {
  readonly point: PoseLandmark;
  readonly observedAt: number;
}

/** Ephemeral EMA, reset between sessions. Missing/low-confidence points are
 * retained for maxHoldMs only and marked held; held points cannot advance an
 * exercise engine or camera readiness. Long loss produces an empty frame.
 * Duplicate, out-of-order, and invalid timestamps return the previous output
 * unchanged (or a safe empty timestamp-0 frame before the first observation).
 */
export class LandmarkSmoother {
  private readonly alpha: number;
  private readonly minVisibility: number;
  private readonly maxHoldMs: number;
  private observations = new Map<string, Observation>();
  private lastOutput: PoseFrame | null = null;

  constructor(options: LandmarkSmootherOptions = {}) {
    this.alpha = options.alpha ?? 0.55;
    this.minVisibility = options.minVisibility ?? 0.6;
    this.maxHoldMs = options.maxHoldMs ?? 150;
    if (!Number.isFinite(this.alpha) || this.alpha <= 0 || this.alpha > 1 ||
        !Number.isFinite(this.minVisibility) || this.minVisibility < 0 || this.minVisibility > 1 ||
        !Number.isFinite(this.maxHoldMs) || this.maxHoldMs < 0) {
      throw new RangeError('Invalid landmark smoothing configuration.');
    }
  }

  process(frame: PoseFrame): PoseFrame {
    if (!Number.isFinite(frame.timestamp) || frame.timestamp < 0 ||
        (this.lastOutput !== null && frame.timestamp <= this.lastOutput.timestamp)) {
      return this.lastOutput ?? { timestamp: 0, landmarks: [], heldLandmarkIds: [] };
    }
    const next = new Map<string, Observation>();
    const held = new Set(frame.heldLandmarkIds ?? []);
    const counts = new Map<string, number>();
    for (const point of frame.landmarks) counts.set(point.id, (counts.get(point.id) ?? 0) + 1);
    for (const point of frame.landmarks) {
      if (counts.get(point.id) !== 1 || held.has(point.id) || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
          (point.z !== undefined && !Number.isFinite(point.z)) || point.visibility === undefined ||
          !Number.isFinite(point.visibility) || point.visibility < this.minVisibility || point.visibility > 1) continue;
      const previous = this.observations.get(point.id);
      const canSmooth = previous !== undefined && frame.timestamp - previous.observedAt <= this.maxHoldMs;
      const blend = (oldValue: number, newValue: number): number => (1 - this.alpha) * oldValue + this.alpha * newValue;
      const smoothed: PoseLandmark = canSmooth ? {
        ...point,
        x: blend(previous.point.x, point.x),
        y: blend(previous.point.y, point.y),
        ...(point.z !== undefined && previous.point.z !== undefined ? { z: blend(previous.point.z, point.z) } : {}),
      } : { ...point };
      if (!Number.isFinite(smoothed.x) || !Number.isFinite(smoothed.y) ||
          (smoothed.z !== undefined && !Number.isFinite(smoothed.z))) continue;
      next.set(point.id, { point: smoothed, observedAt: frame.timestamp });
    }
    const heldLandmarkIds: string[] = [];
    for (const [id, previous] of this.observations) {
      if (!next.has(id) && frame.timestamp - previous.observedAt <= this.maxHoldMs) {
        next.set(id, previous);
        heldLandmarkIds.push(id);
      }
    }
    this.observations = next;
    this.lastOutput = {
      ...frame,
      landmarks: [...next.values()].map(({ point }) => ({ ...point })),
      heldLandmarkIds,
    };
    return this.lastOutput;
  }

  reset(): void {
    this.observations.clear();
    this.lastOutput = null;
  }
}
