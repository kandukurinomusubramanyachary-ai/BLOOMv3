import { SquatEngine } from '../exercises/squat/squat.engine';
import type { SquatEvent, SquatResult } from '../exercises/squat/squat.types';
import type { PoseFrame } from '../pose/types';
import { angleRamp, createAngleSequence, holdAngle } from './poseFactory';

export interface SquatSequenceOptions {
  startKneeAngle?: number;
  bottomKneeAngle?: number;
  repetitions?: number;
  startTimestamp?: number;
  frameIntervalMs?: number;
  visibility?: number;
}

/** Offline playback requires no renderer, clocks, camera, or native module. */
export function createSquatSequence(options: SquatSequenceOptions = {}): PoseFrame[] {
  const { startKneeAngle = 173, bottomKneeAngle = 90, repetitions = 1 } = options;
  if (!Number.isInteger(repetitions) || repetitions < 0 || repetitions > 1000) throw new Error('Repetitions must be an integer from 0 to 1000.');
  const angles = holdAngle(startKneeAngle);
  for (let rep = 0; rep < repetitions; rep += 1) {
    angles.push(...angleRamp(startKneeAngle, bottomKneeAngle), ...holdAngle(bottomKneeAngle), ...angleRamp(bottomKneeAngle, startKneeAngle), ...holdAngle(startKneeAngle));
  }
  return createAngleSequence(angles, { startTimestamp: options.startTimestamp, frameIntervalMs: options.frameIntervalMs, visibility: options.visibility });
}

export interface SimulationResult {
  readonly results: readonly SquatResult[];
  readonly finalResult: SquatResult;
  readonly events: readonly SquatEvent[];
}
export function simulatePoseSequence(frames: readonly PoseFrame[], engine: SquatEngine = new SquatEngine()): SimulationResult {
  const results = frames.map(frame => engine.process(frame));
  return { results, finalResult: results[results.length - 1] ?? engine.getResult(), events: results.flatMap(result => result.events) };
}

/** Step-by-step playback for development screens; timing is caller-owned. */
export class PoseSequenceSimulator {
  private cursor = 0;
  constructor(readonly frames: readonly PoseFrame[], readonly engine: SquatEngine = new SquatEngine()) {}
  get done(): boolean { return this.cursor >= this.frames.length; }
  get index(): number { return this.cursor; }
  step(): SquatResult | null { return this.done ? null : this.engine.process(this.frames[this.cursor++]); }
  reset(): void { this.cursor = 0; this.engine.reset(); }
  run(): SimulationResult {
    const result = simulatePoseSequence(this.frames.slice(this.cursor), this.engine);
    this.cursor = this.frames.length;
    return result;
  }
}
