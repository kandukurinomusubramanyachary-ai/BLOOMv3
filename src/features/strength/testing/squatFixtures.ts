import { LANDMARK } from '../pose/landmarkIds';
import type { PoseFrame } from '../pose/types';
import { angleRamp, createAngleSequence, holdAngle } from './poseFactory';
import { createSquatSequence } from './poseSequenceSimulator';

export type SquatFixtureId = 'valid' | 'three-reps' | 'half' | 'bottom-bounce' | 'standing-jitter' | 'temporary-loss' | 'low-confidence' | 'incomplete-return' | 'valid-then-noise' | 'missing-leg' | 'asymmetric' | 'false-bottom';
export interface SquatFixture {
  readonly id: SquatFixtureId;
  readonly label: string;
  readonly expectedReps: number;
  readonly createFrames: () => PoseFrame[];
}
const partialDescent = () => [...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90)];

/** Synthetic sequences are only imported by tests and the development screen. */
export const SQUAT_FIXTURES: readonly SquatFixture[] = [
  { id: 'valid', label: 'One complete squat', expectedReps: 1, createFrames: () => createSquatSequence() },
  { id: 'three-reps', label: 'Three complete squats', expectedReps: 3, createFrames: () => createSquatSequence({ repetitions: 3 }) },
  { id: 'half', label: 'Half squat', expectedReps: 0, createFrames: () => createSquatSequence({ bottomKneeAngle: 130 }) },
  { id: 'bottom-bounce', label: 'Bottom bouncing', expectedReps: 0, createFrames: () => createAngleSequence([...partialDescent(), ...[90, 95, 100, 102, 98, 94, 90, 100].flatMap(angle => holdAngle(angle, 4))]) },
  { id: 'standing-jitter', label: 'Standing jitter', expectedReps: 0, createFrames: () => createAngleSequence([...holdAngle(173), ...Array.from({ length: 80 }, (_, index) => [164, 166, 152, 154, 168, 172, 149, 167][index % 8])]) },
  { id: 'temporary-loss', label: 'Temporary landmark loss', expectedReps: 0, createFrames: () => {
    const frames = createAngleSequence(partialDescent());
    return [...frames, ...Array.from({ length: 4 }, (_, index) => ({ timestamp: frames[frames.length - 1].timestamp + (index + 1) * 50, landmarks: [], source: 'simulator' as const, aspectRatio: 1 }))];
  } },
  { id: 'low-confidence', label: 'Low confidence', expectedReps: 0, createFrames: () => createSquatSequence({ visibility: 0.2 }) },
  { id: 'incomplete-return', label: 'Incomplete standing return', expectedReps: 0, createFrames: () => createAngleSequence([...partialDescent(), ...angleRamp(90, 155), ...holdAngle(155)]) },
  { id: 'valid-then-noise', label: 'One squat then noise', expectedReps: 1, createFrames: () => {
    const frames = createSquatSequence();
    return [...frames, ...createAngleSequence([90, 173, 151, 95, 173, 130, 90, 165, 151, 105, 175], { startTimestamp: frames[frames.length - 1].timestamp + 50 })];
  } },
  { id: 'missing-leg', label: 'One missing leg', expectedReps: 0, createFrames: () => createSquatSequence().map(frame => ({ ...frame, landmarks: frame.landmarks.filter(point => point.id !== LANDMARK.LEFT_ANKLE) })) },
  { id: 'asymmetric', label: 'Large left/right difference', expectedReps: 0, createFrames: () => createAngleSequence([...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90), ...angleRamp(90, 173), ...holdAngle(173)], { rightKneeAngle: 173 }) },
  { id: 'false-bottom', label: 'Knee bend without hip descent', expectedReps: 0, createFrames: () => createAngleSequence([...holdAngle(173), ...angleRamp(173, 90), ...holdAngle(90), ...angleRamp(90, 173), ...holdAngle(173)], { keepHipHeight: true }) },
];

export function getSquatFixture(id: SquatFixtureId): SquatFixture {
  const fixture = SQUAT_FIXTURES.find(item => item.id === id);
  if (!fixture) throw new Error(`Unknown squat fixture: ${id}`);
  return fixture;
}
