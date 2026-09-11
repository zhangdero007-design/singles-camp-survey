const { db, ensureTables } = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { getBody } = require('../../lib/helper');

module.exports = async (req, res) => {
  await ensureTables();
  if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });

  if (req.method === 'GET') {
    const result = await db.execute(`
      SELECT p.id, p.name, p.gender, p.is_active, p.created_at,
        (SELECT COUNT(*) FROM submissions WHERE participant_id = p.id) as submitted
      FROM participants p ORDER BY p.created_at DESC
    `);
    return res.json(result.rows);
  }

  if (req.method === 'POST') {
    const { name, gender } = getBody(req);
    if (!name || !gender) return res.status(400).json({ error: '姓名和性别不能为空' });
    if (!['male', 'female'].includes(gender)) return res.status(400).json({ error: '性别无效' });
    try {
      await db.execute({ sql: 'INSERT INTO participants (name, gender) VALUES (?, ?)', args: [name, gender] });
      return res.json({ success: true });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: '姓名已存在' });
      return res.status(500).json({ error: '添加失败' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
