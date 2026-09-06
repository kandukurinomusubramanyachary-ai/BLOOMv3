import { calculateAngle } from '../../geometry/angle';
import { distance } from '../../geometry/distance';
import { midpoint } from '../../geometry/midpoint';
import { symmetry } from '../../geometry/symmetry';
import { verticalAlignment } from '../../geometry/alignment';
import { LANDMARK, REQUIRED_LANDMARK_IDS } from '../../pose/landmarkIds';
import type { PoseFrame, PoseLandmark, TrackingStatus } from '../../pose/types';
import { resolveSquatConfig } from './squat.config';
import { formFlag, observeSquatForm } from './squat.form';
import type { FormFlag, SquatConfig, SquatEvent, SquatMetrics, SquatResult, SquatState } from './squat.types';

const emptyMetrics = (): SquatMetrics => ({ leftKneeAngle: null, rightKneeAngle: null, hipAngle: null, symmetry: null, torsoLean: null, bodyHeight: null });
interface Evidence {
  status: TrackingStatus;
  confidence: number;
  metrics: SquatMetrics;
  flags: FormFlag[];
  kneeAngle: number | null;
  hipY: number | null;
  legLength: number | null;
}

/** Pure evidence checks. A held or incomplete bilateral pose never advances a cycle. */
function inspectPose(frame: PoseFrame, config: SquatConfig): Evidence {
  const base: Evidence = { status: 'NO_POSE', confidence: 0, metrics: emptyMetrics(), flags: [], kneeAngle: null, hipY: null, legLength: null };
  if (frame.landmarks.length === 0) return { ...base, flags: [formFlag('TRACKING_UNAVAILABLE')] };
  const points = new Map<string, PoseLandmark>();
  let duplicate = false;
  for (const point of frame.landmarks) {
    if (REQUIRED_LANDMARK_IDS.some(id => id === point.id)) {
      if (points.has(point.id)) duplicate = true;
      points.set(point.id, point);
    }
  }
  const required = REQUIRED_LANDMARK_IDS.map(id => points.get(id));
  const confidence = required.reduce((sum, point) => sum + (point?.visibility !== undefined && Number.isFinite(point.visibility) && point.visibility >= 0 && point.visibility <= 1 ? point.visibility : 0), 0) / REQUIRED_LANDMARK_IDS.length;
  if (duplicate || required.some(point => !point)) {
    return { ...base, confidence, status: 'LOW_CONFIDENCE', flags: [formFlag('BODY_NOT_VISIBLE')] };
  }
  const present = required as PoseLandmark[];
  if (present.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)
    || (point.z !== undefined && !Number.isFinite(point.z))
    || point.visibility === undefined || !Number.isFinite(point.visibility)
    || point.visibility < config.minimumVisibility || point.visibility > 1)
    || frame.heldLandmarkIds?.some(id => points.has(id))) {
    return { ...base, confidence, status: 'LOW_CONFIDENCE', flags: [formFlag('TRACKING_UNAVAILABLE')] };
  }
  const aspectRatio = frame.aspectRatio ?? 1;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0 || present.some(point => point.x <= config.edgeMargin || point.x >= aspectRatio - config.edgeMargin || point.y <= config.edgeMargin || point.y >= 1 - config.edgeMargin)) {
    return { ...base, confidence, status: 'LOW_CONFIDENCE', flags: [formFlag('BODY_NOT_VISIBLE')] };
  }
  const leftShoulder = points.get(LANDMARK.LEFT_SHOULDER)!;
  const rightShoulder = points.get(LANDMARK.RIGHT_SHOULDER)!;
  const leftHip = points.get(LANDMARK.LEFT_HIP)!;
  const rightHip = points.get(LANDMARK.RIGHT_HIP)!;
  const leftKnee = points.get(LANDMARK.LEFT_KNEE)!;
  const rightKnee = points.get(LANDMARK.RIGHT_KNEE)!;
  const leftAnkle = points.get(LANDMARK.LEFT_ANKLE)!;
  const rightAnkle = points.get(LANDMARK.RIGHT_ANKLE)!;
  const leftAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
  const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
  const shoulders = midpoint(leftShoulder, rightShoulder);
  const hips = midpoint(leftHip, rightHip);
  const lengths = [distance(leftHip, leftKnee), distance(leftKnee, leftAnkle), distance(rightHip, rightKnee), distance(rightKnee, rightAnkle)];
  const bodyHeight = Math.max(...present.map(point => point.y)) - Math.min(...present.map(point => point.y));
  const metrics: SquatMetrics = {
    leftKneeAngle: leftAngle, rightKneeAngle: rightAngle,
    hipAngle: leftHipAngle === null || rightHipAngle === null ? null : (leftHipAngle + rightHipAngle) / 2,
    symmetry: leftAngle === null || rightAngle === null ? null : symmetry(leftAngle, rightAngle),
    torsoLean: verticalAlignment(shoulders, hips), bodyHeight,
  };
  const flags = observeSquatForm(metrics, config);
  if (bodyHeight < config.minimumBodyHeight) {
    return { ...base, confidence: confidence * Math.max(0, bodyHeight / config.minimumBodyHeight), metrics, status: 'LOW_CONFIDENCE', flags: [formFlag('TOO_FAR')] };
  }
  const malformed = leftAngle === null || rightAngle === null || metrics.hipAngle === null || metrics.torsoLean === null
    || lengths.some(length => length === null || length < config.minimumLimbLength)
    || !(leftShoulder.y < leftHip.y && rightShoulder.y < rightHip.y && leftHip.y < leftKnee.y && rightHip.y < rightKnee.y && leftKnee.y < leftAnkle.y && rightKnee.y < rightAnkle.y);
  if (malformed) return { ...base, confidence: 0, metrics, status: 'LOW_CONFIDENCE', flags: [formFlag('BODY_NOT_VISIBLE')] };
  const [leftThigh, leftShin, rightThigh, rightShin] = lengths as number[];
  const limbDifference = Math.max(symmetry(leftThigh, rightThigh) ?? 1, symmetry(leftShin, rightShin) ?? 1, symmetry(leftThigh, leftShin) ?? 1, symmetry(rightThigh, rightShin) ?? 1);
  const angularDifference = Math.abs(leftAngle! - rightAngle!);
  const evidenceConfidence = confidence * (1 - angularDifference / 180) * (1 - limbDifference);
  if (angularDifference > config.maximumKneeDifference || limbDifference > config.maximumLimbAsymmetry) {
    return { ...base, confidence: evidenceConfidence, metrics, status: 'LOW_CONFIDENCE', flags: [formFlag('LEFT_RIGHT_DIFFERENCE')] };
  }
  return { status: 'TRACKING', confidence: evidenceConfidence, metrics, flags, kneeAngle: (leftAngle! + rightAngle!) / 2, hipY: hips!.y, legLength: (leftThigh + leftShin + rightThigh + rightShin) / 2 };
}

/** Deterministic, session-scoped state machine. No camera, React, timers, or storage. */
export class SquatEngine {
  readonly config: Readonly<SquatConfig>;
  private state: SquatState = 'STANDING';
  private reps = 0;
  private armed = false;
  private lastTimestamp: number | null = null;
  private lastValidTimestamp: number | null = null;
  private baselineHipY: number | null = null;
  private baselineLegLength: number | null = null;
  private cycleStarted: number | null = null;
  private candidate: { key: string; count: number; started: number } | null = null;
  private shallowUntil = 0;
  private result: SquatResult = this.snapshot('INITIALIZING');

  constructor(config: Partial<SquatConfig> = {}) { this.config = resolveSquatConfig(config); }

  reset(): void {
    this.reps = 0;
    this.lastTimestamp = null;
    this.lastValidTimestamp = null;
    this.clearCycle();
    this.result = this.snapshot('INITIALIZING');
  }

  /** Suspending capture invalidates partial reps while preserving completed work. */
  invalidateTracking(): SquatResult {
    this.clearCycle();
    this.lastValidTimestamp = null;
    this.result = this.snapshot('NO_POSE', [formFlag('TRACKING_UNAVAILABLE')]);
    return this.getResult();
  }

  /** Reading state cannot replay events. Only process() emits new events. */
  getResult(): SquatResult { return { ...this.result, events: [] }; }

  process(frame: PoseFrame): SquatResult {
    if (!Number.isFinite(frame.timestamp) || frame.timestamp < 0
      || (this.lastTimestamp !== null && frame.timestamp <= this.lastTimestamp)) {
      this.clearCycle();
      this.result = this.snapshot('LOW_CONFIDENCE', [formFlag('TRACKING_UNAVAILABLE')]);
      return this.result;
    }
    if (this.lastTimestamp !== null && frame.timestamp - this.lastTimestamp > this.config.maximumFrameGapMs) this.clearCycle();
    this.lastTimestamp = frame.timestamp;
    const evidence = inspectPose(frame, this.config);
    const events: SquatEvent[] = [];
    if (evidence.status !== 'TRACKING') {
      this.candidate = null;
      if (this.lastValidTimestamp !== null && frame.timestamp - this.lastValidTimestamp > this.config.maximumTrackingLossMs) this.clearCycle();
    } else {
      if (this.lastValidTimestamp !== null && frame.timestamp - this.lastValidTimestamp > this.config.maximumTrackingLossMs) this.clearCycle();
      this.lastValidTimestamp = frame.timestamp;
      if (this.cycleStarted !== null && frame.timestamp - this.cycleStarted > this.config.maximumCycleMs) this.clearCycle();
      this.advance(evidence, frame.timestamp, events);
    }
    const formFlags = [...evidence.flags];
    if (evidence.status === 'TRACKING' && frame.timestamp < this.shallowUntil) formFlags.push(formFlag('SHALLOW_RANGE'));
    this.result = { state: this.state, reps: this.reps, confidence: evidence.confidence, metrics: evidence.metrics, events, formFlags, trackingStatus: evidence.status };
    return this.result;
  }

  private snapshot(status: TrackingStatus, formFlags: FormFlag[] = []): SquatResult {
    return { state: this.state, reps: this.reps, confidence: 0, metrics: emptyMetrics(), events: [], formFlags, trackingStatus: status };
  }

  private clearCycle(): void {
    this.state = 'STANDING';
    this.armed = false;
    this.baselineHipY = null;
    this.baselineLegLength = null;
    this.cycleStarted = null;
    this.candidate = null;
    this.shallowUntil = 0;
  }

  private stable(key: string | null, timestamp: number): boolean {
    if (!key) { this.candidate = null; return false; }
    if (this.candidate?.key !== key) this.candidate = { key, count: 1, started: timestamp };
    else this.candidate.count += 1;
    return this.candidate.count >= this.config.stableFrames && timestamp - this.candidate.started >= this.config.stableDurationMs;
  }

  private transition(state: SquatState, timestamp: number, events: SquatEvent[]): void {
    this.state = state;
    this.candidate = null;
    events.push({ type: 'STATE_CHANGED', exercise: 'SQUAT', state, timestamp });
  }

  private advance(evidence: Evidence, timestamp: number, events: SquatEvent[]): void {
    const knee = evidence.kneeAngle!;
    // Both knees must satisfy terminal thresholds; their average alone is insufficient.
    const standing = Math.min(evidence.metrics.leftKneeAngle!, evidence.metrics.rightKneeAngle!) >= this.config.standingAngle;
    const bottom = Math.max(evidence.metrics.leftKneeAngle!, evidence.metrics.rightKneeAngle!) <= this.config.bottomAngle
      && this.baselineHipY !== null && this.baselineLegLength !== null
      && evidence.hipY! - this.baselineHipY >= this.baselineLegLength * this.config.minimumHipDropRatio;

    if (!this.armed) {
      if (this.stable(standing ? 'BASELINE' : null, timestamp)) {
        this.armed = true;
        this.baselineHipY = evidence.hipY;
        this.baselineLegLength = evidence.legLength;
        this.candidate = null;
      }
      return;
    }
    if (this.state === 'STANDING') {
      if (standing) {
        this.baselineHipY = evidence.hipY;
        this.baselineLegLength = evidence.legLength;
      }
      if (this.stable(knee <= this.config.descentAngle ? 'DESCENDING' : null, timestamp)) {
        this.cycleStarted = this.candidate!.started;
        this.shallowUntil = 0;
        this.transition('DESCENDING', timestamp, events);
      }
    } else if (this.state === 'DESCENDING') {
      if (this.stable(bottom ? 'BOTTOM' : standing ? 'ABORT' : null, timestamp)) {
        if (bottom) this.transition('BOTTOM', timestamp, events);
        else {
          this.cycleStarted = null;
          this.shallowUntil = timestamp + this.config.shallowObservationMs;
          this.transition('STANDING', timestamp, events);
        }
      }
    } else if (this.state === 'BOTTOM') {
      // A complete ascent requires observed intermediate frames; a one-frame
      // jump from bottom to straight legs cannot create the ASCENDING phase.
      if (this.stable(knee >= this.config.ascentAngle && !standing ? 'ASCENDING' : null, timestamp)) {
        this.transition('ASCENDING', timestamp, events);
      }
    } else if (this.state === 'ASCENDING') {
      if (this.stable(standing ? 'COMPLETE' : bottom ? 'BOTTOM' : null, timestamp)) {
        if (bottom) this.transition('BOTTOM', timestamp, events);
        else {
          const duration = this.cycleStarted === null ? 0 : timestamp - this.cycleStarted;
          this.transition('STANDING', timestamp, events);
          if (duration >= this.config.minimumCycleMs && duration <= this.config.maximumCycleMs) {
            this.reps += 1;
            events.push({ type: 'REP_COMPLETED', exercise: 'SQUAT', reps: this.reps, timestamp });
          }
          this.cycleStarted = null;
        }
      }
    }
  }
}
