import type { TrackingStatus } from '../../pose/types';

export type SquatState = 'STANDING' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';
export type FormFlagCode = 'SHALLOW_RANGE' | 'LEFT_RIGHT_DIFFERENCE' | 'TORSO_LEAN' | 'TRACKING_UNAVAILABLE' | 'TOO_FAR' | 'BODY_NOT_VISIBLE';
export interface FormFlag {
  readonly code: FormFlagCode;
  readonly severity: 'INFO';
  readonly message: string;
  readonly priority: number;
}
export interface SquatMetrics {
  readonly leftKneeAngle: number | null;
  readonly rightKneeAngle: number | null;
  readonly hipAngle: number | null;
  readonly symmetry: number | null;
  readonly torsoLean: number | null;
  readonly bodyHeight: number | null;
}
export type SquatEvent =
  | { readonly type: 'REP_COMPLETED'; readonly exercise: 'SQUAT'; readonly reps: number; readonly timestamp: number }
  | { readonly type: 'STATE_CHANGED'; readonly exercise: 'SQUAT'; readonly state: SquatState; readonly timestamp: number };
export interface SquatResult {
  readonly state: SquatState;
  readonly reps: number;
  readonly confidence: number;
  readonly metrics: SquatMetrics;
  readonly events: readonly SquatEvent[];
  /** Observations are candidates; FeedbackThrottler controls user-facing emission. */
  readonly formFlags: readonly FormFlag[];
  readonly trackingStatus: TrackingStatus;
}

export interface SquatConfig {
  targetReps: number;
  minimumVisibility: number;
  standingAngle: number;
  descentAngle: number;
  bottomAngle: number;
  ascentAngle: number;
  stableFrames: number;
  stableDurationMs: number;
  minimumCycleMs: number;
  maximumCycleMs: number;
  maximumFrameGapMs: number;
  maximumTrackingLossMs: number;
  maximumKneeDifference: number;
  maximumLimbAsymmetry: number;
  minimumBodyHeight: number;
  minimumLimbLength: number;
  edgeMargin: number;
  minimumHipDropRatio: number;
  torsoLeanObservationAngle: number;
  shallowObservationMs: number;
}
