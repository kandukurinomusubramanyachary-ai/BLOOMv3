import { LANDMARK } from '../pose/landmarkIds';
import type { PoseFrame, PoseLandmark } from '../pose/types';

export interface SquatPoseOptions {
  timestamp?: number;
  kneeAngle?: number;
  leftKneeAngle?: number;
  rightKneeAngle?: number;
  visibility?: number;
  missing?: readonly string[];
  torsoLeanDegrees?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  /** Adversarial fixture: bends knees but moves whole pose so hips never drop. */
  keepHipHeight?: boolean;
}

/** Tests/dev tools only. Bilateral image-space geometry with constant limb lengths. */
export function createSquatPose(options: SquatPoseOptions = {}): PoseFrame {
  const { timestamp = 0, kneeAngle = 173, visibility = 0.98, scale = 1, offsetX = 0, offsetY = 0, torsoLeanDegrees = 5 } = options;
  const points: PoseLandmark[] = [];
  for (const [side, ankleX, angle] of [
    ['LEFT', 0.4, options.leftKneeAngle ?? kneeAngle],
    ['RIGHT', 0.6, options.rightKneeAngle ?? kneeAngle],
  ] as const) {
    const radians = (180 - angle) / 2 * Math.PI / 180;
    const shinY = 0.22 * Math.cos(radians);
    const kneeX = ankleX + 0.22 * Math.sin(radians);
    const hipY = 0.88 - 2 * shinY;
    const shiftY = options.keepHipHeight ? (0.88 - 0.44 * Math.cos(3.5 * Math.PI / 180)) - hipY : 0;
    const joints = [
      [LANDMARK[`${side}_SHOULDER`], ankleX - Math.tan(torsoLeanDegrees * Math.PI / 180) * 0.25, hipY - 0.25],
      [LANDMARK[`${side}_HIP`], ankleX, hipY],
      [LANDMARK[`${side}_KNEE`], kneeX, 0.88 - shinY],
      [LANDMARK[`${side}_ANKLE`], ankleX, 0.88],
    ] as const;
    for (const [id, x, y] of joints) {
      if (!options.missing?.includes(id)) points.push({ id, x: 0.5 + (x - 0.5) * scale + offsetX, y: 0.5 + (y + shiftY - 0.5) * scale + offsetY, visibility });
    }
  }
  return { timestamp, landmarks: points, source: 'simulator', aspectRatio: 1 };
}

export function createAngleSequence(angles: readonly number[], options: Omit<SquatPoseOptions, 'timestamp' | 'kneeAngle'> & { startTimestamp?: number; frameIntervalMs?: number } = {}): PoseFrame[] {
  const { startTimestamp = 0, frameIntervalMs = 50, ...poseOptions } = options;
  return angles.map((kneeAngle, index) => createSquatPose({ ...poseOptions, kneeAngle, timestamp: startTimestamp + index * frameIntervalMs }));
}

export function holdAngle(angle: number, frames = 8): number[] { return Array.from({ length: frames }, () => angle); }
export function angleRamp(from: number, to: number, frames = 14): number[] {
  return Array.from({ length: frames }, (_, index) => from + (to - from) * (index + 1) / frames);
}
