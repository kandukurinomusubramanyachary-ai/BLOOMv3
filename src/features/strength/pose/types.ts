/** Height-normalized, upright, unmirrored image coordinates. Origin is top-left.
 * y = imageY / imageHeight; x = imageX / imageHeight (range 0..aspectRatio).
 * z, when provided, uses the same image-height unit. No world-space mixing.
 * Off-image coordinates are retained so clipping can be detected. Missing joints
 * are omitted, never replaced with zero. Frames are ephemeral and immutable.
 */
export interface PoseLandmark {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly visibility?: number;
}

export interface PoseFrame {
  /** Monotonic milliseconds within a capture session. */
  readonly timestamp: number;
  readonly landmarks: readonly PoseLandmark[];
  readonly aspectRatio?: number;
  readonly source?: 'native' | 'simulator';
  /** IDs held briefly by the smoother; these must never advance the engine. */
  readonly heldLandmarkIds?: readonly string[];
}

export type TrackingStatus = 'INITIALIZING' | 'TRACKING' | 'LOW_CONFIDENCE' | 'NO_POSE' | 'UNAVAILABLE';
