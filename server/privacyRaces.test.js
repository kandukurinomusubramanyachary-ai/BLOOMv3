const test = require('node:test');
const assert = require('node:assert/strict');
const work = require('../src/services/accountWork');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('privacy deletion waits for in-flight writes and fences stale continuations', async () => {
  let resolve;
  const gate = new Promise(done => { resolve = done; });
  const stages = [];
  const uid = 'synthetic-drain';
  const pending = work.track(uid, async check => { stages.push('started'); await gate; check(); stages.push('late-write'); });
  const rejected = assert.rejects(pending, /account data changed/);
  await tick();
  const resume = work.pause(uid);
  const drained = work.drain(uid).then(() => stages.push('delete'));
  await tick();
  assert.deepEqual(stages, ['started']);
  resolve(); await rejected; await drained; resume();
  assert.deepEqual(stages, ['started', 'delete']);
});

test('paused accounts cannot start new writes and deletion timeout cannot imply completion', async () => {
  let resolve;
  const uid = 'synthetic-timeout';
  const pending = work.track(uid, () => new Promise(done => { resolve = done; }));
  const rejected = assert.rejects(pending, /account data changed/);
  await tick(); const resume = work.pause(uid);
  await assert.rejects(work.track(uid, () => { throw Error('must not run'); }), /account data changed/);
  await assert.rejects(work.drain(uid, 5), /Pending saves have not finished/);
  resolve(); await rejected; await work.drain(uid); resume();
  assert.equal(await work.track(uid, () => 'new session'), 'new session');
});
