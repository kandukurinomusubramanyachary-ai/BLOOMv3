import {SquatEngine} from '../exercises/squat/squat.engine';
import {FeedbackThrottler} from '../feedback/feedbackThrottler';
import {LandmarkSmoother} from '../pose/landmarkSmoother';
import type {PoseFrame} from '../pose/types';
import {SetupReadiness} from './setupReadiness';

/** Session-local processing only. No storage, camera dependency or network calls. */
export class TrackingSession {
  private readonly engine = new SquatEngine();
  private readonly smoother = new LandmarkSmoother();
  private readonly readiness = new SetupReadiness();
  private readonly feedback = new FeedbackThrottler();
  private phase: 'setup'|'workout' = 'setup';
  private lastTimestamp: number | null = null;
  private lastReceipt: number | null = null;
  private message: {text:string;timestamp:number}|null = null;
  private feedbackEnabled = true;

  getSnapshot() {
    return {result:this.engine.getResult(), readiness:this.readiness.getResult(), feedback:this.message?.text ?? null};
  }

  process(frame:PoseFrame, receivedAt:number) {
    if (!Number.isFinite(receivedAt) || !Number.isFinite(frame.timestamp) || frame.timestamp < 0 ||
        (this.lastTimestamp !== null && frame.timestamp <= this.lastTimestamp)) return this.getSnapshot();
    this.lastTimestamp = frame.timestamp;
    this.lastReceipt = receivedAt;
    this.readiness.process(frame);
    const result = this.phase === 'workout' ? this.engine.process(this.smoother.process(frame)) : this.engine.getResult();
    if (this.feedbackEnabled && this.phase === 'workout') {
      const emitted = this.feedback.process(result.formFlags, frame.timestamp);
      if (emitted) this.message = {text:emitted.message,timestamp:frame.timestamp};
      else if (this.message && frame.timestamp-this.message.timestamp>3500) this.message=null;
    }
    return {...this.getSnapshot(),result};
  }

  beginWorkout(now:number):boolean {
    if (!this.readiness.getResult().ready || this.lastReceipt===null || now-this.lastReceipt>750 || now<this.lastReceipt) return false;
    this.phase='workout';
    this.engine.reset(); this.smoother.reset(); this.feedback.reset(); this.message=null;
    return true;
  }

  /** Revokes readiness and aborts a partial cycle when callbacks stop. */
  checkFreshness(now:number):boolean {
    if (this.lastReceipt===null || now-this.lastReceipt>750 || now<this.lastReceipt) {
      this.invalidate();
      return false;
    }
    return true;
  }

  invalidate() {
    this.engine.invalidateTracking(); this.readiness.invalidate(); this.smoother.reset();
    this.feedback.reset(); this.message=null; this.lastReceipt=null;
    return this.getSnapshot();
  }

  /** A new native capture run may restart its monotonic timestamp at zero. */
  restartCapture() {
    this.invalidate(); this.lastTimestamp=null;
  }

  setup() {
    this.phase='setup'; this.engine.reset(); this.restartCapture();
  }

  setFeedbackEnabled(enabled:boolean) {
    this.feedbackEnabled=enabled; this.feedback.reset(); this.message=null;
  }
}
export type TrackingSessionSnapshot = ReturnType<TrackingSession['getSnapshot']>;
