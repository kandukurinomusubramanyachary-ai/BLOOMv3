import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { stripUndefined } from './userData';

// Returning users keep their profile exactly as saved. The transaction also
// prevents two tabs repairing the same missing profile from overwriting it.
export async function ensureAuthProfile(user, signupProfile) {
  if (!db || !user?.uid) throw new Error('Bloom profile storage is unavailable.');
  const reference = doc(db, 'users', user.uid);
  const existing = await getDoc(reference);
  if (existing.exists()) return existing.data();
  return runTransaction(db, async transaction => {
    const current = await transaction.get(reference);
    if (current.exists()) return current.data();
    const timestamp = serverTimestamp();
    const profile = stripUndefined({
      firstName: String(user.displayName || '').trim(),
      email: user.email || '',
      onboardingCompleted: false,
      ...signupProfile,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActiveAt: timestamp,
    });
    transaction.set(reference, profile);
    return profile;
  });
}
