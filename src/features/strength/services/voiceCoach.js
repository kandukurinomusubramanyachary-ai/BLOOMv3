export function createVoiceCoach() {
  // Native has no speech adapter installed; preserve all visual controls.
  return {
    available: false, muted: false,
    activate() { return false; }, speak() { return false; },
    cancel() {}, clearChannel() {}, setMuted() {}, pause() {}, resume() {}, dispose() {},
  };
}
