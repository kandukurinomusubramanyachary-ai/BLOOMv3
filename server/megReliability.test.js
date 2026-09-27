const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { InMemoryBackend } = require('../meg-engine-v2/src/memory/memoryStore');
const { SQLiteStore } = require('../meg-engine-v2/src/persistence/sqlite');
const { createMegV2Bridge } = require('./megV2Bridge');

const silentLogger = { info() {}, warn() {}, error() {} };

function providerManager(stream) {
  return {
    status() { return { fixture: { configured: true, state: 'CLOSED' } }; },
    stream,
  };
}

for (const driver of ['memory', 'sqlite']) {
  test(`${driver}: failed request retries once without duplicating the user message`, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloom-meg-retry-'));
    const store = driver === 'sqlite'
      ? new SQLiteStore({ filename: path.join(directory, 'meg.db') })
      : new InMemoryBackend();
    let shouldFail = true;
    const bridge = createMegV2Bridge({
      environment: { NODE_ENV: 'test' },
      engineOverrides: {
        store,
        logger: silentLogger,
        providerManager: providerManager(async function* stream(_request, state) {
          state.provider = 'fixture';
          if (shouldFail) throw new Error('private provider outage');
          yield 'A real provider response.';
        }),
      },
    });
    const request = {
      uid: 'user-a',
      body: {
        conversationId: 'conversation-1',
        messageId: 'message-1',
        message: 'Help me think this through',
      },
    };

    try {
      await assert.rejects(bridge.chat(request), (error) => (
        error.status === 503
        && error.code === 'meg_unavailable'
        && !error.message.includes('private provider outage')
      ));
      let saved = store.exportUserData({ userId: 'user-a' });
      assert.deepEqual(saved.messages.map((message) => message.role), ['user']);

      shouldFail = false;
      const response = await bridge.chat(request);
      assert.equal(response.message, 'A real provider response.');
      saved = store.exportUserData({ userId: 'user-a' });
      assert.deepEqual(saved.messages.map((message) => message.role), ['user', 'assistant']);
      assert.equal(saved.messages.filter((message) => message.role === 'user').length, 1);
    } finally {
      store.close?.();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('invalid provider output fails instead of becoming a successful assistant answer', async () => {
  const store = new InMemoryBackend();
  const bridge = createMegV2Bridge({
    environment: { NODE_ENV: 'test' },
    engineOverrides: {
      store,
      logger: silentLogger,
      providerManager: providerManager(async function* stream(_request, state) {
        state.provider = 'fixture';
        yield '   ';
      }),
    },
  });

  await assert.rejects(bridge.chat({
    uid: 'user-a',
    body: {
      conversationId: 'conversation-1',
      messageId: 'message-1',
      message: 'Hello Meg',
    },
  }), (error) => error.status === 503 && error.code === 'meg_unavailable');

  assert.deepEqual(
    store.exportUserData({ userId: 'user-a' }).messages.map((message) => message.role),
    ['user']
  );
});
