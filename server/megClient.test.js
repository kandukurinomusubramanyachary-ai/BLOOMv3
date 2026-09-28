const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

function loadMegModule(currentUser) {
  const filename = path.resolve(__dirname, '../src/services/meg.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => {
    if (request === './accountWork') return require('../src/services/accountWork');
    if (request === './firebase') return { auth: { currentUser } };
    if (request === './megQaTiming') {
      return {
        MEG_QA_FAILURE_CATEGORY: {
          AUTH: 'auth',
          NETWORK: 'network',
          PARSE: 'parse',
          PROVIDER_TIMEOUT: 'provider_timeout',
          UNKNOWN: 'unknown',
        },
      };
    }
    if (request === './megUrlPolicy') {
      return { resolveMegApiBaseUrl: ({ configuredValue }) => configuredValue || 'http://127.0.0.1:3001' };
    }
    return require(request);
  };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(localRequire, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

test('buildMegContext emits only the bounded server-approved data shape', () => {
  const meg = loadMegModule(null);
  const now = new Date(2026, 7, 9, 12, 0, 0);
  const context = meg.buildMegContext({
    currentCycleDay: 18,
    currentPhase: { label: 'Later cycle', secret: 'no' },
    averageCycleLength: 32,
    todayCheckin: {
      date: '2026-08-09',
      mood: 'low',
      energy: 3,
      sleep: 5,
      pain: 6,
      flow: 'light',
      journal: 'private',
      symptoms: ['private'],
    },
    checkins: [],
    meals: Array.from({ length: 22 }, (_, index) => ({
      id: `meal-${index}`,
      date: '2026-08-09',
      notes: 'private',
    })),
    movements: [{ date: '2026-08-09', status: 'complete', notes: 'private' }],
    profile: {
      goals: ['understand PCOS', 'x'.repeat(61), ...Array.from({ length: 12 }, () => 'goal')],
      trackingMode: 'pcos',
      email: 'private@example.test',
    },
    settings: {},
  }, now);

  assert.deepEqual(context, {
    cycleDay: 18,
    currentPhase: 'Later cycle',
    averageCycleLength: 32,
    todayCheckin: { mood: 'low', energy: 3, sleep: 5, pain: 6, flow: 'light' },
    mealsLogged: 20,
    movementLogged: true,
    goals: ['understand PCOS', ...Array.from({ length: 8 }, () => 'goal')],
    trackingMode: 'pcos',
  });
  assert.doesNotMatch(JSON.stringify(context), /private|email|journal|symptoms|notes/i);
});

test('Meg API provider sends bounded context and mode in the authenticated request', async () => {
  const currentUser = { async getIdToken() { return 'firebase-token'; } };
  const meg = loadMegModule(currentUser);
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          message: 'A contextual reply',
          conversationId: 'conversation-1',
          messageId: 'assistant-1',
          source: 'test',
        };
      },
    };
  };

  try {
    const provider = meg.createLocalMegApiProvider({
      baseUrl: 'http://127.0.0.1:3001',
      timeoutMs: 1000,
    });
    const context = {
      cycleDay: 18,
      todayCheckin: { mood: 'low', sleep: 5, journal: 'private' },
      mealsLogged: 2,
      movementLogged: true,
      goals: [],
      trackingMode: 'cycle',
      email: 'private@example.test',
    };
    await provider.reply({
      message: 'Why do I feel awful?',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      mode: 'understand',
      context,
      history: [],
    });

    assert.equal(request.options.headers.Authorization, 'Bearer firebase-token');
    assert.equal(request.body.mode, 'understand');
    assert.equal(request.body.supportMode, 'understand');
    assert.deepEqual(request.body.context, {
      cycleDay: 18,
      todayCheckin: { mood: 'low', sleep: 5 },
      mealsLogged: 2,
      movementLogged: true,
      goals: [],
      trackingMode: 'cycle',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('megService.send preserves request context when calling its provider', async () => {
  const meg = loadMegModule(null);
  let received;
  const service = meg.createMegService({
    provider: {
      async reply(request) {
        received = request;
        return { text: 'Reply' };
      },
    },
  });
  const context = { cycleDay: 18, mealsLogged: 1 };

  await service.send({ message: 'Hello', mode: 'listen', context });
  assert.equal(received.mode, 'listen');
  assert.deepEqual(received.context, context);
});

test('Meg uses the active screen session without serializing authentication callbacks', async () => {
  const meg = loadMegModule(null);
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (_url, options) => {
    captured = options;
    return { ok: true, status: 200, json: async () => ({ message: 'Hello' }) };
  };
  try {
    const provider = meg.createLocalMegApiProvider({ baseUrl: 'http://127.0.0.1:3001', timeoutMs: 1000 });
    await assert.rejects(provider.reply({ message: 'Hello' }), /sign in/);
    const reply = await provider.reply({ message: 'Hello', getIdToken: async () => 'test-session-token' });
    assert.equal(reply.text, 'Hello');
    assert.equal(captured.headers.Authorization, 'Bearer test-session-token');
    assert.doesNotMatch(captured.body, /getIdToken|test-session-token/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Meg refreshes an expired Firebase token once and preserves the idempotency key', async () => {
  const meg = loadMegModule(null);
  const originalFetch = global.fetch;
  const calls = [];
  const tokenCalls = [];
  global.fetch = async (_url, options) => {
    calls.push({
      authorization: options.headers.Authorization,
      body: JSON.parse(options.body),
    });
    if (calls.length === 1) return { ok: false, status: 401, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ message: 'Authenticated reply', messageId: 'assistant-1' }),
    };
  };

  try {
    const provider = meg.createLocalMegApiProvider({ baseUrl: 'http://127.0.0.1:3001', timeoutMs: 1000 });
    const result = await provider.reply({
      accountUid: 'auth-refresh-user',
      message: 'Hello',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      getIdToken: async (forceRefresh) => {
        tokenCalls.push(forceRefresh);
        return forceRefresh ? 'fresh-token' : 'expired-token';
      },
    });

    assert.equal(result.text, 'Authenticated reply');
    assert.deepEqual(tokenCalls, [undefined, true]);
    assert.deepEqual(calls.map((call) => call.authorization), [
      'Bearer expired-token',
      'Bearer fresh-token',
    ]);
    assert.equal(calls[0].body.messageId, 'message-1');
    assert.deepEqual(calls[1].body, calls[0].body);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Meg fallback auth getter forwards forceRefresh after a 401', async () => {
  const tokenCalls = [];
  const currentUser = { async getIdToken(forceRefresh) { tokenCalls.push(forceRefresh); return forceRefresh ? 'fresh-token' : 'expired-token'; } };
  const meg = loadMegModule(currentUser);
  const originalFetch = global.fetch;
  const authorizations = [];
  global.fetch = async (_url, options) => {
    authorizations.push(options.headers.Authorization);
    return authorizations.length === 1
      ? { ok: false, status: 401, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ message: 'Authenticated reply' }) };
  };

  try {
    const provider = meg.createLocalMegApiProvider({ baseUrl: 'http://127.0.0.1:3001', timeoutMs: 1000 });
    await provider.reply({ accountUid: 'auth-fallback-user', message: 'Hello' });
    assert.deepEqual(tokenCalls, [undefined, true]);
    assert.deepEqual(authorizations, ['Bearer expired-token', 'Bearer fresh-token']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Meg rejects empty input before calling the provider', async () => {
  const meg = loadMegModule(null);
  let calls = 0;
  const service = meg.createMegService({ provider: async () => {
    calls += 1;
    return { text: 'Unexpected' };
  } });

  await assert.rejects(service.send({ message: '   ' }), /Write a message/);
  assert.equal(calls, 0);
});

test('Meg maps malformed, auth, server, and network failures to safe retryable errors', async () => {
  const meg = loadMegModule(null);
  const scenarios = [
    [{ text: '' }, /couldn't respond right now/i],
    [Object.assign(new Error('private auth detail'), { status: 401 }), /sign in again/i],
    [Object.assign(new Error('private server detail'), { status: 503 }), /couldn't respond right now/i],
    [Object.assign(new Error('Failed to fetch private upstream'), { name: 'NetworkError' }), /could not connect/i],
  ];

  for (const [outcome, expected] of scenarios) {
    const service = meg.createMegService({ provider: async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    } });
    await assert.rejects(
      service.send({ message: 'Keep this private' }),
      (error) => expected.test(error.message) && !/private upstream|private server detail|private auth detail/i.test(error.message)
    );
  }
});

test('Meg rejects a successful HTTP response with a malformed payload', async () => {
  const meg = loadMegModule(null);
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ unexpected: true }) });

  try {
    const provider = meg.createLocalMegApiProvider({ baseUrl: 'http://127.0.0.1:3001', timeoutMs: 1000 });
    await assert.rejects(provider.reply({
      accountUid: 'malformed-user',
      message: 'Hello',
      getIdToken: async () => 'valid-token',
    }), /empty response/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Meg times out a slow request instead of leaving the UI pending forever', async () => {
  const meg = loadMegModule(null);
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, { once: true });
  });

  try {
    const provider = meg.createLocalMegApiProvider({ baseUrl: 'http://127.0.0.1:3001', timeoutMs: 10 });
    const startedAt = Date.now();
    await assert.rejects(provider.reply({
      accountUid: 'timeout-user',
      message: 'Hello',
      getIdToken: async () => 'valid-token',
    }), (error) => error.name === 'AbortError');
    assert.ok(Date.now() - startedAt < 500, 'request should fail within the client timeout bound');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Meg also bounds Firebase token acquisition before the network request starts', async () => {
  const meg = loadMegModule(null);
  const provider = meg.createLocalMegApiProvider({ baseUrl: 'http://127.0.0.1:3001', timeoutMs: 10 });
  const startedAt = Date.now();

  await assert.rejects(provider.reply({
    accountUid: 'token-timeout-user',
    message: 'Hello',
    getIdToken: () => new Promise(() => {}),
  }), (error) => error.name === 'AbortError');
  assert.ok(Date.now() - startedAt < 500, 'token acquisition should share the request timeout bound');
});
