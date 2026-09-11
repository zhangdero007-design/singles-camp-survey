const { db, ensureTables } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');
const { getMatchData } = require('../../../lib/results-helper');

module.exports = async (req, res) => {
  try {
    await ensureTables();
    if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });

    const results = await getMatchData(db);
    const header = '类型,男生,女生\n';
    let csv = '\ufeff' + header;

    for (const m of results.mutualLikes) {
      const a = m.person_a.gender === 'male' ? m.person_a : m.person_b;
      const b = m.person_a.gender === 'male' ? m.person_b : m.person_a;
      csv += `双向选择,${a.name},${b.name}\n`;
    }
    for (const o of results.oneWayLikes) {
      const isMaleFrom = o.from.gender === 'male';
      const male = isMaleFrom ? o.from : o.to;
      const female = isMaleFrom ? o.to : o.from;
      csv += `单向选择,${male.name},${female.name}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=matches.csv');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
