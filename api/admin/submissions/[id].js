const { db, ensureTables } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');

module.exports = async (req, res) => {
  await ensureTables();
  if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });
  const { id } = req.query;

  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM submissions WHERE id = ?', args: [id] });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
