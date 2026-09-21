import { doc, setDoc, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../../services/firebase';
import { KEYS, storage } from '../../../services/storage';
import { STRENGTH_DEFAULTS } from '../constants';
import accountWork from '../../../services/accountWork';

const { enqueueSummary, pruneOutbox } = require('./strengthOutbox');
const { serializeStrengthSummary } = require('../engine/strengthPrivacy');
const outboxOperations = new Map();
const pendingUploads = new Map();
const UPLOAD_DEADLINE_MS = 10000;

function serializeOutboxOperation(uid, local, operation) {
  const work = accountWork.request(uid);
  const key = local.scopedKey(KEYS.STRENGTH_OUTBOX);
  const previous = outboxOperations.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => { work.check(); return operation(work.check); });
  outboxOperations.set(key, pending);
  return pending.finally(() => {
    work.close();
    if (outboxOperations.get(key) === pending) outboxOperations.delete(key);
  });
}

function firestoreSummary(summary) {
  const safe = serializeStrengthSummary(summary);
  return {
    ...safe,
    startedAt: Timestamp.fromDate(new Date(safe.startedAt)),
    ...(safe.completedAt ? { completedAt: Timestamp.fromDate(new Date(safe.completedAt)) } : {}),
  };
}

async function upload(uid, summary) {
  if (!db || !uid) throw new Error('strength_cloud_unavailable');
  let timer;
  const uploads = pendingUploads.get(uid) || new Set();
  pendingUploads.set(uid, uploads);
  const write = setDoc(doc(db, 'users', uid, 'strengthSessions', summary.id), firestoreSummary(summary));
  uploads.add(write);
  const settled = () => {
    uploads.delete(write);
    if (!uploads.size && pendingUploads.get(uid) === uploads) pendingUploads.delete(uid);
  };
  write.then(settled, settled);
  try {
    // Firestore can retain an offline write without settling its Promise.
    // Bound the foreground wait, not the SDK write: it cannot be cancelled.
    // A late success never removes the outbox record or claims sync here;
    // the next retry writes the same document ID and remains idempotent.
    await Promise.race([
      write,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('strength_cloud_timeout')), UPLOAD_DEADLINE_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Call after accountWork.pause(uid), before selecting records for deletion.
// The SDK may finish a timed-out upload later; deletion must wait for that
// actual write, or fail recoverably while offline, to avoid recreating data.
export async function prepareStrengthDataDeletion(uid) {
  const key = storage.forUser(uid).scopedKey(KEYS.STRENGTH_OUTBOX);
  let timer;
  try {
    await Promise.race([
      (async () => {
        await outboxOperations.get(key)?.catch(() => {});
        await Promise.allSettled([...(pendingUploads.get(uid) || [])]);
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Strength is still syncing. Reconnect and retry deleting your data.')), UPLOAD_DEADLINE_MS);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

async function readOutbox(local) {
  // The general device-storage reader intentionally hides I/O failures. That
  // is unsafe for a read-modify-write queue: treating a failed read as empty
  // would erase summaries already waiting to sync. Preserve legacy UID keys
  // without changing the cloud schema or moving data between accounts.
  try {
    const current = await AsyncStorage.getItem(local.scopedKey(KEYS.STRENGTH_OUTBOX));
    const serialized = current === null
      ? await AsyncStorage.getItem(local.legacyScopedKey(KEYS.STRENGTH_OUTBOX))
      : current;
    if (serialized === null) return [];
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) throw new Error('invalid_strength_outbox');
    return parsed;
  } catch {
    throw new Error('Bloom could not read sessions waiting to sync. Please try again.');
  }
}

export async function flushStrengthOutbox(uid) {
  const local = storage.forUser(uid);
  return serializeOutboxOperation(uid, local, async (check) => {
    const queue = pruneOutbox(await readOutbox(local), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs);
    check();
    const remaining = [];
    for (let index = 0; index < queue.length; index += 1) {
      check();
      const item = queue[index];
      try {
        await upload(uid, item.summary);
      } catch (error) {
        remaining.push({ ...item, attempts: item.attempts + 1 });
        if (error?.message === 'strength_cloud_timeout') {
          // Do not spend another deadline on every item while offline, or a
          // background flush could delay a newly completed workout for minutes.
          remaining.push(...queue.slice(index + 1));
          break;
        }
      }
    }
    check();
    await local.setStrengthOutbox(remaining);
    check();
    return { uploaded: queue.length - remaining.length, remaining: remaining.length };
  });
}

export async function saveStrengthSummary(uid, input) {
  const local = storage.forUser(uid);
  const summary = serializeStrengthSummary(input);
  return serializeOutboxOperation(uid, local, async (check) => {
    const current = pruneOutbox(await readOutbox(local), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs);
    check();
    await local.setStrengthOutbox(enqueueSummary(current, summary));
    check();
    try {
      await upload(uid, summary);
    } catch {
      check();
      return { summary, synced: false };
    }
    const latest = pruneOutbox(await readOutbox(local), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs)
      .filter((item) => item.summary.id !== summary.id);
    check();
    await local.setStrengthOutbox(latest);
    check();
    return { summary, synced: true };
  });
}
