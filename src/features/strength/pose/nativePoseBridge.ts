import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativePosePacket } from './normalizeNativePose';
import { NativePoseDriver } from './poseAdapter';

interface NativeSubscription { remove(): void }

/** Required Expo module ABI. This file only binds an installed native module; it
 * contains no inference substitute. Its matching Expo view manager MUST be named
 * BloomPoseLandmarker, show the same capture session, and emit upright unmirrored
 * image-space coordinates. A native development build and a bundled MediaPipe
 * Pose Landmarker model are required; Expo Go does not include this module.
 */
interface BloomPoseLandmarkerModule {
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  addListener(event: 'onPose', listener: (packet: NativePosePacket) => void): NativeSubscription;
  addListener(event: 'onPoseError', listener: (event: { message: string }) => void): NativeSubscription;
}

export function createNativePoseDriver(): NativePoseDriver | undefined {
  const module = requireOptionalNativeModule<BloomPoseLandmarkerModule>('BloomPoseLandmarker');
  if (!module) return undefined;
  return {
    isAvailable: () => module.isAvailable(),
    initialize: () => module.initialize(),
    start: () => module.start(),
    stop: () => module.stop(),
    dispose: () => module.dispose(),
    subscribeFrames: (listener) => {
      const subscription = module.addListener('onPose', listener);
      return () => subscription.remove();
    },
    subscribeErrors: (listener) => {
      const subscription = module.addListener('onPoseError', ({ message }) => listener(message));
      return () => subscription.remove();
    },
  };
}
