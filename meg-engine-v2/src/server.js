try { require('dotenv').config(); } catch {}
const { loadConfig } = require('./config/env');
const { createApp } = require('./app');

if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production' && !String(process.env.MEG_API_KEY || '').trim()) {
  throw new Error('Standalone production Meg requires MEG_API_KEY. Bloom uses its separate Firebase-authenticated server.');
}
const config = loadConfig();
const app = createApp({ config });
const server = app.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ service: 'meg-engine-v2', port: config.port, host: config.host, persistence: app.locals.meg.store.driver }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ service: 'meg-engine-v2', event: 'shutdown', signal }));
  server.close(() => {
    try { app.locals.meg.store.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
