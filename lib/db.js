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
  if (result && result.type === 'ok' && result.response && result.response.result) {
    const res = result.response.result;
    const cols = res.cols || [];
    const rawRows = res.rows || [];
    const rows = rawRows.map(r => {
      const obj = {};
      cols.forEach((col, i) => {
        const cell = r[i];
        obj[col.name] = cell ? cell.value : null;
      });
      return obj;
    });
    return { rows };
  }
  return { rows: [] };
}

let _initialized = false;

async function ensureTables() {
  if (_initialized) return;
  _initialized = true;
  // Tables already exist in Turso, so just set flag and skip
  // Tables were created via setup-db.js
}

module.exports = { db: { execute }, ensureTables };
