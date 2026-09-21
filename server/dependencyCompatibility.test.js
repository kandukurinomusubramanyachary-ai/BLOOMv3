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
    multipart: [{ headers: { 'Content-Type': 'application/json' }, content: '{"fixture":true}' }],
    adapter: async config => {
      requests++;
      const boundary = config.headers['Content-Type'].split('boundary=')[1];
      assert.match(boundary, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
      let body = '';
      for await (const chunk of config.body) body += chunk.toString();
      assert.ok(body.startsWith(`--${boundary}\r\n`));
      assert.ok(body.includes('{"fixture":true}'));
      assert.ok(body.endsWith(`--${boundary}--`));
      return { config, data: 'ok', headers: {}, status: 200, statusText: 'OK' };
    },
  });
  assert.equal(requests, 1);
  assert.equal(response.data, 'ok');
});
