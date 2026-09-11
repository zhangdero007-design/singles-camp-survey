const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim().replace(/[\r\n]/g, '');

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
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Turso non-JSON response: ' + text.substring(0, 500)); }

  if (!resp.ok) {
    throw new Error('Turso HTTP ' + resp.status + ': ' + text.substring(0, 500));
  }

  const result = data.results && data.results[0];
  if (!result) {
    throw new Error('Turso no results: ' + text.substring(0, 500));
  }
  if (result.type === 'error') {
    throw new Error('Turso result error: ' + JSON.stringify(result.error));
  }
  if (result.response && result.response.result) {
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
}

module.exports = { db: { execute }, ensureTables };
