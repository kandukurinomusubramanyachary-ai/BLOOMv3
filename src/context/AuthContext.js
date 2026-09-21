import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  auth,
  db,
  firebaseConfigurationError,
  firebaseInitializationError,
  initializeFirebaseServices,
  developmentAuthEnabled,
} from '../services/firebase';
import {
  recordStartupFailure,
  setStartupStage,
} from '../diagnostics/startupDiagnostics';
import { ensureAuthProfile } from '../services/authProfile';
import { createAuthSession } from '../services/authSession';
import { storage } from '../services/storage';
import { requestMegAccountData } from '../services/megAccountData';
const { deleteAccountInOrder } = require('../services/accountLifecycle');
const accountWork = require('../services/accountWork');
const { requestPasswordRecovery } = require('../services/passwordRecovery');

export const REQUIRED_DATA_CONSENT =
  'I agree that Bloom may securely store my cycle, symptom, check-in and Meg conversation data to personalise my experience.';

export const OPTIONAL_MODEL_CONSENT =
  'I agree that my anonymised conversations and feedback may be reviewed to improve Meg.';

const AuthContext = createContext(null);

export class BloomAuthError extends Error {
  constructor(message, field = 'form') {
    super(message);
    this.name = 'BloomAuthError';
    this.field = field;
  }
}

export function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidAuthEmail(value) {
  const email = normalizeAuthEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return new BloomAuthError('Enter a valid email address.', 'email');
    case 'auth/email-already-in-use':
      return new BloomAuthError(
        'An account already exists for this email. Choose Log in instead.',
        'email'
      );
    case 'auth/weak-password':
      return new BloomAuthError('Use a password with at least 8 characters.', 'password');
    case 'auth/password-does-not-meet-requirements':
      return new BloomAuthError('Choose a stronger password that meets this account’s password requirements.', 'password');
    case 'auth/user-disabled':
      return new BloomAuthError('This account is disabled. Contact Bloom support for help.');
    case 'auth/operation-not-allowed':
      return new BloomAuthError('Email sign-in is unavailable right now. Contact Bloom support.');
    case 'bloom/auth-busy':
      return new BloomAuthError('Sign-in is already in progress. Please wait.');
    case 'bloom/auth-changed':
      return new BloomAuthError('Your sign-in changed. Please try again.');
    case 'bloom/profile-unavailable':
      return new BloomAuthError('Bloom could not finish loading your profile. Check your connection, then log in again to retry.');
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new BloomAuthError('That email or password is not correct. Please try again.');
    case 'auth/network-request-failed':
      return new BloomAuthError('Bloom could not connect. Check your internet and try again.');
    case 'auth/too-many-requests':
      return new BloomAuthError('Too many attempts were made. Wait a little, then try again.');
    default:
      return new BloomAuthError('Bloom could not complete sign-in. Please try again.');
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [startupFailure, setStartupFailure] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const sessionRef = useRef(null);

  useEffect(() => {
    setInitializing(true);
    setStartupFailure(null);

    // DEV: skip the login screen by seeding a fake signed-in user.
    // Toggle with EXPO_PUBLIC_BLOOM_DEV_AUTH=1 in .env (bundle-time value).
    // getIdToken returns 'dev-token', which the Meg server accepts when
    // MEG_DEV_AUTH=1 (see server/firebaseAuth.js).
    if (developmentAuthEnabled) {
      setUser({
        uid: 'dev-user',
        email: 'dev@bloom.local',
        displayName: 'Dev User',
        emailVerified: true,
        isAnonymous: false,
        providerData: [],
        getIdToken: async () => 'dev-token',
      });
      setStartupFailure(null);
      setInitializing(false);
      return undefined;
    }

    const services = initializeFirebaseServices();
    if (services.failure || !services.auth) {
      setUser(null);
      setStartupFailure(services.failure);
      setInitializing(false);
      return undefined;
    }

    setStartupStage('auth-restoration');
    try {
      const session = createAuthSession({
        auth: services.auth,
        sdk: { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut },
        ensureProfile: ensureAuthProfile,
        onSignedOut: uid => { accountWork.invalidate(uid); storage.clearUserScope(uid); },
        onState: next => {
          setUser(next.user);
          setInitializing(next.initializing);
          setStartupFailure(next.error ? recordStartupFailure(
            'Bloom could not restore your account. Check your connection and retry.',
            'auth-restoration',
            'Bloom could not restore your account. Check your connection and retry.'
          ) : null);
        },
      });
      sessionRef.current = session;
      session.start();
      return () => { session.dispose(); if (sessionRef.current === session) sessionRef.current = null; };
    } catch {
      setUser(null);
      setStartupFailure(recordStartupFailure(
        'Bloom could not restore sign-in on this device.',
        'auth-restoration',
        'Bloom could not restore sign-in on this device.'
      ));
      setInitializing(false);
      return undefined;
    }
  }, [retryToken]);

  const retryStartup = useCallback(() => {
    setRetryToken((value) => value + 1);
  }, []);

  const signUp = useCallback(async ({
    firstName,
    email,
    password,
    confirmPassword,
    consent,
    modelImprovementConsent = false,
  }) => {
    if (firebaseConfigurationError || firebaseInitializationError || !auth || !db) {
      throw new BloomAuthError(
        firebaseConfigurationError
        || firebaseInitializationError
        || 'Bloom sign-in is unavailable on this build.'
      );
    }

    const cleanFirstName = String(firstName || '').trim();
    const normalizedEmail = normalizeAuthEmail(email);
    if (!cleanFirstName) throw new BloomAuthError('Enter your first name.', 'firstName');
    if (!isValidAuthEmail(normalizedEmail)) {
      throw new BloomAuthError('Enter a valid email address.', 'email');
    }
    if (String(password || '').length < 8) {
      throw new BloomAuthError('Use a password with at least 8 characters.', 'password');
    }
    if (password !== confirmPassword) throw new BloomAuthError('Your passwords do not match.', 'confirmPassword');
    if (consent !== true) {
      throw new BloomAuthError('You need to agree before creating your Bloom account.', 'consent');
    }

    try {
      const profile = {
        firstName: cleanFirstName,
        email: normalizedEmail,
        consent: true,
        modelImprovementConsent: Boolean(modelImprovementConsent),
        onboardingCompleted: false,
      };
      if (!sessionRef.current) throw new BloomAuthError('Bloom sign-in is not ready. Please try again.');
      return await sessionRef.current.signUp(normalizedEmail, password, profile);
    } catch (error) {
      if (error instanceof BloomAuthError) throw error;
      throw friendlyAuthError(error);
    }
  }, []);

  const logIn = useCallback(async ({ email, password }) => {
    if (firebaseConfigurationError || firebaseInitializationError || !auth || !db) {
      throw new BloomAuthError(
        firebaseConfigurationError
        || firebaseInitializationError
        || 'Bloom sign-in is unavailable on this build.'
      );
    }

    const normalizedEmail = normalizeAuthEmail(email);
    if (!isValidAuthEmail(normalizedEmail)) {
      throw new BloomAuthError('Enter a valid email address.', 'email');
    }
    if (!password) throw new BloomAuthError('Enter your password.', 'password');

    try {
      if (!sessionRef.current) throw new BloomAuthError('Bloom sign-in is not ready. Please try again.');
      return await sessionRef.current.logIn(normalizedEmail, password);
    } catch (error) {
      if (error instanceof BloomAuthError) throw error;
      throw friendlyAuthError(error);
    }
  }, []);

  const logOut = useCallback(async () => {
    if (user?.uid) accountWork.invalidate(user.uid);
    if (!auth) {
      if (user?.uid) storage.clearUserScope(user.uid);
      setUser(null);
      return;
    }
    try {
      if (sessionRef.current) await sessionRef.current.logOut();
      else { await signOut(auth); if (user?.uid) storage.clearUserScope(user.uid); }
      setUser(null);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    if (!isValidAuthEmail(email)) throw new BloomAuthError('Enter a valid email address.', 'email');
    if (!auth) throw new BloomAuthError('Password recovery is unavailable on this build.');
    try { return await requestPasswordRecovery(email, (normalized) => sendPasswordResetEmail(auth, normalized)); }
    catch (error) {
      throw new BloomAuthError(error.message, error.field);
    }
  }, []);

  const deleteAccount = useCallback(async ({ password, beforeDelete }) => {
    if (!user?.email) {
      throw new BloomAuthError('Bloom could not verify this account. Log in again and retry.');
    }
    if (!password) throw new BloomAuthError('Enter your password to confirm deletion.', 'password');
    if (typeof beforeDelete !== 'function') {
      throw new BloomAuthError('Bloom could not prepare account deletion. Please try again.');
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } catch (error) {
      if (['auth/invalid-credential', 'auth/wrong-password'].includes(error?.code)) {
        throw new BloomAuthError('That password is not correct.', 'password');
      }
      throw friendlyAuthError(error);
    }

    const resume = accountWork.pause(user.uid);
    try {
      await deleteAccountInOrder({
        reauthenticate: async () => {}, // Completed above; keep password errors field-specific.
        deleteMeg: () => requestMegAccountData({ method: 'DELETE', expectedUid: user.uid }),
        deleteAppData: async () => { await beforeDelete(user.uid); },
        deleteAuth: async () => { await deleteUser(user); },
        clearLocal: () => storage.deleteAllData(user.uid),
      });
      setAccountNotice('Your Bloom account and its active data were deleted.');
      setUser(null);
    } catch (error) {
      if (error?.accountDeleted) {
        setAccountNotice(error.message);
        setUser(null);
        return;
      }
      if (error instanceof BloomAuthError) throw error;
      throw new BloomAuthError(
        'Deletion did not finish. Some records may already be removed. Your account has not been deleted; please retry.'
      );
    } finally { resume(); }
  }, [user]);

  const value = useMemo(() => ({
    user,
    accountNotice,
    resetPassword,
    initializing,
    configurationError: firebaseConfigurationError || firebaseInitializationError,
    startupFailure,
    retryStartup,
    signUp,
    logIn,
    logOut,
    deleteAccount,
  }), [
    accountNotice,
    resetPassword,
    initializing,
    logIn,
    logOut,
    deleteAccount,
    retryStartup,
    signUp,
    startupFailure,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
