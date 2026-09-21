const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const { createAuthSession } = require('../src/services/authSession');

const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const alice = { uid: 'alice', email: 'alice@example.test', displayName: 'Alice' };
const bob = { uid: 'bob', email: 'bob@example.test', displayName: 'Bob' };

function sessionFixture(t, overrides = {}) {
  const states = [];
  const cleared = [];
  const calls = [];
  const accounts = new Map([[alice.uid, alice], [bob.uid, bob]]);
  const savedData = new Map([[alice.uid, { checkins: ['keep'], profile: { firstName: 'Alice' } }]]);
  const auth = { currentUser: null };
  let next;
  let fail;
  let unsubscribed = false;
  const emit = user => { auth.currentUser = user; next?.(user); };
  const sdk = {
    onAuthStateChanged(target, onUser, onError) { assert.equal(target, auth); next = onUser; fail = onError; return () => { unsubscribed = true; }; },
    async createUserWithEmailAndPassword(target, email, password) { calls.push(['signup', email, password]); const user = { ...alice, email }; accounts.set(user.uid, user); emit(user); return { user }; },
    async signInWithEmailAndPassword(target, email, password) { calls.push(['login', email, password]); emit(alice); return { user: alice }; },
    async signOut() { calls.push(['logout']); emit(null); },
    ...overrides.sdk,
  };
  const ensured = [];
  const session = createAuthSession({
    auth, sdk,
    ensureProfile: async (user, profile) => { ensured.push({ user, profile }); return overrides.ensureProfile?.(user, profile); },
    onState: value => states.push(value), onSignedOut: uid => cleared.push(uid),
  });
  t.after(() => session.dispose());
  session.start();
  return { session, auth, sdk, states, calls, ensured, cleared, accounts, savedData, emit,
    error: error => fail(error), get state() { return states.at(-1); }, get unsubscribed() { return unsubscribed; } };
}

test('Firebase signup waits for the Bloom profile despite an early SDK listener callback', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(null);
  const requested = { firstName: 'Alice', onboardingCompleted: false };
  const action = f.session.signUp(alice.email, 'valid-password', requested);
  await tick();
  assert.equal(f.state.user, null);
  assert.equal(f.ensured.length, 1);
  assert.deepEqual(f.ensured[0].profile, requested);
  profile.resolve();
  assert.equal((await action).uid, alice.uid);
  assert.equal(f.state.user.uid, alice.uid);
  assert.equal(f.state.initializing, false);
  assert.deepEqual(f.calls[0], ['signup', alice.email, 'valid-password']);
});

test('Firebase login provisions once and does not expose the account before profile readiness', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(null);
  const action = f.session.logIn(alice.email, 'valid-password');
  await tick();
  assert.equal(f.state.user, null);
  profile.resolve();
  assert.equal(await action, alice);
  assert.equal(f.state.user, alice);
  assert.equal(f.ensured.length, 1);
  assert.equal(f.ensured[0].profile, undefined);
});

test('signup and login SDK failures remain failures and never create a profile', async t => {
  for (const method of ['createUserWithEmailAndPassword', 'signInWithEmailAndPassword']) {
    const error = Object.assign(new Error('SDK failure'), { code: method.startsWith('create') ? 'auth/email-already-in-use' : 'auth/invalid-credential' });
    const f = sessionFixture(t, { sdk: { [method]: async () => { throw error; } } });
    f.emit(null);
    await assert.rejects(method.startsWith('create') ? f.session.signUp('x@example.test', 'password') : f.session.logIn('x@example.test', 'password'), failure => failure === error);
    assert.equal(f.ensured.length, 0);
    assert.equal(f.state.user, null);
  }
});

test('restoring Firebase persistence keeps loading until the existing profile is ready', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(alice);
  assert.deepEqual(f.state, { user: null, initializing: true, error: null });
  profile.resolve();
  await tick();
  assert.equal(f.state.user, alice);
  assert.equal(f.state.initializing, false);
});

test('null initial auth state resolves to signed out without profile work', t => {
  const f = sessionFixture(t);
  f.emit(null);
  assert.deepEqual(f.state, { user: null, initializing: false, error: null });
  assert.equal(f.ensured.length, 0);
});

test('logout clears account runtime once, returns signed out and preserves saved Bloom data', async t => {
  const f = sessionFixture(t);
  f.emit(alice);
  await tick();
  const before = structuredClone([...f.savedData]);
  await f.session.logOut();
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.state.user, null);
  assert.deepEqual(f.cleared, [alice.uid]);
  assert.deepEqual([...f.savedData], before);
  assert.equal(f.accounts.has(alice.uid), true);
  assert.equal(f.calls.filter(call => call[0] === 'logout').length, 1);
});

test('failed logout keeps the authenticated account and does not clear its runtime', async t => {
  const failure = new Error('network');
  const f = sessionFixture(t, { sdk: { signOut: async () => { throw failure; } } });
  f.emit(alice);
  await tick();
  await assert.rejects(f.session.logOut(), error => error === failure);
  assert.equal(f.state.user, alice);
  assert.deepEqual(f.cleared, []);
});

test('failed signup provisioning keeps the Auth account and login retries the same profile', async t => {
  let attempts = 0;
  const f = sessionFixture(t, { ensureProfile: () => { if (++attempts === 1) throw new Error('Firestore temporarily unavailable'); } });
  f.emit(null);
  await assert.rejects(f.session.signUp(alice.email, 'valid-password'), { code: 'bloom/profile-unavailable' });
  assert.equal(f.accounts.has(alice.uid), true);
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.state.user, null);
  assert.equal(await f.session.logIn(alice.email, 'valid-password'), alice);
  assert.equal(attempts, 2);
  assert.equal(f.calls.filter(call => call[0] === 'signup').length, 1);
});

test('a restored profile failure stays recoverable without destroying the Firebase user', async t => {
  const failure = new Error('Firestore offline');
  const f = sessionFixture(t, { ensureProfile: () => { throw failure; } });
  f.emit(alice);
  await tick();
  assert.equal(f.state.user, null);
  assert.equal(f.state.error, failure);
  assert.equal(f.state.initializing, false);
  assert.equal(f.auth.currentUser, alice);
  assert.equal(f.calls.length, 0);
});

test('a late profile result cannot restore a user who signed out in another tab', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(alice);
  f.emit(null);
  profile.resolve();
  await tick();
  assert.deepEqual(f.state, { user: null, initializing: false, error: null });
});

test('cross-tab account switches during profile restoration expose only the latest account', async t => {
  const profiles = { alice: deferred(), bob: deferred() };
  const f = sessionFixture(t, { ensureProfile: user => profiles[user.uid].promise });
  f.emit(alice);
  f.emit(bob);
  profiles.bob.resolve();
  await tick();
  profiles.alice.resolve();
  await tick();
  assert.equal(f.state.user, bob);
  assert.equal(f.states.some(state => state.user?.uid === alice.uid), false);
});

test('cross-tab signout during an explicit login clears the previous exposed account', async t => {
  const profile = deferred();
  let block = false;
  const f = sessionFixture(t, { ensureProfile: () => block ? profile.promise : undefined });
  f.emit(alice);
  await tick();
  block = true;
  const action = f.session.logIn(alice.email, 'valid-password');
  const rejected = assert.rejects(action, { code: 'bloom/auth-changed' });
  await tick();
  f.emit(null);
  profile.resolve();
  await rejected;
  await tick();
  assert.equal(f.state.user, null);
  assert.equal(f.state.initializing, false);
  assert.deepEqual(f.cleared, [alice.uid]);
});

test('cross-tab account change during explicit login restores that current account after stale work resolves', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: user => user.uid === alice.uid ? profile.promise : undefined });
  f.emit(null);
  const action = f.session.logIn(alice.email, 'valid-password');
  const rejected = assert.rejects(action, { code: 'bloom/auth-changed' });
  await tick();
  f.emit(bob);
  profile.resolve();
  await rejected;
  await tick();
  assert.equal(f.state.user, bob);
  assert.equal(f.states.some(state => state.user?.uid === alice.uid), false);
});

test('logout while a profile is pending prevents late authentication publication', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(null);
  const action = f.session.logIn(alice.email, 'valid-password');
  const rejected = assert.rejects(action, { code: 'bloom/auth-changed' });
  await tick();
  await f.session.logOut();
  profile.resolve();
  await rejected;
  assert.equal(f.state.user, null);
  assert.equal(f.auth.currentUser, null);
});

test('auth listener errors clear exposed runtime and stay errors despite a late profile result', async t => {
  const profile = deferred();
  let block = false;
  const f = sessionFixture(t, { ensureProfile: () => block ? profile.promise : undefined });
  f.emit(alice);
  await tick();
  block = true;
  f.emit(alice);
  const failure = new Error('persistence failure');
  f.error(failure);
  profile.resolve();
  await tick();
  assert.equal(f.state.user, null);
  assert.equal(f.state.error, failure);
  assert.deepEqual(f.cleared, [alice.uid]);
});

test('concurrent credential submissions are rejected before making a second SDK request', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(null);
  const action = f.session.logIn(alice.email, 'valid-password');
  await assert.rejects(f.session.signUp(bob.email, 'valid-password'), { code: 'bloom/auth-busy' });
  profile.resolve();
  await action;
  assert.equal(f.calls.length, 1);
});

test('dispose unsubscribes, ignores late callbacks and rejects further auth operations', async t => {
  const profile = deferred();
  const f = sessionFixture(t, { ensureProfile: () => profile.promise });
  f.emit(alice);
  f.session.dispose();
  const published = f.states.length;
  profile.resolve();
  f.emit(bob);
  await tick();
  assert.equal(f.unsubscribed, true);
  assert.equal(f.states.length, published);
  await assert.rejects(f.session.logIn(alice.email, 'valid-password'), { code: 'bloom/auth-changed' });
  assert.equal(f.calls.length, 0);
});

function profileFixture(options = {}) {
  const documents = new Map(options.documents || []);
  const writes = [];
  const reads = [];
  let transactions = 0;
  let tail = Promise.resolve();
  const stamp = { serverTimestamp: true };
  const snapshot = reference => { const value = documents.get(reference); return { exists: () => value !== undefined, data: () => value }; };
  const firestore = {
    doc: (database, collection, uid) => { assert.equal(collection, 'users'); assert.ok(uid && !uid.includes('@')); return `${collection}/${uid}`; },
    getDoc: async reference => { reads.push(reference); if (options.readFailure) throw options.readFailure; return snapshot(reference); },
    serverTimestamp: () => stamp,
    runTransaction: (database, operation) => {
      transactions++;
      const attempt = tail.then(async () => {
        options.beforeTransaction?.(documents);
        const pending = [];
        const result = await operation({ get: async reference => snapshot(reference), set: (reference, value) => pending.push([reference, value]) });
        for (const entry of pending) { documents.set(...entry); writes.push(entry); }
        return result;
      });
      tail = attempt.catch(() => {});
      return attempt;
    },
  };
  const firebase = { db: options.noDatabase ? null : {}, auth: {} };
  function load(filename) {
    const transformed = babel.transformFileSync(path.resolve(__dirname, '../src/services', filename), {
      babelrc: false, configFile: false, presets: [['babel-preset-expo', { lazyImports: false }]],
    });
    const module = { exports: {} };
    const localRequire = name => {
      if (name === 'firebase/firestore') return firestore;
      if (name === './firebase') return firebase;
      if (name === './userData') return load('userData.js');
      if (name === '../utils/dateKey') return require('../src/utils/dateKey');
      throw new Error(`Unexpected profile dependency: ${name}`);
    };
    new Function('require', 'module', 'exports', transformed.code)(localRequire, module, module.exports);
    return module.exports;
  }
  return { ...load('authProfile.js'), documents, writes, reads, stamp, get transactions() { return transactions; } };
}

test('missing profile provisioning uses the Firebase UID, current schema and server timestamps', async () => {
  const f = profileFixture();
  const result = await f.ensureAuthProfile(alice, { firstName: 'Alice', consent: true, optional: undefined });
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0][0], 'users/alice');
  assert.deepEqual(result, { firstName: 'Alice', email: alice.email, onboardingCompleted: false, consent: true, createdAt: f.stamp, updatedAt: f.stamp, lastActiveAt: f.stamp });
});

test('existing profiles are returned verbatim without updating consent, onboarding or timestamps', async () => {
  const existing = { firstName: 'Chosen name', consent: true, onboardingCompleted: true, createdAt: 'original', settings: { theme: 'dark' } };
  const f = profileFixture({ documents: [['users/alice', existing]] });
  assert.equal(await f.ensureAuthProfile(alice, { firstName: 'Overwrite', consent: false, onboardingCompleted: false }), existing);
  assert.equal(f.transactions, 0);
  assert.deepEqual(f.writes, []);
});

test('concurrent missing-profile provisioning commits one profile and never overwrites the winner', async () => {
  const f = profileFixture();
  const [first, second] = await Promise.all([
    f.ensureAuthProfile(alice, { firstName: 'First tab' }),
    f.ensureAuthProfile(alice, { firstName: 'Second tab' }),
  ]);
  assert.equal(f.transactions, 2);
  assert.equal(f.writes.length, 1);
  assert.equal(first.firstName, 'First tab');
  assert.deepEqual(second, first);
});

test('a profile created after the initial read is preserved by the transaction recheck', async () => {
  const existing = { firstName: 'Another tab', onboardingCompleted: true };
  const f = profileFixture({ beforeTransaction: documents => documents.set('users/alice', existing) });
  assert.equal(await f.ensureAuthProfile(alice, { firstName: 'Overwrite' }), existing);
  assert.equal(f.writes.length, 0);
});

test('profile storage and read failures propagate without destructive fallback writes', async () => {
  const failure = new Error('permission denied');
  const f = profileFixture({ readFailure: failure });
  await assert.rejects(f.ensureAuthProfile(alice), error => error === failure);
  assert.equal(f.transactions, 0);
  assert.equal(f.writes.length, 0);
  await assert.rejects(profileFixture({ noDatabase: true }).ensureAuthProfile(alice), /unavailable/);
  await assert.rejects(profileFixture().ensureAuthProfile({}), /unavailable/);
});
