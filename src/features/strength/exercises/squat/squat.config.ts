import type { SquatConfig } from './squat.types';

/** Conservative 2D image-space defaults, to be validated on representative devices. */
export const SQUAT_CONFIG: Readonly<SquatConfig> = Object.freeze({
  targetReps: 8,
  minimumVisibility: 0.7,
  standingAngle: 165,
  descentAngle: 152,
  bottomAngle: 105,
  ascentAngle: 120,
  stableFrames: 3,
  stableDurationMs: 80,
  minimumCycleMs: 650,
  maximumCycleMs: 15000,
  maximumFrameGapMs: 400,
  maximumTrackingLossMs: 600,
  maximumKneeDifference: 25,
  maximumLimbAsymmetry: 0.3,
  minimumBodyHeight: 0.32,
  minimumLimbLength: 0.035,
  edgeMargin: 0.015,
  minimumHipDropRatio: 0.12,
  torsoLeanObservationAngle: 40,
  shallowObservationMs: 2000,
});

export function resolveSquatConfig(overrides: Partial<SquatConfig> = {}): SquatConfig {
  const config = { ...SQUAT_CONFIG, ...overrides };
  if (Object.values(config).some(value => !Number.isFinite(value) || value < 0)
    || config.targetReps !== 8
    || !Number.isInteger(config.stableFrames) || config.stableFrames < 2
    || config.stableDurationMs <= 0 || config.minimumVisibility > 1
    || config.standingAngle > 180 || config.bottomAngle <= 0
    || !(config.bottomAngle < config.ascentAngle && config.ascentAngle < config.descentAngle && config.descentAngle < config.standingAngle)
    || config.minimumCycleMs >= config.maximumCycleMs
    || config.maximumFrameGapMs <= 0 || config.maximumTrackingLossMs <= 0) {
    throw new Error('Invalid squat configuration: check finite thresholds, hysteresis, stability, and timing.');
  }
  return config;
}
