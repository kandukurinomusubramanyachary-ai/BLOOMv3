const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const accountWork = require('../src/services/accountWork');

function fixture(options = {}) {
  const values = new Map();
  const uploads = [];
  const boundUids = [];
  let reads = 0;
  let writes = 0;
  let globalUid = 'alice';
  const key = (uid, legacy = false) => `@bloom_user:${legacy ? '' : 'v1:'}${encodeURIComponent(uid)}:bloom_strength_outbox_v1`;
  const storage = {
    setUserScope(uid) { globalUid = uid; },
    forUser(uid) {
      if (!uid) throw new Error('signed-in account required');
      boundUids.push(uid);
      return {
        scopedKey: () => key(uid),
        legacyScopedKey: () => key(uid, true),
        async setStrengthOutbox(items) {
          writes += 1;
          await options.onWrite?.(writes, uid);
          values.set(key(uid), JSON.stringify(items));
          return true;
        },
      };
    },
    getStrengthOutbox() { throw new Error(`unbound read for ${globalUid}`); },
    setStrengthOutbox() { throw new Error(`unbound write for ${globalUid}`); },
  };
  const dependencies = {
    '@react-native-async-storage/async-storage': {
      async getItem(storageKey) {
        reads += 1;
        await options.onRead?.(reads, storageKey);
        return values.has(storageKey) ? values.get(storageKey) : null;
      },
    },
    'firebase/firestore': {
      doc: (_db, ...parts) => parts,
      async setDoc(ref, record) {
        uploads.push({ ref, record });
        await options.onUpload?.(ref, record);
      },
      Timestamp: { fromDate: (date) => ({ timestamp: date.toISOString() }) },
    },
    '../../../services/firebase': { db: options.cloudAvailable === false ? null : {} },
    '../../../services/storage': { storage, KEYS: { STRENGTH_OUTBOX: '@bloom_strength_outbox_v1' } },
  };
  const filename = path.resolve(__dirname, '../src/features/strength/services/strengthStorage.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => dependencies[request]
    || require(request.startsWith('.') ? path.resolve(path.dirname(filename), request) : request);
  const timers = options.timers || { setTimeout, clearTimeout };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', transformed.code)(
    localRequire, moduleValue, moduleValue.exports, timers.setTimeout, timers.clearTimeout
  );
  return { ...moduleValue.exports, values, uploads, boundUids, key, storage };
}

function summary(id = 'session-1') {
  return {
    id, exerciseId: 'wall-pushup-v1', exerciseVersion: 1,
    startedAt: '2026-09-11T08:00:00.000Z', completedAt: '2026-09-11T08:01:00.000Z',
    durationSeconds: 60, targetReps: 10, acceptedReps: 10, pauseCount: 0,
    completionState: 'completed', platform: 'web', privacyVersion: 1,
  };
}

function queued(value = summary()) {
  return { summary: value, queuedAt: Date.now(), attempts: 0 };
}

function controlledTimers() {
  let nextId = 1;
  const pending = new Map();
  const delays = [];
  return {
    delays,
    get pendingCount() { return pending.size; },
    setTimeout(callback, delay) {
      const id = nextId++;
      delays.push(delay);
      pending.set(id, callback);
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    fire() {
      assert.ok(pending.size > 0, 'An upload deadline must be armed.');
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback();
      }
    },
  };
}

test('Strength deletion drains the actual upload and cancels queued saves before deleting records', async () => {
  const uid = 'deletion-race';
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const subject = fixture({ onUpload: async () => { entered(); await gate; } });
  const saving = subject.saveStrengthSummary(uid, summary('first'));
  await started;
  const queuedSave = subject.saveStrengthSummary(uid, summary('queued'));
  const failures = Promise.all([assert.rejects(saving, /account data changed/), assert.rejects(queuedSave, /account data changed/)]);
  const resume = accountWork.pause(uid);
  try {
    await assert.rejects(subject.saveStrengthSummary(uid, summary('blocked')), /updating your data/);
    let drained = false;
    const draining = subject.prepareStrengthDataDeletion(uid).then(() => { drained = true; });
    await new Promise(setImmediate);
    assert.equal(drained, false);
    release();
    await draining; await failures;
    assert.equal(subject.uploads.length, 1);
    subject.values.delete(subject.key(uid));
    await new Promise(setImmediate);
    assert.equal(subject.values.has(subject.key(uid)), false);
  } finally { release(); resume(); }
});

test('timed-out SDK uploads block deletion until they really settle', async () => {
  const uid = 'timed-out-deletion';
  const timers = controlledTimers();
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const subject = fixture({ timers, onUpload: async () => { entered(); await gate; } });
  const saving = subject.saveStrengthSummary(uid, summary());
  await started;
  timers.fire();
  assert.equal((await saving).synced, false);
  const resume = accountWork.pause(uid);
  try {
    const failed = assert.rejects(subject.prepareStrengthDataDeletion(uid), /still syncing/);
    await new Promise(setImmediate);
    timers.fire();
    await failed;
    release();
    await new Promise(setImmediate);
    await subject.prepareStrengthDataDeletion(uid);
    assert.equal(timers.pendingCount, 0);
  } finally { release(); resume(); }
});

test('Strength outbox save stays bound to its UID during a global account switch', async () => {
  let subject;
  subject = fixture({ onUpload: async () => { subject.storage.setUserScope('bob'); } });
  subject.values.set(subject.key('bob'), JSON.stringify([queued(summary('bob-session'))]));
  const saved = await subject.saveStrengthSummary('alice', summary());
  assert.equal(saved.synced, true);
  assert.deepEqual(subject.boundUids, ['alice']);
  assert.deepEqual(JSON.parse(subject.values.get(subject.key('alice'))), []);
  assert.equal(JSON.parse(subject.values.get(subject.key('bob')))[0].summary.id, 'bob-session');
  assert.deepEqual(subject.uploads[0].ref, ['users', 'alice', 'strengthSessions', 'session-1']);
  assert.deepEqual(subject.uploads[0].record.startedAt, { timestamp: '2026-09-11T08:00:00.000Z' });
});

test('Strength outbox flush only uploads and rewrites the explicitly requested UID', async () => {
  let subject;
  subject = fixture({ onUpload: async () => { subject.storage.setUserScope('bob'); } });
  subject.values.set(subject.key('alice'), JSON.stringify([queued()]));
  subject.values.set(subject.key('bob'), JSON.stringify([queued(summary('bob-session'))]));
  assert.deepEqual(await subject.flushStrengthOutbox('alice'), { uploaded: 1, remaining: 0 });
  assert.deepEqual(subject.boundUids, ['alice']);
  assert.equal(JSON.parse(subject.values.get(subject.key('bob')))[0].summary.id, 'bob-session');
});

test('Strength outbox cloud failure retains a locally saved summary for retry', async () => {
  const subject = fixture({ cloudAvailable: false });
  const result = await subject.saveStrengthSummary('alice', summary());
  assert.equal(result.synced, false);
  assert.equal(JSON.parse(subject.values.get(subject.key('alice')))[0].summary.id, 'session-1');
  assert.deepEqual(await subject.flushStrengthOutbox('alice'), { uploaded: 0, remaining: 1 });
  assert.equal(JSON.parse(subject.values.get(subject.key('alice')))[0].attempts, 1);
});

test('Strength outbox failed reads reject without uploading or erasing existing summaries', async () => {
  const subject = fixture({ onRead: async () => { throw new Error('read unavailable'); } });
  const existing = JSON.stringify([queued(summary('existing'))]);
  subject.values.set(subject.key('alice'), existing);
  await assert.rejects(subject.saveStrengthSummary('alice', summary()), /could not read sessions waiting to sync/i);
  await assert.rejects(subject.flushStrengthOutbox('alice'), /could not read sessions waiting to sync/i);
  assert.equal(subject.values.get(subject.key('alice')), existing);
  assert.equal(subject.uploads.length, 0);
});

test('Strength outbox enqueue failure rejects and never begins a cloud upload', async () => {
  const subject = fixture({ onWrite: async () => { throw new Error('write failed'); } });
  await assert.rejects(subject.saveStrengthSummary('alice', summary()), /write failed/i);
  assert.equal(subject.uploads.length, 0);
});

test('Strength outbox post-upload cleanup failure is not reported as a saved result', async () => {
  const subject = fixture({ onWrite: async (count) => { if (count === 2) throw new Error('cleanup write failed'); } });
  await assert.rejects(subject.saveStrengthSummary('alice', summary()), /cleanup write failed/i);
  assert.equal(subject.uploads.length, 1);
  assert.equal(JSON.parse(subject.values.get(subject.key('alice')))[0].summary.id, 'session-1');
});

test('Strength outbox flush propagates required final write failures', async () => {
  const subject = fixture({ onWrite: async () => { throw new Error('flush write failed'); } });
  subject.values.set(subject.key('alice'), JSON.stringify([queued()]));
  await assert.rejects(subject.flushStrengthOutbox('alice'), /flush write failed/i);
  assert.equal(JSON.parse(subject.values.get(subject.key('alice'))).length, 1);
});

test('Strength outbox preserves legacy UID-scoped pending summaries', async () => {
  const subject = fixture({ cloudAvailable: false });
  subject.values.set(subject.key('alice', true), JSON.stringify([queued(summary('legacy'))]));
  await subject.saveStrengthSummary('alice', summary('new'));
  assert.deepEqual(JSON.parse(subject.values.get(subject.key('alice'))).map((item) => item.summary.id), ['legacy', 'new']);
});

test('Strength outbox rejects malformed persisted queues rather than overwriting them', async () => {
  const subject = fixture();
  subject.values.set(subject.key('alice'), '{invalid');
  await assert.rejects(subject.saveStrengthSummary('alice', summary()), /could not read sessions waiting to sync/i);
  assert.equal(subject.values.get(subject.key('alice')), '{invalid');
  assert.equal(subject.uploads.length, 0);
});

test('Strength same-UID flush and save cannot overwrite a newly queued offline summary', async () => {
  let releaseUpload;
  let signalUpload;
  const uploading = new Promise((resolve) => { signalUpload = resolve; });
  const holdUpload = new Promise((resolve) => { releaseUpload = resolve; });
  const subject = fixture({
    onUpload: async (_ref, record) => {
      if (record.id === 'existing') {
        signalUpload();
        await holdUpload;
      } else {
        throw new Error('offline');
      }
    },
  });
  subject.values.set(subject.key('alice'), JSON.stringify([queued(summary('existing'))]));
  const flushing = subject.flushStrengthOutbox('alice');
  await uploading;
  const saving = subject.saveStrengthSummary('alice', summary('new'));
  // Let an unguarded save finish its read/write/cloud-failure microtasks while
  // the older flush is still pending; without serialization it gets erased.
  await new Promise(setImmediate);
  releaseUpload();
  assert.deepEqual(await flushing, { uploaded: 1, remaining: 0 });
  assert.equal((await saving).synced, false);
  assert.deepEqual(JSON.parse(subject.values.get(subject.key('alice'))).map((item) => item.summary.id), ['new']);
});

test('Strength outbox failed operations do not poison the next queued save', async () => {
  const subject = fixture({
    cloudAvailable: false,
    onWrite: async (count) => { if (count === 1) throw new Error('first write failed'); },
  });
  const first = subject.saveStrengthSummary('alice', summary('first'));
  const second = subject.saveStrengthSummary('alice', summary('second'));
  const [failed, saved] = await Promise.allSettled([first, second]);
  assert.equal(failed.status, 'rejected');
  assert.match(failed.reason.message, /first write failed/);
  assert.equal(saved.status, 'fulfilled');
  assert.equal(saved.value.synced, false);
  assert.deepEqual(JSON.parse(subject.values.get(subject.key('alice'))).map((item) => item.summary.id), ['second']);
});

test('Strength outbox does not block another UID behind a slow cloud upload', async () => {
  let releaseAlice;
  let signalAlice;
  const aliceStarted = new Promise((resolve) => { signalAlice = resolve; });
  const aliceGate = new Promise((resolve) => { releaseAlice = resolve; });
  const subject = fixture({
    onUpload: async (ref) => {
      if (ref[1] === 'alice') {
        signalAlice();
        await aliceGate;
      }
    },
  });
  const alice = subject.saveStrengthSummary('alice', summary('alice'));
  await aliceStarted;
  try {
    const bob = await subject.saveStrengthSummary('bob', summary('bob'));
    assert.equal(bob.synced, true);
  } finally {
    releaseAlice();
  }
  assert.equal((await alice).synced, true);
});

test('Strength upload deadline retains durable data, releases the UID queue, and ignores late completion', async () => {
  const timers = controlledTimers();
  let finishLateUpload;
  let signalUpload;
  const started = new Promise((resolve) => { signalUpload = resolve; });
  const lateUpload = new Promise((resolve) => { finishLateUpload = resolve; });
  const subject = fixture({
    timers,
    onUpload: async (_ref, record) => {
      if (record.id === 'pending') {
        signalUpload();
        await lateUpload;
      } else {
        throw new Error('offline');
      }
    },
  });
  const first = subject.saveStrengthSummary('alice', summary('pending'));
  await started;
  const next = subject.saveStrengthSummary('alice', summary('next'));
  timers.fire();
  assert.equal((await first).synced, false);
  assert.equal((await next).synced, false);
  assert.deepEqual(JSON.parse(subject.values.get(subject.key('alice'))).map((item) => item.summary.id), ['pending', 'next']);
  const retained = subject.values.get(subject.key('alice'));
  finishLateUpload();
  await new Promise(setImmediate);
  assert.equal(subject.values.get(subject.key('alice')), retained, 'Late SDK completion must not clear durable pending records.');
  assert.ok(timers.delays.every(delay => delay === 10000));
  assert.equal(timers.pendingCount, 0);
});

test('Strength flush timeout retains unattempted summaries and ends the offline batch', async () => {
  const timers = controlledTimers();
  let finishLateUpload;
  let signalUpload;
  const started = new Promise((resolve) => { signalUpload = resolve; });
  const lateUpload = new Promise((resolve) => { finishLateUpload = resolve; });
  const subject = fixture({
    timers,
    onUpload: async () => { signalUpload(); await lateUpload; },
  });
  subject.values.set(subject.key('alice'), JSON.stringify([queued(summary('pending')), queued(summary('unattempted'))]));
  const flushing = subject.flushStrengthOutbox('alice');
  await started;
  timers.fire();
  assert.deepEqual(await flushing, { uploaded: 0, remaining: 2 });
  const retained = JSON.parse(subject.values.get(subject.key('alice')));
  assert.equal(retained[0].attempts, 1);
  assert.equal(retained[1].attempts, 0);
  assert.equal(subject.uploads.length, 1);
  finishLateUpload();
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(subject.values.get(subject.key('alice'))), retained);
  assert.equal(timers.pendingCount, 0);
});

test('Strength successful uploads cancel the deadline without delaying the saved result', async () => {
  const timers = controlledTimers();
  const subject = fixture({ timers });
  assert.equal((await subject.saveStrengthSummary('alice', summary())).synced, true);
  assert.equal(timers.pendingCount, 0);
  assert.deepEqual(timers.delays, [10000]);
});
