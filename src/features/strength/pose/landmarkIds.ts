export const LANDMARK = {
  LEFT_SHOULDER: 'left_shoulder', RIGHT_SHOULDER: 'right_shoulder',
  LEFT_HIP: 'left_hip', RIGHT_HIP: 'right_hip',
  LEFT_KNEE: 'left_knee', RIGHT_KNEE: 'right_knee',
  LEFT_ANKLE: 'left_ankle', RIGHT_ANKLE: 'right_ankle',
} as const;

export const MEDIAPIPE_LANDMARK_IDS: Readonly<Record<number, string>> = {
  11: LANDMARK.LEFT_SHOULDER, 12: LANDMARK.RIGHT_SHOULDER,
  23: LANDMARK.LEFT_HIP, 24: LANDMARK.RIGHT_HIP,
  25: LANDMARK.LEFT_KNEE, 26: LANDMARK.RIGHT_KNEE,
  27: LANDMARK.LEFT_ANKLE, 28: LANDMARK.RIGHT_ANKLE,
};

export const REQUIRED_LANDMARK_IDS = Object.values(LANDMARK);
