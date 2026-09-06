import { LandmarkSmoother } from '../pose/landmarkSmoother';
import { LANDMARK } from '../pose/landmarkIds';
import { SquatEngine } from '../exercises/squat/squat.engine';
import { createSquatSequence, PoseSequenceSimulator, simulatePoseSequence } from './poseSequenceSimulator';
import { SQUAT_FIXTURES } from './squatFixtures';

describe('offline pose simulation', () => {
  test('replaying the same frames yields identical metrics, states and events', () => {
    const frames = createSquatSequence({ repetitions: 3 });
    expect(simulatePoseSequence(frames)).toEqual(simulatePoseSequence(frames));
  });

  test.each(SQUAT_FIXTURES)('real smoothing + engine: $label → $expectedReps reps', fixture => {
    const smoother = new LandmarkSmoother();
    const frames = fixture.createFrames().map(frame => smoother.process(frame));
    expect(simulatePoseSequence(frames).finalResult.reps).toBe(fixture.expectedReps);
  });

  test('short held points do not establish false stability via the pipeline', () => {
    const smoother = new LandmarkSmoother();
    const engine = new SquatEngine();
    const frames = createSquatSequence().map(frame => ({ ...frame, landmarks: frame.timestamp > 500 ? frame.landmarks.filter(point => point.id !== LANDMARK.RIGHT_KNEE) : frame.landmarks }));
    const outputs = frames.map(frame => engine.process(smoother.process(frame)));
    expect(outputs[outputs.length - 1].reps).toBe(0);
    expect(outputs.slice(11).every(output => output.trackingStatus !== 'TRACKING')).toBe(true);
  });

  test('simulator steps, finishes and resets without clocks or device dependencies', () => {
    const frames = createSquatSequence();
    const simulator = new PoseSequenceSimulator(frames);
    expect(simulator.index).toBe(0);
    expect(simulator.step()?.reps).toBe(0);
    expect(simulator.index).toBe(1);
    expect(simulator.run().finalResult.reps).toBe(1);
    expect(simulator.done).toBe(true);
    expect(simulator.step()).toBeNull();
    simulator.reset();
    expect(simulator.done).toBe(false);
    expect(simulator.engine.getResult().reps).toBe(0);
    expect(simulator.run().finalResult.reps).toBe(1);
  });

  test('empty sequence has a real initializing snapshot', () => {
    expect(simulatePoseSequence([])).toMatchObject({ results: [], events: [], finalResult: { reps: 0, trackingStatus: 'INITIALIZING', confidence: 0 } });
  });

  test('fixture timestamps are ordered and bilateral frames are ephemeral', () => {
    const frames = createSquatSequence();
    expect(frames.every((frame, index) => frame.source === 'simulator' && (index === 0 || frame.timestamp > frames[index - 1].timestamp))).toBe(true);
    expect(frames[0].landmarks).not.toBe(frames[1].landmarks);
    expect(() => createSquatSequence({ repetitions: -1 })).toThrow();
  });
});
