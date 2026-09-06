import { MEDIAPIPE_LANDMARK_IDS } from './landmarkIds';
import { PoseFrame, PoseLandmark } from './types';

export interface NativePoseLandmark {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  /** MediaPipe normalized-image depth, in image-width units. */
  readonly z?: number;
  readonly visibility?: number;
  readonly presence?: number;
}

/** The native driver must rotate to upright and unmirror inference coordinates.
 * Preview mirroring is a separate UI concern. Dimensions describe the UPRIGHT
 * image, not the sensor buffer. x/y use normalized-image coordinates, with
 * off-image points retained for clipping checks. No world landmarks are accepted.
 */
export interface NativePosePacket {
  readonly timestamp: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly orientation: 'upright';
  readonly mirrored: false;
  readonly landmarks: readonly NativePoseLandmark[];
}

function confidence(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.max(0, Math.min(1, value));
}

/** Invalid packet metadata returns null and must be dropped. Unknown IDs,
 * duplicate IDs, nonfinite points, and invalid confidence/depth are omitted.
 * Timestamps are monotonic capture-session milliseconds; ordering is enforced
 * by the adapter, so this pure conversion is independently replayable.
 */
export function normalizeNativePose(packet: NativePosePacket): PoseFrame | null {
  if (!packet || !Number.isFinite(packet.timestamp) || packet.timestamp < 0 ||
      !Number.isFinite(packet.imageWidth) || packet.imageWidth <= 0 ||
      !Number.isFinite(packet.imageHeight) || packet.imageHeight <= 0 ||
      packet.orientation !== 'upright' || packet.mirrored !== false ||
      !Array.isArray(packet.landmarks)) return null;
  const aspectRatio = packet.imageWidth / packet.imageHeight;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const counts = new Map<number, number>();
  for (const point of packet.landmarks) {
    if (point) counts.set(point.index, (counts.get(point.index) ?? 0) + 1);
  }
  const landmarks: PoseLandmark[] = [];
  for (const point of packet.landmarks) {
    if (!point) continue;
    const id = MEDIAPIPE_LANDMARK_IDS[point.index];
    if (!id || !Number.isInteger(point.index) || counts.get(point.index) !== 1 ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        (point.z !== undefined && !Number.isFinite(point.z)) ||
        (point.visibility !== undefined && !Number.isFinite(point.visibility)) ||
        (point.presence !== undefined && !Number.isFinite(point.presence))) continue;
    const x = point.x * aspectRatio;
    const z = point.z === undefined ? undefined : point.z * aspectRatio;
    if (!Number.isFinite(x) || (z !== undefined && !Number.isFinite(z))) continue;
    const visibility = confidence(point.visibility);
    const presence = confidence(point.presence);
    const combined = visibility === undefined ? presence : presence === undefined ? visibility : Math.min(visibility, presence);
    landmarks.push({ id, x, y: point.y, ...(z === undefined ? {} : { z }), ...(combined === undefined ? {} : { visibility: combined }) });
  }
  return { timestamp: packet.timestamp, landmarks, aspectRatio, source: 'native' };
}
