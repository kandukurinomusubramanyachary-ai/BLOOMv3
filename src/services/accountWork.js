// An epoch fences late callbacks from a previous sign-in or privacy deletion.
const accounts = new Map();
function state(uid) {
  if (!accounts.has(uid)) accounts.set(uid, { epoch: 0, blocks: 0, requests: new Set(), writes: new Set() });
  return accounts.get(uid);
}
function epoch(uid) { return state(uid).epoch; }
function isCurrent(uid, version) { const item = state(uid); return item.epoch === version && !item.blocks; }
function invalidate(uid) {
  const item = state(uid); item.epoch++;
  item.requests.forEach((controller) => controller.abort());
}
function pause(uid) {
  const item = state(uid); item.blocks++; invalidate(uid);
  let released = false;
  return () => { if (!released) { released = true; item.blocks--; } };
}
function request(uid) {
  const item = state(uid);
  if (item.blocks) throw new Error('Bloom is updating your data. Please wait.');
  const controller = new AbortController();
  const version = item.epoch;
  item.requests.add(controller);
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    check: () => {
      if (controller.signal.aborted || !isCurrent(uid, version)) throw new Error('Your account data changed. Please retry.');
    },
    close: () => item.requests.delete(controller),
  };
}
// Register the entire mutation before it can start. Privacy deletion pauses new
// work and drains these promises before deleting records, so a late write cannot
// recreate data after deletion has reported success.
async function track(uid, operation) {
  const item = state(uid);
  const version = item.epoch;
  const check = () => { if (!isCurrent(uid, version)) throw new Error('Your account data changed. Please retry.'); };
  check();
  const pending = Promise.resolve().then(() => { check(); return operation(check); });
  item.writes.add(pending);
  try { const result = await pending; check(); return result; }
  finally { item.writes.delete(pending); }
}
async function drain(uid, timeoutMs = 30000) {
  const pending = [...state(uid).writes];
  if (!pending.length) return;
  let timer;
  try {
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Pending saves have not finished. Reconnect before deleting your data.')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
module.exports = { epoch, isCurrent, invalidate, pause, request, track, drain };
