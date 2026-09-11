const { db, ensureTables } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');

module.exports = async (req, res) => {
  try {
    await ensureTables();
    if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });
    const { id } = req.query;

    if (req.method === 'DELETE') {
      await db.execute('DELETE FROM submissions WHERE id = ?', [id]);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
