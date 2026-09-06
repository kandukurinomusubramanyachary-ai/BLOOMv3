import { NativePosePacket } from './normalizeNativePose';
import { PoseFrame } from './types';

export type CameraPermissionStatus = 'UNDETERMINED' | 'GRANTED' | 'DENIED' | 'BLOCKED';
export type PoseAdapterStatus = 'IDLE' | 'INITIALIZING' | 'READY' | 'RUNNING' | 'UNAVAILABLE' | 'ERROR' | 'DISPOSED';

export interface CameraPermissionProvider {
  getStatus(): Promise<CameraPermissionStatus>;
  request(): Promise<CameraPermissionStatus>;
}

export interface PoseAdapterSnapshot {
  readonly status: PoseAdapterStatus;
  readonly permission: CameraPermissionStatus;
  readonly available: boolean;
  readonly error: string | null;
}

export interface PoseAdapter {
  getSnapshot(): PoseAdapterSnapshot;
  initialize(): Promise<void>;
  requestPermission(): Promise<CameraPermissionStatus>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  subscribeFrames(listener: (frame: PoseFrame) => void): () => void;
  subscribeState(listener: (snapshot: PoseAdapterSnapshot) => void): () => void;
}

/** A real native implementation owns both its camera capture session and preview.
 * Never open Expo CameraView concurrently with this driver's camera. Native code
 * must perform local inference only, never persist frames or pose landmarks, and
 * release the capture session/model in dispose(). initialize()/dispose() must be
 * safe after partial initialization failure. start() starts a fresh timestamp
 * session. Native errors must stop inference and reach subscribeErrors().
 */
export interface NativePoseDriver {
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  subscribeFrames(listener: (packet: NativePosePacket) => void): () => void;
  subscribeErrors(listener: (error: string) => void): () => void;
}
