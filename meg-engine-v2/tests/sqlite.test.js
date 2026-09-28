const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MemoryStore } = require('../src/memory/memoryStore');
const { SQLiteStore } = require('../src/persistence/sqlite');

test('SQLite schema stores requests, messages, metrics, and supports user controls', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meg-sqlite-'));
  const filename = path.join(directory, 'meg.db');
  const store = new MemoryStore({ filename });
  assert.equal(store.driver, 'sqlite');
  const started = store.beginRequest({ userId: 'u', conversationId: 'c', messageId: 'm', requestHash: 'h' });
  assert.equal(started.owner, true);
  store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'hello', clientMessageId: 'm' });
  store.addMemory({ userId: 'u', conversationId: 'c', layer: 'profile', content: 'User prefers short responses.', tags: ['preference'], importance: 0.8 });
  store.completeRequest({ userId: 'u', conversationId: 'c', messageId: 'm', requestHash: 'h', responseText: 'hello back', responseMeta: { messageId: 'a' } });
  assert.equal(store.beginRequest({ userId: 'u', conversationId: 'c', messageId: 'm', requestHash: 'h' }).row.status, 'done');
  store.saveProviderMetric({ traceId: 't', route: 'FAST', intent: 'casual', totalMs: 2 });
  assert.equal(store.exportUserData({ userId: 'u' }).messages.length, 1);
  assert.equal(store.clearMemories({ userId: 'u' }), 1);
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('SQLiteStore migrates the old messages/provider_metrics schema before creating new indexes', () => {
  const Database = require('better-sqlite3');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meg-migrate-'));
  const filename = path.join(directory, 'old.db');
  const db = new Database(filename);
  db.exec(`CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE provider_metrics (id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, provider TEXT, route TEXT, intent TEXT, provider_latency_ms INTEGER, ttft_ms INTEGER, total_ms INTEGER, fallbacks INTEGER NOT NULL DEFAULT 0, token_estimate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`);
  db.close();
  const store = new SQLiteStore({ filename });
  store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'old database' });
  assert.equal(store.getRecentMessages({ userId: 'u', conversationId: 'c' }).length, 1);
  store.close(); fs.rmSync(directory, { recursive: true, force: true });
});

test('SQLiteStore consolidates legacy duplicate client IDs and deduplicates inserts', () => {
  const Database = require('better-sqlite3');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meg-dedupe-'));
  const filename = path.join(directory, 'duplicates.db');
  const db = new Database(filename);
  db.exec(`CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL,
    role TEXT NOT NULL, content TEXT NOT NULL, client_message_id TEXT, created_at TEXT NOT NULL);
    CREATE TABLE provider_metrics (id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, provider TEXT, route TEXT, intent TEXT,
    provider_latency_ms INTEGER, ttft_ms INTEGER, total_ms INTEGER, fallbacks INTEGER NOT NULL DEFAULT 0,
    token_estimate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`);
  const insert = db.prepare(`INSERT INTO messages (id, conversation_id, user_id, role, content, client_message_id, created_at)
    VALUES (?, 'c', 'u', 'user', ?, 'm', ?)`);
  insert.run('first', 'original', '2026-01-01');
  insert.run('duplicate', 'duplicate', '2026-01-02');
  db.close();

  const store = new SQLiteStore({ filename });
  try {
    const existing = store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'original', clientMessageId: 'm' });
    assert.equal(existing.id, 'first');
    assert.deepEqual(store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'changed', clientMessageId: 'm' }), { conflict: true });
    store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'without ID' });
    store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'without ID' });
    assert.equal(store.getRecentMessages({ userId: 'u', conversationId: 'c', limit: 10 }).length, 3);
  } finally {
    store.close(); fs.rmSync(directory, { recursive: true, force: true });
  }
});
