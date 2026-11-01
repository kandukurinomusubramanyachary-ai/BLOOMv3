const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppLockLifecycle, createUnlockAttemptGuard } = require('../src/services/appLockLifecycle');

test('iOS inactive transitions preserve the original background time and relock at the boundary', () => {
  let now = 0; const lifecycle = createAppLockLifecycle('active', () => now);
  lifecycle.transition('inactive'); now = 1000; lifecycle.transition('background');
  now = 300000; lifecycle.transition('inactive');
  assert.equal(lifecycle.transition('active', { enabled: true, timeoutMinutes: 5 }).lock, true);
});
test('short interruptions and disabled locks do not relock, and each away cycle starts fresh', () => {
  let now = 0; const lifecycle = createAppLockLifecycle('active', () => now);
  lifecycle.transition('inactive'); now = 1000;
  assert.equal(lifecycle.transition('active', { enabled: true, timeoutMinutes: 5 }).lock, false);
  now = 400000; lifecycle.transition('background'); now = 401000;
  assert.equal(lifecycle.transition('active', { enabled: true, timeoutMinutes: 5 }).lock, false);
  lifecycle.transition('background'); now += 400000;
  assert.equal(lifecycle.transition('active', { enabled: false, timeoutMinutes: 5 }).lock, false);
});
test('Android direct background transitions, immediate locks and malformed settings remain safe', () => {
  let now = 0; const lifecycle = createAppLockLifecycle('active', () => now);
  lifecycle.transition('background');
  assert.equal(lifecycle.transition('active', { enabled: true, timeoutMinutes: 0 }).lock, true);
  lifecycle.transition('background'); now += 300000;
  assert.equal(lifecycle.transition('active', { enabled: true, timeoutMinutes: 'bad' }).lock, true);
});
test('late biometric completions cannot unlock a newer lock and concurrent prompts are rejected', async () => {
  const guard = createUnlockAttemptGuard(); const old = guard.begin();
  assert.equal(guard.begin(), null);
  guard.invalidate(); const current = guard.begin();
  let unlocked = false;
  await Promise.resolve().then(() => { if (guard.isCurrent(old)) unlocked = true; });
  assert.equal(unlocked, false);
  guard.finish(old); assert.equal(guard.begin(), null);
  assert.equal(guard.isCurrent(current), true); guard.finish(current);
  assert.notEqual(guard.begin(), null);
});
