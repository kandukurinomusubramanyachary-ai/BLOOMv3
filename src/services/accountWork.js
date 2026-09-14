// An epoch fences late callbacks from a previous sign-in or privacy deletion.
const accounts = new Map();
function state(uid) {
  if (!accounts.has(uid)) accounts.set(uid, { epoch: 0, blocks: 0, requests: new Set() });
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
module.exports = { epoch, isCurrent, invalidate, pause, request };
