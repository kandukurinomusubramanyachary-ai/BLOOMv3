import type { FormFlag, FormFlagCode, SquatConfig, SquatMetrics } from './squat.types';

const OBSERVATIONS: Readonly<Record<FormFlagCode, FormFlag>> = {
  SHALLOW_RANGE: { code: 'SHALLOW_RANGE', severity: 'INFO', priority: 20, message: 'Try going a little deeper if that feels comfortable.' },
  LEFT_RIGHT_DIFFERENCE: { code: 'LEFT_RIGHT_DIFFERENCE', severity: 'INFO', priority: 60, message: 'Let’s slow down and find your balance.' },
  TORSO_LEAN: { code: 'TORSO_LEAN', severity: 'INFO', priority: 30, message: 'Try lifting your chest a little, if that feels comfortable.' },
  TRACKING_UNAVAILABLE: { code: 'TRACKING_UNAVAILABLE', severity: 'INFO', priority: 100, message: 'Tracking is paused. Find a clear, well-lit space when you’re ready.' },
  TOO_FAR: { code: 'TOO_FAR', severity: 'INFO', priority: 80, message: 'Move a little closer while keeping your full body visible.' },
  BODY_NOT_VISIBLE: { code: 'BODY_NOT_VISIBLE', severity: 'INFO', priority: 90, message: 'Move back slightly so your full body stays visible.' },
};

export function formFlag(code: FormFlagCode): FormFlag { return { ...OBSERVATIONS[code] }; }

/** Optional coaching observations only, never diagnosis or an injury assessment. */
export function observeSquatForm(metrics: SquatMetrics, config: SquatConfig): FormFlag[] {
  const observations: FormFlag[] = [];
  if (metrics.leftKneeAngle !== null && metrics.rightKneeAngle !== null
    && Math.abs(metrics.leftKneeAngle - metrics.rightKneeAngle) > config.maximumKneeDifference) {
    observations.push(formFlag('LEFT_RIGHT_DIFFERENCE'));
  }
  if (metrics.torsoLean !== null && metrics.torsoLean > config.torsoLeanObservationAngle) {
    observations.push(formFlag('TORSO_LEAN'));
  }
  return observations;
}
