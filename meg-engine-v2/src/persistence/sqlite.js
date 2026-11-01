const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const METRIC_COLUMNS = {
  user_id: 'TEXT',
  conversation_id: 'TEXT',
  context_ms: 'INTEGER',
  input_token_estimate: 'INTEGER',
  output_token_estimate: 'INTEGER',
  memory_retrieval_ms: 'INTEGER',
  provider_connect_ms: 'INTEGER',
  generation_ms: 'INTEGER',
  persistence_ms: 'INTEGER',
  retry_count: 'INTEGER NOT NULL DEFAULT 0',
  cache_hit: 'INTEGER NOT NULL DEFAULT 0',
  safety_trigger: 'INTEGER NOT NULL DEFAULT 0',
  revision_trigger: 'INTEGER NOT NULL DEFAULT 0',
  engine_version: 'TEXT',
  prompt_version: 'TEXT',
  router_version: 'TEXT',
};

class SQLiteStore {
  constructor({ filename } = {}) {
    let Database;
    try { Database = require('better-sqlite3'); } catch (error) {
      throw new Error(`better-sqlite3 is unavailable: ${error.message}`);
    }
    const resolved = path.resolve(filename || path.join(process.cwd(), 'data', 'meg.db'));
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 2500');
    this.db.pragma('secure_delete = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, id)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL,
        role TEXT NOT NULL, content TEXT NOT NULL, client_message_id TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, conversation_id TEXT, layer TEXT NOT NULL,
        content TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', importance REAL NOT NULL DEFAULT 0.5,
        created_at TEXT NOT NULL, last_used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS memories_user_idx ON memories(user_id, layer, created_at);
      CREATE TABLE IF NOT EXISTS provider_metrics (
        id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, provider TEXT, route TEXT, intent TEXT,
        provider_latency_ms INTEGER, ttft_ms INTEGER, total_ms INTEGER, fallbacks INTEGER NOT NULL DEFAULT 0,
        token_estimate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS request_dedup (
        user_id TEXT NOT NULL, conversation_id TEXT NOT NULL, message_id TEXT NOT NULL,
        request_hash TEXT NOT NULL, status TEXT NOT NULL, response_text TEXT,
        response_meta TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, conversation_id, message_id)
      );
    `);
    this.migrate();
  }

  migrate() {
    const conversationColumns = this.db.prepare('PRAGMA table_info(conversations)').all();
    if (conversationColumns.filter(column => column.pk > 0).length === 1) {
      this.db.transaction(() => {
        this.db.exec(`CREATE TABLE conversations_scoped_v2 (
          id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, id));
          INSERT INTO conversations_scoped_v2 SELECT id, user_id, created_at, updated_at FROM conversations;
          DROP TABLE conversations;
          ALTER TABLE conversations_scoped_v2 RENAME TO conversations;`);
      })();
    }
    // Recover owner metadata for messages whose conversation ID collided in the old schema.
    this.db.exec(`INSERT OR IGNORE INTO conversations (id, user_id, created_at, updated_at)
      SELECT conversation_id, user_id, MIN(created_at), MAX(created_at) FROM messages
      GROUP BY user_id, conversation_id;
      CREATE INDEX IF NOT EXISTS messages_user_conversation_idx ON messages(user_id, conversation_id, created_at);`);
    const columns = new Set(this.db.prepare('PRAGMA table_info(messages)').all().map((row) => row.name));
    if (!columns.has('client_message_id')) this.db.exec('ALTER TABLE messages ADD COLUMN client_message_id TEXT');
    if (!columns.has('safety')) this.db.exec('ALTER TABLE messages ADD COLUMN safety TEXT');
    if (!columns.has('urgent')) this.db.exec('ALTER TABLE messages ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0');
    if (!columns.has('feedback')) this.db.exec('ALTER TABLE messages ADD COLUMN feedback TEXT');
    if (!columns.has('feedback_updated_at')) this.db.exec('ALTER TABLE messages ADD COLUMN feedback_updated_at TEXT');
    this.db.exec('CREATE INDEX IF NOT EXISTS messages_client_id_idx ON messages(user_id, conversation_id, client_message_id)');
    this.db.transaction(() => {
      this.db.exec(`DELETE FROM messages
        WHERE role = 'user' AND client_message_id IS NOT NULL AND rowid NOT IN (
          SELECT MIN(rowid) FROM messages
          WHERE role = 'user' AND client_message_id IS NOT NULL
          GROUP BY user_id, conversation_id, client_message_id
        )`);
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS messages_user_client_id_unique_idx
        ON messages(user_id, conversation_id, client_message_id)
        WHERE role = 'user' AND client_message_id IS NOT NULL`);
    })();
    const repairReplay = this.db.transaction(() => {
      for (const row of this.db.prepare("SELECT * FROM request_dedup WHERE status = 'done'").all()) {
        let metadata;
        try { metadata = JSON.parse(row.response_meta || '{}'); } catch { continue; }
        if (metadata.messageId !== row.message_id) continue;
        const answer = this.db.prepare(`SELECT id FROM messages WHERE user_id = ? AND conversation_id = ?
          AND role = 'assistant' AND content = ? AND created_at <= ? ORDER BY created_at DESC, rowid DESC LIMIT 1`)
          .get(row.user_id, row.conversation_id, row.response_text, row.updated_at);
        if (!answer) continue;
        this.db.prepare('UPDATE request_dedup SET response_meta = ? WHERE user_id = ? AND conversation_id = ? AND message_id = ?')
          .run(JSON.stringify({ ...metadata, messageId: answer.id }), row.user_id, row.conversation_id, row.message_id);
      }
    });
    repairReplay();
    const metricColumns = new Set(this.db.prepare('PRAGMA table_info(provider_metrics)').all().map((row) => row.name));
    for (const [name, type] of Object.entries(METRIC_COLUMNS)) {
      if (!metricColumns.has(name)) this.db.exec(`ALTER TABLE provider_metrics ADD COLUMN ${name} ${type}`);
    }
  }

  ensureUser(userId) {
    const now = new Date().toISOString();
    this.db.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)').run(userId, now);
  }

  ensureConversation(userId, conversationId) {
    this.ensureUser(userId);
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO conversations (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET updated_at = excluded.updated_at`).run(conversationId, userId, now, now);
  }

  beginRequest({ userId, conversationId, messageId, requestHash, staleAfterMs = 120000 }) {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`INSERT OR IGNORE INTO request_dedup
      (user_id, conversation_id, message_id, request_hash, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'in_progress', ?, ?)`);
    const result = insert.run(userId, conversationId, messageId, requestHash, now, now);
    const row = this.db.prepare(`SELECT user_id AS userId, conversation_id AS conversationId, message_id AS messageId,
      request_hash AS requestHash, status, response_text AS responseText, response_meta AS responseMeta,
      updated_at AS updatedAt FROM request_dedup WHERE user_id = ? AND conversation_id = ? AND message_id = ?`)
      .get(userId, conversationId, messageId);
    if (row.requestHash !== requestHash) return { owner: false, conflict: true, row };
    if (row.status === 'in_progress' && staleAfterMs > 0 && Date.parse(row.updatedAt || '') + staleAfterMs < Date.now()) {
      const takeover = this.db.prepare(`UPDATE request_dedup SET updated_at = ? WHERE user_id = ? AND conversation_id = ? AND message_id = ? AND request_hash = ? AND status = 'in_progress' AND updated_at = ?`)
        .run(now, userId, conversationId, messageId, requestHash, row.updatedAt);
      return { owner: takeover.changes === 1, conflict: false, row: { ...row, updatedAt: now } };
    }
    return { owner: result.changes === 1, conflict: false, row };
  }

  completeRequest({ userId, conversationId, messageId, requestHash, responseText, responseMeta }) {
    this.db.prepare(`UPDATE request_dedup SET status = 'done', response_text = ?, response_meta = ?, updated_at = ?
      WHERE user_id = ? AND conversation_id = ? AND message_id = ? AND request_hash = ?`)
      .run(String(responseText), JSON.stringify(responseMeta || {}), new Date().toISOString(), userId, conversationId, messageId, requestHash);
  }

  releaseRequest({ userId, conversationId, messageId, requestHash }) {
    this.db.prepare(`DELETE FROM request_dedup WHERE user_id = ? AND conversation_id = ? AND message_id = ?
      AND request_hash = ? AND status = 'in_progress'`).run(userId, conversationId, messageId, requestHash);
  }

  appendMessage({ userId, conversationId, role, content, clientMessageId, safety = null, urgent = false }) {
    this.ensureConversation(userId, conversationId);
    const text = String(content);
    const item = { id: randomUUID(), createdAt: new Date().toISOString() };
    if (role === 'user' && clientMessageId) {
      const inserted = this.db.prepare(`INSERT INTO messages
        (id, conversation_id, user_id, role, content, client_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, conversation_id, client_message_id)
        WHERE role = 'user' AND client_message_id IS NOT NULL DO NOTHING`)
        .run(item.id, conversationId, userId, role, text, clientMessageId, item.createdAt);
      if (inserted.changes === 0) {
        const existing = this.db.prepare(`SELECT id, user_id AS userId, conversation_id AS conversationId,
          role, content, client_message_id AS clientMessageId, created_at AS createdAt FROM messages
          WHERE user_id = ? AND conversation_id = ? AND role = 'user' AND client_message_id = ? LIMIT 1`)
          .get(userId, conversationId, clientMessageId);
        return existing?.content === text ? existing : { conflict: true };
      }
      return { ...item, userId, conversationId, role, content: text, clientMessageId };
    }
    this.db.prepare(`INSERT INTO messages
      (id, conversation_id, user_id, role, content, client_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(item.id, conversationId, userId, role, text, clientMessageId || null, item.createdAt);
    if (safety || urgent) this.db.prepare('UPDATE messages SET safety = ?, urgent = ? WHERE id = ?').run(safety, urgent ? 1 : 0, item.id);
    return { ...item, userId, conversationId, role, content: text, clientMessageId: clientMessageId || null };
  }

  getRecentMessages({ userId, conversationId, limit = 8 }) {
    return this.db.prepare(`SELECT id, user_id AS userId, conversation_id AS conversationId, role, content,
      client_message_id AS clientMessageId, created_at AS createdAt FROM messages
      WHERE user_id = ? AND conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`)
      .all(userId, conversationId, limit).reverse();
  }

  updateFeedback({ userId, conversationId, messageId, feedback }) {
    const updatedAt = new Date().toISOString();
    const result = this.db.prepare(`UPDATE messages SET feedback = ?, feedback_updated_at = ?
      WHERE user_id = ? AND conversation_id = ? AND id = ? AND role = 'assistant'`)
      .run(feedback, updatedAt, userId, conversationId, messageId);
    return result.changes ? { feedback, feedbackUpdatedAt: updatedAt } : null;
  }

  addMemory({ userId, conversationId, layer, content, tags = [], importance = 0.5 }) {
    this.ensureUser(userId);
    const existing = this.db.prepare('SELECT id FROM memories WHERE user_id = ? AND content = ? LIMIT 1').get(userId, String(content));
    if (existing) return { id: existing.id, duplicate: true };
    const item = { id: randomUUID(), createdAt: new Date().toISOString() };
    this.db.prepare(`INSERT INTO memories (id, user_id, conversation_id, layer, content, tags, importance, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(item.id, userId, conversationId || null, layer, String(content), JSON.stringify(tags), importance, item.createdAt);
    return { ...item, userId, conversationId, layer, content: String(content), tags, importance };
  }

  listMemories({ userId, layers, limit = 50 }) {
    const rows = this.db.prepare(`SELECT id, user_id AS userId, conversation_id AS conversationId, layer, content, tags,
      importance, created_at AS createdAt, last_used_at AS lastUsedAt FROM memories
      WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?`).all(userId, limit * 3);
    return rows.filter((row) => !layers || layers.includes(row.layer)).slice(0, limit).map((row) => ({ ...row, tags: JSON.parse(row.tags || '[]') }));
  }

  markMemoryUsed(id) { this.db.prepare('UPDATE memories SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id); }

  saveProviderMetric(metric) {
    this.db.prepare(`INSERT INTO provider_metrics (
      id, trace_id, provider, route, intent, provider_latency_ms, ttft_ms, total_ms, fallbacks,
      token_estimate, input_token_estimate, output_token_estimate, context_ms, memory_retrieval_ms, provider_connect_ms, generation_ms, persistence_ms,
      retry_count, cache_hit, safety_trigger, revision_trigger, engine_version, prompt_version, router_version, user_id, conversation_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      randomUUID(), metric.traceId, metric.provider || null, metric.route || null, metric.intent || null,
      metric.providerLatencyMs || null, metric.ttftMs || null, metric.totalMs || null, metric.fallbacks || 0,
      metric.tokenEstimate || metric.outputTokenEstimate || 0, metric.inputTokenEstimate || null, metric.outputTokenEstimate || metric.tokenEstimate || 0,
      metric.contextMs || null, metric.memoryRetrievalMs || null, metric.providerConnectMs || null,
      metric.generationMs || null, metric.persistenceMs || null, metric.retries || 0, metric.cacheHit ? 1 : 0,
      metric.safetyTriggered ? 1 : 0, metric.revisionTriggered ? 1 : 0, metric.engineVersion || null,
      metric.promptVersion || null, metric.routerVersion || null, metric.userId || null, metric.conversationId || null, new Date().toISOString(),
    );
  }

  clearMemories({ userId, layer } = {}) {
    if (layer) return this.db.prepare('DELETE FROM memories WHERE user_id = ? AND layer = ?').run(userId, layer).changes;
    return this.db.prepare('DELETE FROM memories WHERE user_id = ?').run(userId).changes;
  }

  deleteConversation({ userId, conversationId }) {
    const transaction = this.db.transaction(() => {
      this.deleteRequests(userId, conversationId);
      const messages = this.db.prepare('DELETE FROM messages WHERE user_id = ? AND conversation_id = ?').run(userId, conversationId).changes;
      const memories = this.db.prepare('DELETE FROM memories WHERE user_id = ? AND conversation_id = ?').run(userId, conversationId).changes;
      this.db.prepare('DELETE FROM conversations WHERE user_id = ? AND id = ?').run(userId, conversationId);
      return { messages, memories };
    });
    return transaction();
  }

  exportUserData({ userId }) {
    return {
      user: this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null,
      conversations: this.db.prepare('SELECT * FROM conversations WHERE user_id = ?').all(userId),
      messages: this.db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at, rowid').all(userId),
      memories: this.db.prepare('SELECT * FROM memories WHERE user_id = ?').all(userId),
      requests: this.db.prepare('SELECT * FROM request_dedup WHERE user_id = ?').all(userId),
    };
  }

  deleteRequests(userId, conversationId) {
    const where = conversationId ? 'user_id = ? AND conversation_id = ?' : 'user_id = ?';
    const args = conversationId ? [userId, conversationId] : [userId];
    this.db.prepare(`DELETE FROM provider_metrics WHERE ${where}`).run(...args);
    for (const row of this.db.prepare(`SELECT response_meta FROM request_dedup WHERE ${where}`).all(...args)) {
      let traceId;
      try { traceId = JSON.parse(row.response_meta || '{}').traceId; } catch {}
      if (typeof traceId === 'string') this.db.prepare('DELETE FROM provider_metrics WHERE trace_id = ?').run(traceId);
    }
    this.db.prepare(`DELETE FROM request_dedup WHERE ${where}`).run(...args);
  }

  deleteUserData({ userId }) {
    this.db.transaction(() => {
      this.deleteRequests(userId);
      for (const table of ['messages', 'memories', 'conversations']) {
        this.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      }
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    })();
  }

  close() { this.db.close(); }
}

module.exports = { SQLiteStore };
