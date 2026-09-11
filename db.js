const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, 'survey.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);

db.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    gender TEXT NOT NULL CHECK(gender IN ('male','female')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    pick1_id INTEGER,
    rating1 TEXT,
    pick2_id INTEGER,
    rating2 TEXT,
    pick3_id INTEGER,
    rating3 TEXT,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id),
    FOREIGN KEY (pick1_id) REFERENCES participants(id),
    FOREIGN KEY (pick2_id) REFERENCES participants(id),
    FOREIGN KEY (pick3_id) REFERENCES participants(id),
    UNIQUE(participant_id)
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );
`);

// Seed admin if not exists
const adminRow = db.prepare('SELECT COUNT(*) as cnt FROM admins').get();
if (adminRow.cnt === 0) {
  const hash = crypto.createHash('sha256').update('admin123').digest('hex');
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hash);
}

// Seed sample participants if table is empty
const pCount = db.prepare('SELECT COUNT(*) as cnt FROM participants').get();
if (pCount.cnt === 0) {
  const insert = db.prepare('INSERT INTO participants (name, gender, is_active) VALUES (?, ?, 1)');
  const samples = [
    ['张伟', 'male'], ['王强', 'male'], ['李明', 'male'], ['赵磊', 'male'], ['刘洋', 'male'],
    ['陈静', 'female'], ['王芳', 'female'], ['李娜', 'female'], ['赵敏', 'female'], ['刘婷', 'female']
  ];
  for (const [name, gender] of samples) {
    insert.run(name, gender);
  }
}

module.exports = db;
