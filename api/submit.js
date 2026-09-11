const { db, ensureTables } = require('../lib/db');
const { getBody } = require('../lib/helper');

module.exports = async (req, res) => {
  try {
    await ensureTables();
    const { participant_id, picks } = getBody(req);
    if (!participant_id || !Array.isArray(picks) || picks.length < 1 || picks.length > 3) {
      return res.status(400).json({ error: '请至少选择 1 位' });
    }
    const pResult = await db.execute('SELECT id, gender FROM participants WHERE id = ?', [participant_id]);
    if (pResult.rows.length === 0) return res.status(400).json({ error: '参加者不存在' });
    const p = pResult.rows[0];

    const existing = await db.execute('SELECT id FROM submissions WHERE participant_id = ?', [participant_id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: '你已经完成本次调查' });

    const ids = picks.map(x => x.id);
    if (new Set(ids).size !== ids.length) return res.status(400).json({ error: '不能重复选择同一个人' });

    for (const pick of picks) {
      const picked = await db.execute('SELECT id, gender FROM participants WHERE id = ?', [pick.id]);
      if (picked.rows.length === 0) return res.status(400).json({ error: '选择的对象不存在' });
      if (picked.rows[0].gender === p.gender) return res.status(400).json({ error: '只能选择异性' });
    }

    const padded = [...picks];
    while (padded.length < 3) padded.push({ id: null });
    await db.execute(
      'INSERT INTO submissions (participant_id, pick1_id, pick2_id, pick3_id) VALUES (?, ?, ?, ?)',
      [participant_id, padded[0].id, padded[1].id, padded[2].id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
