import { LANDMARK } from '../pose/landmarkIds';
import type { PoseFrame, PoseLandmark } from '../pose/types';

export interface SetupReadinessConfig {
  requiredFrames?: number;
  minVisibility?: number;
  /** Shoulder-to-ankle span in image-height units. */
  minBodyHeight?: number;
  maxFrameGapMs?: number;
}

export type SetupIssue = 'SEARCHING' | 'LOW_CONFIDENCE' | 'BODY_CLIPPED' | 'TOO_FAR' | null;

export interface SetupReadinessResult {
  readonly ready: boolean;
  readonly consecutiveFrames: number;
  readonly groups: {
    readonly shoulders: boolean;
    readonly hips: boolean;
    readonly knees: boolean;
    readonly ankles: boolean;
  };
  readonly issue: SetupIssue;
}

const GROUPS = {
  shoulders: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
  hips: [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
  knees: [LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE],
  ankles: [LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_ANKLE],
} as const;

function emptyResult(): SetupReadinessResult {
  return {
    ready: false,
    consecutiveFrames: 0,
    groups: { shoulders: false, hips: false, knees: false, ankles: false },
    issue: 'SEARCHING',
  };
}

/** Readiness requires fresh observations, never elapsed time alone.
 * The owner must invalidate on receipt-time silence, backgrounding, or adapter
 * errors: a capture timestamp cannot prove that a callback arrived recently.
 */
export class SetupReadiness {
  private readonly config: Required<SetupReadinessConfig>;
  private lastTimestamp: number | null = null;
  private result: SetupReadinessResult = emptyResult();

  constructor(config: SetupReadinessConfig = {}) {
    this.config = {
      requiredFrames: config.requiredFrames ?? 10,
      minVisibility: config.minVisibility ?? 0.65,
      minBodyHeight: config.minBodyHeight ?? 0.35,
      maxFrameGapMs: config.maxFrameGapMs ?? 500,
    };
    const { requiredFrames, minVisibility, minBodyHeight, maxFrameGapMs } = this.config;
    if (!Number.isInteger(requiredFrames) || requiredFrames < 1
      || !Number.isFinite(minVisibility) || minVisibility < 0 || minVisibility > 1
      || !Number.isFinite(minBodyHeight) || minBodyHeight <= 0 || minBodyHeight > 1
      || !Number.isFinite(maxFrameGapMs) || maxFrameGapMs <= 0) {
      throw new RangeError('Invalid setup readiness thresholds.');
    }
  }

  process(frame: PoseFrame): SetupReadinessResult {
    if (!Number.isFinite(frame.timestamp) || frame.timestamp < 0) {
      this.invalidate();
      return this.getResult();
    }

    // Repeated or reordered callbacks are not fresh observations and cannot
    // advance the count or replace the last legitimate observation.
    if (this.lastTimestamp !== null && frame.timestamp <= this.lastTimestamp) {
      return this.getResult();
    }
    if (this.lastTimestamp !== null
      && frame.timestamp - this.lastTimestamp >= this.config.maxFrameGapMs) {
      this.result = emptyResult();
    }
    this.lastTimestamp = frame.timestamp;

    const aspectRatio = frame.aspectRatio ?? 1;
    const aspectValid = Number.isFinite(aspectRatio) && aspectRatio > 0;
    const held = new Set(frame.heldLandmarkIds ?? []);
    const landmarks = new Map<string, PoseLandmark>();
    const duplicated = new Set<string>();
    for (const landmark of frame.landmarks) {
      if (landmarks.has(landmark.id)) duplicated.add(landmark.id);
      landmarks.set(landmark.id, landmark);
    }

    let missing = false;
    let lowConfidence = false;
    let clipped = !aspectValid;
    const groups = { shoulders: false, hips: false, knees: false, ankles: false };
    for (const name of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
      groups[name] = GROUPS[name].map((id) => {
        const joint = landmarks.get(id);
        if (!joint) {
          missing = true;
          return false;
        }
        const confident = !held.has(id) && !duplicated.has(id)
          && Number.isFinite(joint.visibility)
          && (joint.visibility ?? 0) >= this.config.minVisibility
          && (joint.visibility ?? 0) <= 1;
        const inBounds = aspectValid && Number.isFinite(joint.x) && Number.isFinite(joint.y)
          && joint.x >= 0 && joint.x <= aspectRatio && joint.y >= 0 && joint.y <= 1;
        if (!confident) lowConfidence = true;
        if (!inBounds) clipped = true;
        return confident && inBounds;
      }).every(Boolean);
    }

    let issue: SetupIssue = missing ? 'SEARCHING'
      : lowConfidence ? 'LOW_CONFIDENCE'
        : clipped ? 'BODY_CLIPPED' : null;
    if (!issue) {
      const shoulderY = Math.min(...GROUPS.shoulders.map((id) => landmarks.get(id)!.y));
      const ankleY = Math.max(...GROUPS.ankles.map((id) => landmarks.get(id)!.y));
      if (ankleY - shoulderY < this.config.minBodyHeight) issue = 'TOO_FAR';
    }

    const consecutiveFrames = issue ? 0
      : Math.min(this.config.requiredFrames, this.result.consecutiveFrames + 1);
    this.result = {
      ready: consecutiveFrames >= this.config.requiredFrames,
      consecutiveFrames,
      groups,
      issue,
    };
    return this.getResult();
  }

  getResult(): SetupReadinessResult {
    return { ...this.result, groups: { ...this.result.groups } };
  }

  reset(): void {
    this.lastTimestamp = null;
    this.result = emptyResult();
  }

  invalidate(): void {
    this.reset();
  }
}
