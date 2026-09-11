const { db, ensureTables } = require('../lib/db');
const { getBody } = require('../lib/helper');

module.exports = async (req, res) => {
  await ensureTables();
  const { name } = getBody(req);
  if (!name) return res.status(400).json({ error: '缺少姓名' });
  const pResult = await db.execute({ sql: 'SELECT id FROM participants WHERE name = ?', args: [name] });
  if (pResult.rows.length === 0) return res.json({ submitted: false });
  const pid = pResult.rows[0].id;
  const sResult = await db.execute({ sql: 'SELECT id FROM submissions WHERE participant_id = ?', args: [pid] });
  res.json({ submitted: sResult.rows.length > 0 });
};
