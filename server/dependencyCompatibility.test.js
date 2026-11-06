const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

// Exercise the real legacy caller covered by the scoped UUID override. The
// adapter captures the prepared upload; no credentials or network are used.
test('Google storage multipart uploads remain compatible with patched UUID', async () => {
  const storageRequire = createRequire(require.resolve('@google-cloud/storage'));
  const { Gaxios } = storageRequire('gaxios');
  const uuid = createRequire(storageRequire.resolve('gaxios'))('uuid');
  assert.throws(() => uuid.v5('fixture', uuid.v5.URL, new Uint8Array(8)), RangeError,
    'the resolved dependency must reject undersized UUID output buffers');
  let requests = 0;
  const response = await new Gaxios().request({
    url: 'https://upload.example.invalid/object', method: 'POST',
    noProxy: ['upload.example.invalid'],
    multipart: [{ headers: new Headers({ 'Content-Type': 'application/json' }), content: '{"fixture":true}' }],
    adapter: async config => {
      requests++;
      const contentType = typeof config.headers.get === 'function' ? config.headers.get('content-type') : config.headers['Content-Type'];
      const boundary = contentType.split('boundary=')[1];
      assert.match(boundary, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
      let body = '';
      for await (const chunk of config.body) body += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      assert.ok(body.startsWith(`--${boundary}\r\n`));
      assert.ok(body.includes('{"fixture":true}'));
      assert.ok(body.endsWith(`--${boundary}--`));
      return { config, data: 'ok', headers: {}, status: 200, statusText: 'OK' };
    },
  });
  assert.equal(requests, 1);
  assert.equal(response.data, 'ok');
});

test('the Firestore Node transport resolves a patched grpc package within the supported major API', () => {
  const firestoreRequire = createRequire(require.resolve('@firebase/firestore'));
  const version = firestoreRequire('@grpc/grpc-js/package.json').version;
  const [major, minor, patch] = version.split('.').map(Number);
  assert.equal(major, 1);
  assert.ok(minor > 14 || (minor === 14 && patch >= 5), 'grpc certificate authorization advisory must remain patched');
});

test('patched shell quoting rejects command injection after comment tokens', () => {
  const { quote } = require('shell-quote');
  for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(() => quote(['echo', { comment: 'synthetic' }, 'value' + separator + 'injected-command']), TypeError);
  }
});

test('patched Expo CLI Zod preserves actual plugin schemas and MCP extension contracts', () => {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const cliRoot = require('node:path').dirname(expoRequire.resolve('@expo/cli/package.json'));
  const cliRequire = createRequire(require('node:path').join(cliRoot, 'package.json'));
  assert.equal(cliRequire('zod/package.json').version, '4.6.7');
  const { DevToolsPlugin } = require(require('node:path').join(cliRoot, 'build/src/start/server/devtools/DevToolsPlugin.js'));
  const { DevToolsPluginOutputSchema } = require(require('node:path').join(cliRoot, 'build/src/start/server/devtools/DevToolsPlugin.schema.js'));
  const { validate, ValidationError } = cliRequire('@expo/schema-utils');
  const { createMCPDevToolsExtensionSchema } = require(require('node:path').join(cliRoot, 'build/src/start/server/mcp/createMCPDevToolsExtensionSchema.js'));
  const plugin = { packageName: 'synthetic-plugin', packageRoot: '/synthetic', cliExtensions: { description: 'Synthetic fixture', entryPoint: 'index.js', commands: [{ name: 'test', title: 'Test', environments: ['cli', 'mcp'], parameters: [{ name: 'count', type: 'number' }, { name: 'confirm', type: 'confirm' }, { name: 'label', type: 'text' }] }] } };
  assert.doesNotThrow(() => new DevToolsPlugin(plugin, '/synthetic'));
  assert.throws(() => new DevToolsPlugin({ ...plugin, packageName: '' }, '/synthetic'), /Invalid plugin configuration/);
  assert.doesNotThrow(() => validate(DevToolsPluginOutputSchema, [{ type: 'text', text: 'Synthetic output', level: 'info' }]));
  assert.throws(() => validate(DevToolsPluginOutputSchema, [{ type: 'text', level: 'info' }]), ValidationError);
  const schema = createMCPDevToolsExtensionSchema(plugin, cliRequire('zod'));
  assert.equal(schema.safeParse({ command: 'test', count: 2, confirm: true, label: 'Synthetic' }).success, true);
  assert.equal(schema.safeParse({ command: 'test', count: 'invalid' }).success, false);
  assert.equal(schema.safeParse({ command: 'test', arbitrary: 'invalid' }).success, false);
});
