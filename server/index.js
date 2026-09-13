require('dotenv').config({ quiet: true });

const express = require('express');
const { createRequireFirebaseAuth } = require('./firebaseAuth');
const { verifyFirebaseIdToken } = require('./firebaseAdmin');
const { safeLogger } = require('./safeLogger');
const { createMegV2Bridge } = require('./megV2Bridge');
const { RateLimiter } = require('../meg-engine-v2/src/reliability/rateLimiter');

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '127.0.0.1';
const DEV_CORS_HOSTS = ['localhost', '127.0.0.1'];
const DEV_CORS_PORT_MIN = 8081;
const DEV_CORS_PORT_MAX = 8090;
const DEFAULT_DEV_CORS_ORIGINS = DEV_CORS_HOSTS.flatMap((host) => (
  Array.from(
    { length: DEV_CORS_PORT_MAX - DEV_CORS_PORT_MIN + 1 },
    (_value, index) => `http://${host}:${DEV_CORS_PORT_MIN + index}`
  )
));

function cleanOrigin(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function resolveAllowedOrigins(environment = process.env) {
  const production = String(environment.NODE_ENV || '').trim().toLowerCase() === 'production';
  if (!production) {
    const extra = String(environment.MEG_EXTRA_CORS_ORIGINS || '')
      .split(',')
      .map(cleanOrigin)
      .filter(Boolean);
    return [...DEFAULT_DEV_CORS_ORIGINS, ...extra];
  }

  const configured = String(environment.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(cleanOrigin)
    .filter(Boolean);
  if (!configured.length) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production.');
  }
  return configured.map((origin) => {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
        throw new Error('origin must not contain a path');
      }
      return origin;
    } catch (_error) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain only valid HTTP/HTTPS origins.');
    }
  });
}

function resolveBuildStatus(environment = process.env) {
  const configured = String(environment.BUILD_VERSION || environment.GIT_COMMIT || '').trim();
  return /^[a-zA-Z0-9._-]{1,80}$/.test(configured) ? configured : 'development';
}

function createApp({
  verifyIdToken = verifyFirebaseIdToken,
  megV2Bridge = null,
  allowedOrigins = resolveAllowedOrigins(),
  buildStatus = resolveBuildStatus(),
  logger = safeLogger,
  rateLimit = 60,
} = {}) {
  const bridge = megV2Bridge || createMegV2Bridge();
  if (!bridge || typeof bridge.chat !== 'function') {
    throw new Error('Meg V2 bridge is required.');
  }

  const app = express();
  const originAllowlist = new Set(allowedOrigins);
  const requireFirebaseAuth = createRequireFirebaseAuth({ verifyIdToken, logger });
  const requireVerifiedFirebaseAuth = createRequireFirebaseAuth({ verifyIdToken, logger, allowDevAuth: false });
  const limiter = new RateLimiter({ limit: Math.max(1, Number(rateLimit) || 60) });

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.vary('Origin');
    const origin = cleanOrigin(request.get('origin'));
    if (origin && !originAllowlist.has(origin)) {
      logger.warn('cors_origin_rejected', {
        method: request.method,
        path: request.path,
        status: 403,
      });
      return response.status(403).json({ error: 'Origin is not allowed.' });
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-meg-trace-id');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Max-Age', '600');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));

  app.get('/health', (_request, response) => {
    const meg = typeof bridge.health === 'function' ? bridge.health() : {};
    const ready = meg.ready === true;
    response.status(ready ? 200 : 503).json({
      ok: ready,
      status: ready ? 'ready' : 'not_ready',
      build: buildStatus,
      provider: 'meg-v2',
      engineVersion: meg.engineVersion || 'meg-v2',
      persistence: meg.persistence || 'unknown',
      authenticationConfigured: meg.authenticationConfigured === true,
      providers: meg.providers || {},
    });
  });

  // Liveness is separate from readiness: an unconfigured process is not ready.
  app.get('/live', (_request, response) => response.json({ ok: true, provider: 'meg-v2' }));

  function dataHandler(operation) {
    return async (request, response) => {
      response.set('Cache-Control', 'no-store');
      try {
        const result = await operation({ uid: request.auth.uid, conversationId: request.params.id });
        return response.json(result ?? { ok: true });
      } catch (error) {
        const status = error?.status === 400 ? 400 : 503;
        logger.warn('meg_data_operation_failed', { status });
        return response.status(status).json({ error: status === 400
          ? 'Choose a valid conversation.' : 'Meg data could not be updated. Please try again.' });
      }
    };
  }
  app.delete('/api/meg/data', requireVerifiedFirebaseAuth, dataHandler(async (input) => {
    await bridge.deleteUserData(input);
    return { ok: true };
  }));
  app.delete('/api/meg/conversations/:id', requireVerifiedFirebaseAuth, dataHandler(async (input) => {
    await bridge.deleteConversation(input);
    return { ok: true };
  }));
  app.get('/api/meg/data', requireVerifiedFirebaseAuth, dataHandler((input) => bridge.exportUserData(input)));

  app.post('/api/meg/chat', requireFirebaseAuth, async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (!limiter.allow(request.auth.uid)) {
      response.set('Retry-After', '60');
      return response.status(429).json({ error: 'Please wait a little before messaging Meg again.' });
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once('aborted', abort);
    const onClose = () => { if (!response.writableEnded) abort(); };
    response.once('close', onClose);

    try {
      const payload = await bridge.chat({
        uid: request.auth.uid,
        body: request.body || {},
        signal: controller.signal,
      });
      return response.json(payload);
    } catch (error) {
      const status = Number(error?.status);
      if (Number.isInteger(status) && status >= 400 && status < 600) {
        logger.warn('meg_v2_request_rejected', {
          code: error?.code || error?.name || 'request_error',
          status,
        });
        return response.status(status).json({
          error: error?.code || 'Meg could not respond right now. Please try again.',
          ...(Array.isArray(error?.details) ? { details: error.details } : {}),
        });
      }
      logger.error('meg_v2_request_failed', {
        code: error?.code || error?.name || 'unknown',
        status: 503,
      });
      return response.status(503).json({
        error: 'Meg is unavailable right now. Please try again.',
      });
    } finally {
      request.removeListener('aborted', abort);
      response.removeListener('close', onClose);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large') return response.status(413).json({ error: 'This message is too large. Please shorten it.' });
    if (error instanceof SyntaxError) {
      return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    logger.error('meg_server_error', {
      code: error?.code || error?.name || 'unknown',
      status: 500,
    });
    return response.status(500).json({ error: 'The Meg service encountered an error.' });
  });

  return app;
}

function startServer() {
  const port = Number(process.env.PORT || process.env.MEG_SERVER_PORT) || DEFAULT_PORT;
  const host = process.env.MEG_SERVER_HOST
    || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : DEFAULT_HOST);
  const app = createApp();
  const server = app.listen(port, host, () => {
    safeLogger.info('meg_server_started', {
      provider: 'meg-v2',
      status: 'ready',
    });
  });
  server.on('error', (error) => {
    safeLogger.error('meg_server_listen_failed', {
      code: error?.code || error?.name || 'listen_error',
      status: 1,
    });
    process.exitCode = 1;
  });
  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    safeLogger.error('meg_server_boot_failed', {
      code: error?.code || error?.name || 'configuration_error',
      status: 1,
    });
    process.exitCode = 1;
  }
}

module.exports = {
  createApp,
  startServer,
  resolveAllowedOrigins,
  resolveBuildStatus,
  DEFAULT_DEV_CORS_ORIGINS,
};
