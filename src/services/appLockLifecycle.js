// iOS uses active -> inactive -> background -> inactive -> active. Preserve
// the first away timestamp through intermediate states, including interruptions.
function createAppLockLifecycle(initialState = 'active', now = () => Date.now()) {
  let current = initialState;
  let awayAt = current === 'active' ? null : now();
  return {
    transition(next, { enabled = false, timeoutMinutes = 5 } = {}) {
      let lock = false;
      if (next !== 'active') {
        if (awayAt === null) awayAt = now();
      } else if (current !== 'active') {
        const elapsed = Math.max(0, now() - (awayAt ?? now()));
        const configured = Number(timeoutMinutes);
        const timeout = Number.isFinite(configured) && configured >= 0 ? configured : 5;
        lock = enabled && elapsed >= timeout * 60000;
        awayAt = null;
      }
      current = next;
      return { lock };
    },
  };
}

function createUnlockAttemptGuard() {
  let revision = 0;
  let busy = false;
  return {
    invalidate() { revision++; busy = false; },
    begin() { if (busy) return null; busy = true; return revision; },
    isCurrent(token) { return token !== null && token === revision; },
    finish(token) { if (token === revision) busy = false; },
  };
}
module.exports = { createAppLockLifecycle, createUnlockAttemptGuard };
