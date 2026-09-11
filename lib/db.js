const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

let _initialized = false;

async function ensureTables() {
  if (_initialized) return;
  _initialized = true;
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, gender TEXT NOT NULL CHECK(gender IN ('male','female')), is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`).catch(() => {});
    await db.execute(`CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, participant_id INTEGER NOT NULL, pick1_id INTEGER, pick2_id INTEGER, pick3_id INTEGER, submitted_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(participant_id))`).catch(() => {});
    await db.execute(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL)`).catch(() => {});
  } catch (e) {
    _initialized = false;
  }
}

module.exports = { db, ensureTables };
