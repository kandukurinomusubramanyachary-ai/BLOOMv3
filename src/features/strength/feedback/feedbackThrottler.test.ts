import { formFlag } from '../exercises/squat/squat.form';
import { FeedbackThrottler } from './feedbackThrottler';

const shallow = formFlag('SHALLOW_RANGE');
const lost = formFlag('TRACKING_UNAVAILABLE');
const lean = formFlag('TORSO_LEAN');
const config = { persistenceFrames: 3, persistenceMs: 100, globalCooldownMs: 500, sameMessageCooldownMs: 2000, absenceToRearmMs: 200 };

describe('FeedbackThrottler', () => {
  test('requires persistent frames and elapsed duration', () => {
    const throttle = new FeedbackThrottler(config);
    expect(throttle.process([shallow], 0)).toBeNull();
    expect(throttle.process([shallow], 50)).toBeNull();
    expect(throttle.process([shallow], 100)).toEqual(shallow);
  });

  test('a brief observation disappearing resets persistence', () => {
    const throttle = new FeedbackThrottler(config);
    throttle.process([shallow], 0);
    throttle.process([], 50);
    expect(throttle.process([shallow], 100)).toBeNull();
    expect(throttle.process([shallow], 150)).toBeNull();
    expect(throttle.process([shallow], 200)).toEqual(shallow);
  });

  test('persistent identical feedback is emitted only once, including beyond cooldown', () => {
    const throttle = new FeedbackThrottler(config);
    const output = Array.from({ length: 200 }, (_, index) => throttle.process([shallow, shallow], index * 50)).filter(Boolean);
    expect(output).toEqual([shallow]);
  });

  test('global cooldown suppresses another observation', () => {
    const throttle = new FeedbackThrottler(config);
    [0, 50, 100].forEach(time => throttle.process([shallow], time));
    expect(throttle.process([lean], 150)).toBeNull();
    expect(throttle.process([lean], 200)).toBeNull();
    expect(throttle.process([lean], 250)).toBeNull();
    [300, 350, 400, 450, 500, 550].forEach(time => expect(throttle.process([lean], time)).toBeNull());
    expect(throttle.process([lean], 600)).toEqual(lean);
  });

  test('highest-priority persistent observation wins independent of input order', () => {
    for (const flags of [[shallow, lean, lost], [lost, lean, shallow]]) {
      const throttle = new FeedbackThrottler(config);
      throttle.process(flags, 0); throttle.process(flags, 50);
      expect(throttle.process(flags, 100)).toEqual(lost);
    }
  });

  test('same-message cooldown persists through disappearance and reappearance', () => {
    const throttle = new FeedbackThrottler(config);
    [0, 50, 100].forEach(time => throttle.process([shallow], time));
    throttle.process([], 350);
    [400, 450, 500].forEach(time => expect(throttle.process([shallow], time)).toBeNull());
    for (let time = 550; time < 2100; time += 50) expect(throttle.process([shallow], time)).toBeNull();
    expect(throttle.process([shallow], 2100)).toEqual(shallow);
  });

  test('large callback gap is not persistence evidence', () => {
    const throttle = new FeedbackThrottler(config);
    throttle.process([shallow], 0); throttle.process([shallow], 50);
    expect(throttle.process([shallow], 1000)).toBeNull();
    expect(throttle.process([shallow], 1050)).toBeNull();
    expect(throttle.process([shallow], 1100)).toEqual(shallow);
  });

  test('duplicate and out-of-order timestamps do not add persistence frames', () => {
    const throttle = new FeedbackThrottler(config);
    throttle.process([shallow], 100);
    expect(throttle.process([shallow], 100)).toBeNull();
    expect(throttle.process([shallow], 50)).toBeNull();
    expect(throttle.process([shallow], NaN)).toBeNull();
    expect(throttle.process([shallow], 150)).toBeNull();
    expect(throttle.process([shallow], 200)).toEqual(shallow);
  });

  test('reset clears persistence, cooldowns, latches and timestamps', () => {
    const throttle = new FeedbackThrottler(config);
    [0, 50, 100].forEach(time => throttle.process([shallow], time));
    throttle.reset();
    expect(throttle.process([shallow], 0)).toBeNull();
    expect(throttle.process([shallow], 50)).toBeNull();
    expect(throttle.process([shallow], 100)).toEqual(shallow);
  });

  test('invalid configuration is explicit', () => {
    expect(() => new FeedbackThrottler({ persistenceFrames: 1 })).toThrow();
    expect(() => new FeedbackThrottler({ persistenceMs: Infinity })).toThrow();
  });
});
