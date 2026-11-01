const { spawn } = require('node:child_process');
const path = require('node:path');
const mode = process.argv[2] || 'rules';
if (!['rules', 'accounts'].includes(mode)) throw Error('Unknown Firebase verification mode.');
const environment = { ...process.env };
// Firebase CLI debug output can dump the entire process environment.
for (const key of ['DEBUG', 'FIREBASE_DEBUG', 'GRPC_TRACE', 'GRPC_VERBOSITY']) delete environment[key];
environment.NO_PROXY = ['127.0.0.1', 'localhost', '::1', environment.NO_PROXY || ''].join(',');
environment.no_proxy = environment.NO_PROXY;
environment.PATH = path.dirname(process.execPath) + path.delimiter + (environment.PATH || '');
const script = mode === 'accounts' ? 'node scripts/check-firebase-account.cjs --emulator' : 'node server/firestore.rules.test.js';
const child = spawn(process.execPath, [require.resolve('firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--only', mode === 'accounts' ? 'auth,firestore' : 'firestore', '--project', 'demo-bloom-auth', script], { env: environment, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Firebase verification could not start.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
