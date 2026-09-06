import type { FormFlag, FormFlagCode } from '../exercises/squat/squat.types';

export interface FeedbackThrottleConfig {
  persistenceFrames: number;
  persistenceMs: number;
  globalCooldownMs: number;
  sameMessageCooldownMs: number;
  absenceToRearmMs: number;
}
const DEFAULTS: FeedbackThrottleConfig = {
  persistenceFrames: 4, persistenceMs: 700, globalCooldownMs: 8000,
  sameMessageCooldownMs: 20000, absenceToRearmMs: 2000,
};
interface Observation {
  since: number;
  frames: number;
  lastSeen: number;
  lastEmitted: number | null;
  latched: boolean;
}

/** Optional frame-driven feedback; uses capture time, never wall-clock timers. */
export class FeedbackThrottler {
  private readonly config: FeedbackThrottleConfig;
  private observations = new Map<FormFlagCode, Observation>();
  private lastTimestamp: number | null = null;
  private lastEmission: number | null = null;

  constructor(config: Partial<FeedbackThrottleConfig> = {}) {
    this.config = { ...DEFAULTS, ...config };
    if (Object.values(this.config).some(value => !Number.isFinite(value) || value < 0)
      || !Number.isInteger(this.config.persistenceFrames) || this.config.persistenceFrames < 2) {
      throw new Error('Feedback persistence must use at least two frames and finite nonnegative durations.');
    }
  }

  reset(): void { this.observations.clear(); this.lastTimestamp = null; this.lastEmission = null; }

  process(flags: readonly FormFlag[], timestamp: number): FormFlag | null {
    if (!Number.isFinite(timestamp) || timestamp < 0 || (this.lastTimestamp !== null && timestamp <= this.lastTimestamp)) return null;
    const previousTimestamp = this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const distinct = new Map(flags.map(flag => [flag.code, flag]));
    for (const [code, observation] of this.observations) {
      if (!distinct.has(code)) {
        observation.frames = 0;
        if (timestamp - observation.lastSeen >= this.config.absenceToRearmMs) observation.latched = false;
      }
    }
    const eligible: FormFlag[] = [];
    for (const flag of distinct.values()) {
      let observation = this.observations.get(flag.code);
      if (!observation) {
        observation = { since: timestamp, frames: 0, lastSeen: timestamp, lastEmitted: null, latched: false };
        this.observations.set(flag.code, observation);
      }
      const gap = timestamp - observation.lastSeen;
      // A large delivery gap is not evidence that an observation persisted.
      if (observation.frames === 0 || (previousTimestamp !== null && timestamp - previousTimestamp > this.config.absenceToRearmMs)) {
        observation.since = timestamp;
        observation.frames = 0;
      }
      if (gap >= this.config.absenceToRearmMs && observation.frames === 0) observation.latched = false;
      observation.frames += 1;
      observation.lastSeen = timestamp;
      if (!observation.latched && observation.frames >= this.config.persistenceFrames
        && timestamp - observation.since >= this.config.persistenceMs
        && (observation.lastEmitted === null || timestamp - observation.lastEmitted >= this.config.sameMessageCooldownMs)) {
        eligible.push(flag);
      }
    }
    if (this.lastEmission !== null && timestamp - this.lastEmission < this.config.globalCooldownMs) return null;
    eligible.sort((a, b) => b.priority - a.priority || a.code.localeCompare(b.code));
    const selected = eligible[0];
    if (!selected) return null;
    const observation = this.observations.get(selected.code)!;
    observation.lastEmitted = timestamp;
    observation.latched = true;
    this.lastEmission = timestamp;
    return { ...selected };
  }
}
