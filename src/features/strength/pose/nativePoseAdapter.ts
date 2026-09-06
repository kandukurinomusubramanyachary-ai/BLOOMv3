import { normalizeNativePose } from './normalizeNativePose';
import { CameraPermissionProvider, CameraPermissionStatus, NativePoseDriver, PoseAdapter, PoseAdapterSnapshot } from './poseAdapter';
import { PoseFrame } from './types';

export interface NativePoseAdapterOptions {
  readonly driver?: NativePoseDriver;
  readonly permissions: CameraPermissionProvider;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Serializes native lifecycle calls, while disposal immediately invalidates
 * callbacks. No pose/video is persisted or buffered. Lifecycle errors are exposed
 * in snapshots; callers can retry initialize/start after a recoverable error.
 */
export class NativePoseAdapter implements PoseAdapter {
  private snapshot: PoseAdapterSnapshot;
  private readonly frames = new Set<(frame: PoseFrame) => void>();
  private readonly states = new Set<(state: PoseAdapterSnapshot) => void>();
  private unsubscribers: (() => void)[] = [];
  private tail: Promise<void> = Promise.resolve();
  private disposal: Promise<void> | null = null;
  private initialized = false;
  private driverTouched = false;
  private disposed = false;
  private acceptingFrames = false;
  private lastTimestamp: number | null = null;
  private faultRevision = 0;
  private subscriptionRevision = 0;

  constructor(private readonly options: NativePoseAdapterOptions) {
    this.snapshot = { status: options.driver ? 'IDLE' : 'UNAVAILABLE', permission: 'UNDETERMINED', available: false, error: null };
  }

  getSnapshot(): PoseAdapterSnapshot {
    return this.snapshot;
  }

  subscribeFrames(listener: (frame: PoseFrame) => void): () => void {
    if (!this.disposed) this.frames.add(listener);
    return () => { this.frames.delete(listener); };
  }

  subscribeState(listener: (snapshot: PoseAdapterSnapshot) => void): () => void {
    if (!this.disposed) this.states.add(listener);
    return () => { this.states.delete(listener); };
  }

  private update(change: Partial<PoseAdapterSnapshot>): void {
    if (this.disposed && change.status !== 'DISPOSED') return;
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.states) {
      // A UI subscriber failure must not strand the camera lifecycle.
      try { listener(this.snapshot); } catch { /* Isolate consumer callbacks. */ }
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }

  private detach(): void {
    this.subscriptionRevision += 1;
    const subscriptions = this.unsubscribers;
    this.unsubscribers = [];
    for (const unsubscribe of subscriptions) {
      try { unsubscribe(); } catch { /* Continue releasing remaining subscriptions. */ }
    }
  }

  private async initializeInside(): Promise<void> {
    if (this.disposed || this.initialized) return;
    this.update({ status: 'INITIALIZING', error: null });
    const driver = this.options.driver;
    try {
      const permission = await this.options.permissions.getStatus();
      if (this.disposed) return;
      this.update({ permission });
      if (!driver) {
        this.update({ status: 'UNAVAILABLE', available: false });
        return;
      }
      const available = await driver.isAvailable();
      if (this.disposed) return;
      this.update({ available });
      if (!available) {
        this.update({ status: 'UNAVAILABLE' });
        return;
      }
      if (permission !== 'GRANTED') {
        this.update({ status: 'IDLE' });
        return;
      }
      this.driverTouched = true;
      await driver.initialize();
      if (this.disposed) return;
      this.initialized = true;
      this.update({ status: 'READY', error: null });
    } catch (error) {
      this.initialized = false;
      this.detach();
      if (driver && this.driverTouched && !this.disposed) {
        try {
          await driver.dispose();
          this.driverTouched = false;
        } catch { /* Preserve the initialization error; disposal will retry cleanup. */ }
      }
      this.update({ status: 'ERROR', error: errorMessage(error) });
    }
  }

  initialize(): Promise<void> {
    return this.enqueue(() => this.initializeInside());
  }

  requestPermission(): Promise<CameraPermissionStatus> {
    return this.enqueue(async () => {
      if (this.disposed) return this.snapshot.permission;
      try {
        const permission = await this.options.permissions.request();
        this.update({ permission, error: null });
        if (!this.disposed && permission !== 'GRANTED' && this.snapshot.status === 'RUNNING') {
          this.acceptingFrames = false;
          this.detach();
          await this.options.driver?.stop();
          this.update({ status: 'IDLE' });
        }
        return this.disposed ? this.snapshot.permission : permission;
      } catch (error) {
        this.update({ status: 'ERROR', error: errorMessage(error) });
        return this.snapshot.permission;
      }
    });
  }

  start(): Promise<void> {
    return this.enqueue(async () => {
      if (this.disposed || this.snapshot.status === 'RUNNING') return;
      await this.initializeInside();
      const driver = this.options.driver;
      if (this.disposed || !driver || !this.initialized) return;
      try {
        const permission = await this.options.permissions.getStatus();
        if (this.disposed) return;
        this.update({ permission });
        if (permission !== 'GRANTED') {
          this.update({ status: 'IDLE' });
          return;
        }
        this.detach();
        this.lastTimestamp = null;
        const revision = this.faultRevision;
        const subscriptionRevision = this.subscriptionRevision;
        this.unsubscribers.push(driver.subscribeFrames((packet) => {
          if (this.disposed || !this.acceptingFrames || subscriptionRevision !== this.subscriptionRevision) return;
          const frame = normalizeNativePose(packet);
          if (!frame || (this.lastTimestamp !== null && frame.timestamp <= this.lastTimestamp)) return;
          this.lastTimestamp = frame.timestamp;
          for (const listener of this.frames) {
            try { listener(frame); } catch { /* Isolate consumer callbacks. */ }
          }
        }));
        this.unsubscribers.push(driver.subscribeErrors((error) => {
          if (this.disposed || subscriptionRevision !== this.subscriptionRevision) return;
          this.faultRevision += 1;
          this.acceptingFrames = false;
          this.detach();
          this.update({ status: 'ERROR', error });
          void this.enqueue(async () => {
            if (!this.disposed) {
              try { await driver.stop(); } catch { /* Preserve reported inference error. */ }
            }
          });
        }));
        await driver.start();
        if (this.disposed || revision !== this.faultRevision) {
          this.detach();
          return;
        }
        this.acceptingFrames = true;
        this.update({ status: 'RUNNING', error: null });
      } catch (error) {
        this.acceptingFrames = false;
        this.detach();
        try { await driver.stop(); } catch { /* Preserve original start error. */ }
        this.update({ status: 'ERROR', error: errorMessage(error) });
      }
    });
  }

  stop(): Promise<void> {
    this.acceptingFrames = false;
    return this.enqueue(async () => {
      if (this.disposed) return;
      this.acceptingFrames = false;
      this.detach();
      try {
        if (this.options.driver && this.driverTouched) await this.options.driver.stop();
        this.update({ status: this.initialized ? 'READY' : this.options.driver ? 'IDLE' : 'UNAVAILABLE' });
      } catch (error) {
        this.update({ status: 'ERROR', error: errorMessage(error) });
      }
    });
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.acceptingFrames = false;
    this.detach();
    this.update({ status: 'DISPOSED', available: false });
    this.frames.clear();
    this.states.clear();
    this.disposal = this.enqueue(async () => {
      const driver = this.options.driver;
      let cleanupError: string | null = null;
      if (driver && this.driverTouched) {
        try { await driver.stop(); } catch (error) { cleanupError = errorMessage(error); }
        try { await driver.dispose(); } catch (error) { cleanupError = errorMessage(error); }
      }
      this.initialized = false;
      this.driverTouched = false;
      this.lastTimestamp = null;
      if (cleanupError) this.update({ status: 'DISPOSED', error: cleanupError });
    });
    return this.disposal;
  }
}

export function createNativePoseAdapter(options: NativePoseAdapterOptions): PoseAdapter {
  return new NativePoseAdapter(options);
}
