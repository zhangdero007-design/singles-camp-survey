const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

const baseUrl = TURSO_URL.replace('libsql://', 'https://');

async function execute(sql, args = []) {
  const resp = await fetch(baseUrl + '/v2/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TURSO_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }]
    })
  });
  const data = await resp.json();
  if (!resp.ok) {
    const errMsg = data.error ? data.error.message : JSON.stringify(data);
    throw new Error('Turso error: ' + errMsg);
  }
  const result = data.results && data.results[0];
  if (result && result.type === 'ok' && result.response) {
    const res = result.response.result;
    if (res && res.rows) {
      return { rows: res.rows.map(r => {
        const obj = {};
        if (r.values) {
          res.cols.forEach((col, i) => {
            obj[col] = r.values[i] ? (r.values[i].type === 'integer' ? r.values[i].value : r.values[i].value) : null;
          });
        }
        return obj;
      })};
    }
    return { rows: [] };
  }
  return { rows: [] };
}

let _initialized = false;

async function ensureTables() {
  if (_initialized) return;
  await execute(`CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, gender TEXT NOT NULL CHECK(gender IN ('male','female')), is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  await execute(`CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, participant_id INTEGER NOT NULL, pick1_id INTEGER, pick2_id INTEGER, pick3_id INTEGER, submitted_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(participant_id))`);
  await execute(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL)`);
  _initialized = true;
}

module.exports = { db: { execute }, ensureTables };
