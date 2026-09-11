const { db, ensureTables } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');
const { getBody } = require('../../../lib/helper');

module.exports = async (req, res) => {
  try {
    await ensureTables();
    if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });
    const { id } = req.query;

    if (req.method === 'PUT') {
      const body = getBody(req);
      const { name, gender, is_active } = body;
      const cur = await db.execute('SELECT * FROM participants WHERE id = ?', [id]);
      if (cur.rows.length === 0) return res.status(404).json({ error: '人员不存在' });
      const c = cur.rows[0];
      const newName = (name && name.trim()) || c.name;
      const newGender = gender || c.gender;
      const newActive = typeof is_active === 'boolean' ? (is_active ? 1 : 0) : c.is_active;
      try {
        await db.execute('UPDATE participants SET name = ?, gender = ?, is_active = ? WHERE id = ?', [newName, newGender, newActive, id]);
        return res.json({ success: true });
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: '姓名已存在' });
        return res.status(500).json({ error: '修改失败: ' + e.message });
      }
    }

    if (req.method === 'DELETE') {
      const subCount = await db.execute('SELECT COUNT(*) as cnt FROM submissions WHERE participant_id = ?', [id]);
      const count = parseInt(subCount.rows[0].cnt);
      if (count > 0) {
        await db.execute('UPDATE participants SET is_active = 0 WHERE id = ?', [id]);
        return res.json({ success: true, deactivated: true });
      }
      await db.execute('DELETE FROM participants WHERE id = ?', [id]);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
