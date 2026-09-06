import { createNativePoseAdapter } from './nativePoseAdapter';
import { NativePosePacket } from './normalizeNativePose';
import { CameraPermissionProvider, CameraPermissionStatus, NativePoseDriver } from './poseAdapter';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(permission: CameraPermissionStatus = 'GRANTED') {
  const frameListeners = new Set<(packet: NativePosePacket) => void>();
  const errorListeners = new Set<(error: string) => void>();
  const permissions = {
    getStatus: jest.fn(async (): Promise<CameraPermissionStatus> => permission),
    request: jest.fn(async (): Promise<CameraPermissionStatus> => permission),
  } satisfies CameraPermissionProvider;
  const driver = {
    isAvailable: jest.fn(async () => true),
    initialize: jest.fn(async () => undefined),
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
    subscribeFrames: jest.fn((listener: (packet: NativePosePacket) => void) => {
      frameListeners.add(listener);
      return jest.fn(() => { frameListeners.delete(listener); });
    }),
    subscribeErrors: jest.fn((listener: (error: string) => void) => {
      errorListeners.add(listener);
      return jest.fn(() => { errorListeners.delete(listener); });
    }),
  } satisfies NativePoseDriver;
  return {
    permissions, driver, frameListeners, errorListeners,
    adapter: createNativePoseAdapter({ driver, permissions }),
    emit: (packet: NativePosePacket) => { for (const listener of frameListeners) listener(packet); },
    fail: (error: string) => { for (const listener of errorListeners) listener(error); },
  };
}

const packet = (timestamp = 100): NativePosePacket => ({
  timestamp, imageWidth: 1080, imageHeight: 1920, orientation: 'upright', mirrored: false,
  landmarks: [{ index: 25, x: 0.5, y: 0.5, visibility: 0.9, presence: 0.8 }],
});

describe('native pose adapter boundary without native dependencies', () => {
  test('missing native module is honestly unavailable and never produces frames', async () => {
    const { permissions } = harness();
    const adapter = createNativePoseAdapter({ permissions });
    const frames = jest.fn();
    adapter.subscribeFrames(frames);
    await adapter.initialize();
    await adapter.start();
    expect(adapter.getSnapshot()).toEqual({ status: 'UNAVAILABLE', permission: 'GRANTED', available: false, error: null });
    expect(frames).not.toHaveBeenCalled();
    await adapter.dispose();
  });

  test('device can explicitly report an installed driver unavailable', async () => {
    const h = harness();
    h.driver.isAvailable.mockResolvedValue(false);
    await h.adapter.initialize();
    expect(h.adapter.getSnapshot().status).toBe('UNAVAILABLE');
    expect(h.driver.initialize).not.toHaveBeenCalled();
  });

  test.each<CameraPermissionStatus>(['UNDETERMINED', 'DENIED', 'BLOCKED'])('does not initialize camera with %s permission', async (permission) => {
    const h = harness(permission);
    await h.adapter.start();
    expect(h.adapter.getSnapshot()).toMatchObject({ permission, status: 'IDLE', available: true });
    expect(h.driver.initialize).not.toHaveBeenCalled();
    expect(h.driver.start).not.toHaveBeenCalled();
    expect(h.permissions.request).not.toHaveBeenCalled();
  });

  test('explicit request updates permission; granted permission enables initialization', async () => {
    const h = harness('DENIED');
    await h.adapter.initialize();
    h.permissions.request.mockResolvedValue('GRANTED');
    h.permissions.getStatus.mockResolvedValue('GRANTED');
    expect(await h.adapter.requestPermission()).toBe('GRANTED');
    await h.adapter.start();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'RUNNING', permission: 'GRANTED' });
    expect(h.driver.initialize).toHaveBeenCalledTimes(1);
  });

  test('rechecks permission before starting an initialized camera', async () => {
    const h = harness();
    await h.adapter.initialize();
    h.permissions.getStatus.mockResolvedValue('BLOCKED');
    await h.adapter.start();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'IDLE', permission: 'BLOCKED' });
    expect(h.driver.start).not.toHaveBeenCalled();
  });

  test('revoked permission stops an active session and detaches callbacks', async () => {
    const h = harness();
    await h.adapter.start();
    h.permissions.request.mockResolvedValue('DENIED');
    await h.adapter.requestPermission();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'IDLE', permission: 'DENIED' });
    expect(h.driver.stop).toHaveBeenCalledTimes(1);
    expect(h.frameListeners.size).toBe(0);
  });

  test('concurrent initialize/start requests are serialized and idempotent', async () => {
    const h = harness();
    await Promise.all([h.adapter.initialize(), h.adapter.initialize(), h.adapter.start(), h.adapter.start()]);
    expect(h.driver.initialize).toHaveBeenCalledTimes(1);
    expect(h.driver.start).toHaveBeenCalledTimes(1);
    expect(h.frameListeners.size).toBe(1);
    expect(h.errorListeners.size).toBe(1);
  });

  test('normalizes frames, preserves confidence, and drops invalid/stale/duplicate timestamps', async () => {
    const h = harness();
    const frames = jest.fn();
    h.adapter.subscribeFrames(frames);
    await h.adapter.start();
    h.emit(packet(100));
    h.emit(packet(100));
    h.emit(packet(99));
    h.emit(packet(NaN));
    h.emit(packet(101));
    expect(frames).toHaveBeenCalledTimes(2);
    expect(frames.mock.calls[0][0]).toMatchObject({ timestamp: 100, source: 'native', landmarks: [{ id: 'left_knee', x: 0.28125, visibility: 0.8 }] });
  });

  test('stop releases subscriptions and ignores already queued native callbacks', async () => {
    const h = harness();
    const frames = jest.fn();
    h.adapter.subscribeFrames(frames);
    await h.adapter.start();
    const staleCallback = [...h.frameListeners][0];
    await h.adapter.stop();
    expect(h.adapter.getSnapshot().status).toBe('READY');
    expect(h.frameListeners.size).toBe(0);
    expect(h.errorListeners.size).toBe(0);
    staleCallback(packet(100));
    expect(frames).not.toHaveBeenCalled();
    await h.adapter.start();
    staleCallback(packet(100));
    h.emit(packet(0));
    expect(frames).toHaveBeenCalledTimes(1);
    expect(frames.mock.calls[0][0].timestamp).toBe(0);
  });

  test('frame and state consumers can unsubscribe without affecting other listeners', async () => {
    const h = harness();
    const frames = jest.fn();
    const states = jest.fn();
    const offFrames = h.adapter.subscribeFrames(frames);
    const offStates = h.adapter.subscribeState(states);
    await h.adapter.start();
    offFrames();
    offStates();
    states.mockClear();
    h.emit(packet());
    await h.adapter.stop();
    expect(frames).not.toHaveBeenCalled();
    expect(states).not.toHaveBeenCalled();
  });

  test('subscriber exceptions cannot interrupt lifecycle or other consumers', async () => {
    const h = harness();
    h.adapter.subscribeState(() => { throw new Error('consumer'); });
    h.adapter.subscribeFrames(() => { throw new Error('consumer'); });
    const frames = jest.fn();
    h.adapter.subscribeFrames(frames);
    await h.adapter.start();
    h.emit(packet());
    expect(frames).toHaveBeenCalledTimes(1);
    await h.adapter.dispose();
    expect(h.driver.dispose).toHaveBeenCalledTimes(1);
  });

  test('initialization failure is explicit and cleans partial native resources', async () => {
    const h = harness();
    h.driver.initialize.mockRejectedValueOnce(new Error('Model not found'));
    await h.adapter.initialize();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'ERROR', error: 'Model not found' });
    expect(h.driver.dispose).toHaveBeenCalledTimes(1);
    expect(h.frameListeners.size).toBe(0);
    await h.adapter.start();
    expect(h.adapter.getSnapshot().status).toBe('RUNNING');
    expect(h.driver.initialize).toHaveBeenCalledTimes(2);
  });

  test('permission and availability lookup failures are visible without touching camera', async () => {
    const h = harness();
    h.permissions.getStatus.mockRejectedValueOnce(new Error('Permission lookup failed'));
    await h.adapter.initialize();
    expect(h.adapter.getSnapshot().error).toBe('Permission lookup failed');
    h.driver.isAvailable.mockRejectedValueOnce(new Error('Device check failed'));
    await h.adapter.initialize();
    expect(h.adapter.getSnapshot().error).toBe('Device check failed');
    expect(h.driver.initialize).not.toHaveBeenCalled();
  });

  test('permission request failure is explicit and preserves known permission', async () => {
    const h = harness('DENIED');
    await h.adapter.initialize();
    h.permissions.request.mockRejectedValueOnce(new Error('Request failed'));
    expect(await h.adapter.requestPermission()).toBe('DENIED');
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'ERROR', error: 'Request failed' });
  });

  test('start failure detaches subscriptions and stops the camera', async () => {
    const h = harness();
    h.driver.start.mockRejectedValueOnce(new Error('Camera busy'));
    await h.adapter.start();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'ERROR', error: 'Camera busy' });
    expect(h.driver.stop).toHaveBeenCalledTimes(1);
    expect(h.frameListeners.size).toBe(0);
    expect(h.errorListeners.size).toBe(0);
    await h.adapter.start();
    expect(h.adapter.getSnapshot().status).toBe('RUNNING');
  });

  test('failure while subscribing releases previously created subscriptions', async () => {
    const h = harness();
    h.driver.subscribeErrors.mockImplementationOnce(() => { throw new Error('Event setup failed'); });
    await h.adapter.start();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'ERROR', error: 'Event setup failed' });
    expect(h.frameListeners.size).toBe(0);
  });

  test('runtime inference error revokes tracking and does not get hidden by cleanup', async () => {
    const h = harness();
    await h.adapter.start();
    h.fail('Inference failed');
    await h.adapter.initialize(); // Drain queued error cleanup without starting again.
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'ERROR', error: 'Inference failed' });
    expect(h.driver.stop).toHaveBeenCalledTimes(1);
    expect(h.frameListeners.size).toBe(0);
    expect(h.errorListeners.size).toBe(0);
  });

  test('runtime error during pending native start cannot become RUNNING afterward', async () => {
    const h = harness();
    const entered = deferred();
    const release = deferred();
    h.driver.start.mockImplementationOnce(async () => { entered.resolve(); await release.promise; });
    const starting = h.adapter.start();
    await entered.promise;
    h.fail('Capture disconnected');
    release.resolve();
    await starting;
    await h.adapter.initialize();
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'ERROR', error: 'Capture disconnected' });
    expect(h.frameListeners.size).toBe(0);
  });

  test('disposal during initialization waits for native completion and remains terminal', async () => {
    const h = harness();
    const entered = deferred();
    const release = deferred();
    h.driver.initialize.mockImplementationOnce(async () => { entered.resolve(); await release.promise; });
    const initializing = h.adapter.initialize();
    await entered.promise;
    const disposing = h.adapter.dispose();
    expect(h.adapter.getSnapshot().status).toBe('DISPOSED');
    release.resolve();
    await Promise.all([initializing, disposing]);
    expect(h.driver.dispose).toHaveBeenCalledTimes(1);
    expect(h.driver.start).not.toHaveBeenCalled();
    expect(h.adapter.getSnapshot().status).toBe('DISPOSED');
  });

  test('disposal during start drops callbacks and releases resources exactly once', async () => {
    const h = harness();
    const entered = deferred();
    const release = deferred();
    const frames = jest.fn();
    h.adapter.subscribeFrames(frames);
    h.driver.start.mockImplementationOnce(async () => { entered.resolve(); await release.promise; });
    const starting = h.adapter.start();
    await entered.promise;
    const staleCallback = [...h.frameListeners][0];
    const disposing = h.adapter.dispose();
    staleCallback(packet());
    release.resolve();
    await Promise.all([starting, disposing, h.adapter.dispose()]);
    expect(h.driver.dispose).toHaveBeenCalledTimes(1);
    expect(h.frameListeners.size).toBe(0);
    expect(h.errorListeners.size).toBe(0);
    expect(frames).not.toHaveBeenCalled();
  });

  test('dispose still releases model if stop throws and exposes cleanup failure', async () => {
    const h = harness();
    await h.adapter.start();
    h.driver.stop.mockRejectedValueOnce(new Error('Stop failed'));
    await h.adapter.dispose();
    expect(h.driver.dispose).toHaveBeenCalledTimes(1);
    expect(h.adapter.getSnapshot()).toMatchObject({ status: 'DISPOSED', error: 'Stop failed', available: false });
  });

  test('cleanup is retried on dispose if failed initialization cleanup could not release resources', async () => {
    const h = harness();
    h.driver.initialize.mockRejectedValueOnce(new Error('Initialization failed'));
    h.driver.dispose.mockRejectedValueOnce(new Error('Cleanup failed'));
    await h.adapter.initialize();
    await h.adapter.dispose();
    expect(h.driver.dispose).toHaveBeenCalledTimes(2);
  });

  test('after disposal all calls are inert and no native camera can restart', async () => {
    const h = harness();
    await h.adapter.dispose();
    await Promise.all([h.adapter.start(), h.adapter.stop(), h.adapter.initialize(), h.adapter.requestPermission()]);
    h.adapter.subscribeFrames(jest.fn());
    h.adapter.subscribeState(jest.fn());
    expect(h.driver.initialize).not.toHaveBeenCalled();
    expect(h.permissions.request).not.toHaveBeenCalled();
    expect(h.adapter.getSnapshot().status).toBe('DISPOSED');
  });
});
