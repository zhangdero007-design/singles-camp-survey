const { db, ensureTables } = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { getMatchData } = require('../../lib/results-helper');

module.exports = async (req, res) => {
  await ensureTables();
  if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });

  const total = (await db.execute('SELECT COUNT(*) as cnt FROM participants WHERE is_active = 1')).rows[0].cnt;
  const males = (await db.execute("SELECT COUNT(*) as cnt FROM participants WHERE is_active = 1 AND gender = 'male'")).rows[0].cnt;
  const females = (await db.execute("SELECT COUNT(*) as cnt FROM participants WHERE is_active = 1 AND gender = 'female'")).rows[0].cnt;
  const submitted = (await db.execute('SELECT COUNT(*) as cnt FROM submissions')).rows[0].cnt;
  const notSubmitted = total - submitted;
  const rate = total > 0 ? Math.round(submitted / total * 100) : 0;

  const results = await getMatchData(db);
  const mutualCount = results.mutualLikes.length;

  res.json({ total, males, females, submitted, notSubmitted, rate, mutualCount });
};
