const { db, ensureTables } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');

const GENDER_TEXT = { male: '男生', female: '女生' };

module.exports = async (req, res) => {
  try {
    await ensureTables();
    if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });

    const allPeople = (await db.execute('SELECT id, name, gender FROM participants')).rows;
    const allP = {};
    allPeople.forEach(p => { allP[p.id] = p; });

    const rows = (await db.execute(`
      SELECT s.*, p.name as p_name, p.gender as p_gender
      FROM submissions s
      JOIN participants p ON s.participant_id = p.id
      ORDER BY s.submitted_at DESC
    `)).rows;

    const header = '提交者,提交者性别,第一选择,选择对象性别,第二选择,选择对象性别,第三选择,选择对象性别,提交时间\n';
    let csv = '\ufeff' + header;

    for (const s of rows) {
      const pickInfo = (pid) => {
        if (!pid) return ['—', ''];
        const person = allP[pid];
        return [person ? person.name : '(已删除)', person ? GENDER_TEXT[person.gender] : ''];
      };
      const p1 = pickInfo(s.pick1_id);
      const p2 = pickInfo(s.pick2_id);
      const p3 = pickInfo(s.pick3_id);
      csv += `${s.p_name},${GENDER_TEXT[s.p_gender]},${p1[0]},${p1[1]},${p2[0]},${p2[1]},${p3[0]},${p3[1]},${s.submitted_at}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
