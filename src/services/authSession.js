// Coordinates Firebase callbacks and profile readiness without exposing a
// half-provisioned account to the application. SDK dependencies are injected
// so races and failures can be tested without using a real account.
function createAuthSession({ auth, sdk, ensureProfile, onState, onSignedOut = () => {} }) {
  let alive = true;
  let revision = 0;
  let busy = false;
  let unsubscribe = null;
  let state = { user: null, initializing: true, error: null };
  const publish = patch => {
    if (!alive) return;
    state = { ...state, ...patch };
    onState(state);
  };
  const clearExposedUser = () => {
    const uid = state.user?.uid;
    if (uid) onSignedOut(uid);
    return uid;
  };
  const isCurrent = (version, user) => alive && version === revision
    && (auth.currentUser?.uid || null) === (user?.uid || null);

  async function restore(user) {
    const version = ++revision;
    const previousUid = state.user?.uid;
    if (!user) {
      if (previousUid) onSignedOut(previousUid);
      publish({ user: null, initializing: false, error: null });
      return;
    }
    if (previousUid && previousUid !== user.uid) onSignedOut(previousUid);
    publish({ user: null, initializing: true, error: null });
    try {
      await ensureProfile(user);
      if (isCurrent(version, user)) publish({ user, initializing: false, error: null });
    } catch (error) {
      if (isCurrent(version, user)) publish({ user: null, initializing: false, error });
    }
  }

  function start() {
    unsubscribe = sdk.onAuthStateChanged(auth, user => {
      if (!alive || busy) return;
      void restore(user);
    }, error => {
      revision++;
      clearExposedUser();
      publish({ user: null, initializing: false, error });
    });
  }

  async function authenticate(method, email, password, profile) {
    if (busy) throw Object.assign(new Error('A sign-in request is already running.'), { code: 'bloom/auth-busy' });
    busy = true;
    // An explicit credential operation is an auth boundary. Hide and clear any
    // previously exposed account immediately so a cross-tab sign-out or switch
    // cannot leave stale private runtime visible while provisioning is pending.
    clearExposedUser();
    publish({ user: null, initializing: true, error: null });
    const version = ++revision;
    let credential;
    try {
      credential = await sdk[method](auth, email, password);
      if (!isCurrent(version, credential.user)) throw Object.assign(new Error('Sign-in changed.'), { code: 'bloom/auth-changed' });
      try {
        await ensureProfile(credential.user, profile);
      } catch (cause) {
        // A timed-out write may already have committed. Keep the Auth account
        // and allow login to retry idempotent provisioning; never claim it was erased.
        if (isCurrent(version, credential.user)) {
          await sdk.signOut(auth).catch(() => {});
          publish({ user: null, initializing: false, error: null });
        }
        throw Object.assign(new Error('Bloom could not finish loading your profile. Log in again to retry.'), { code: 'bloom/profile-unavailable', cause });
      }
      if (!isCurrent(version, credential.user)) throw Object.assign(new Error('Sign-in changed.'), { code: 'bloom/auth-changed' });
      publish({ user: credential.user, initializing: false, error: null });
      return credential.user;
    } finally {
      busy = false;
      // A cross-tab account change can arrive during provisioning. Restore
      // that current account instead of publishing a stale credential.
      if (alive && revision === version && auth.currentUser
        && auth.currentUser.uid !== credential?.user?.uid) void restore(auth.currentUser);
      else if (alive && revision === version && !auth.currentUser && state.initializing) {
        publish({ user: null, initializing: false, error: null });
      }
    }
  }

  async function logOut() {
    const uid = auth.currentUser?.uid || state.user?.uid;
    revision++;
    await sdk.signOut(auth);
    // Firebase may deliver the signed-out listener synchronously (which already
    // clears runtime) or later. Clear exactly once in either ordering.
    if (uid && state.user?.uid === uid) onSignedOut(uid);
    if (!auth.currentUser) publish({ user: null, initializing: false, error: null });
  }

  return {
    start,
    signUp: (email, password, profile) => authenticate('createUserWithEmailAndPassword', email, password, profile),
    logIn: (email, password) => authenticate('signInWithEmailAndPassword', email, password),
    logOut,
    dispose() { alive = false; revision++; unsubscribe?.(); },
  };
}
module.exports = { createAuthSession };
