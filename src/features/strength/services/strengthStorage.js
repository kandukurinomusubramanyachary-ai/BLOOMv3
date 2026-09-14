import { doc, setDoc, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../../services/firebase';
import { KEYS, storage } from '../../../services/storage';
import { STRENGTH_DEFAULTS } from '../constants';

const { enqueueSummary, pruneOutbox } = require('./strengthOutbox');
const { serializeStrengthSummary } = require('../engine/strengthPrivacy');
const outboxOperations = new Map();
const UPLOAD_DEADLINE_MS = 10000;

function serializeOutboxOperation(local, operation) {
  const key = local.scopedKey(KEYS.STRENGTH_OUTBOX);
  const previous = outboxOperations.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(operation);
  outboxOperations.set(key, pending);
  return pending.finally(() => {
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
  try {
    // Firestore can retain an offline write without settling its Promise.
    // Bound the foreground wait, not the SDK write: it cannot be cancelled.
    // A late success never removes the outbox record or claims sync here;
    // the next retry writes the same document ID and remains idempotent.
    await Promise.race([
      setDoc(doc(db, 'users', uid, 'strengthSessions', summary.id), firestoreSummary(summary)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('strength_cloud_timeout')), UPLOAD_DEADLINE_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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
  return serializeOutboxOperation(local, async () => {
    const queue = pruneOutbox(await readOutbox(local), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs);
    const remaining = [];
    for (let index = 0; index < queue.length; index += 1) {
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
    await local.setStrengthOutbox(remaining);
    return { uploaded: queue.length - remaining.length, remaining: remaining.length };
  });
}

export async function saveStrengthSummary(uid, input) {
  const local = storage.forUser(uid);
  const summary = serializeStrengthSummary(input);
  return serializeOutboxOperation(local, async () => {
    const current = pruneOutbox(await readOutbox(local), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs);
    await local.setStrengthOutbox(enqueueSummary(current, summary));
    try {
      await upload(uid, summary);
    } catch {
      return { summary, synced: false };
    }
    const latest = pruneOutbox(await readOutbox(local), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs)
      .filter((item) => item.summary.id !== summary.id);
    await local.setStrengthOutbox(latest);
    return { summary, synced: true };
  });
}
