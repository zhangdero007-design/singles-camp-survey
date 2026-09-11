const { db, ensureTables } = require('../../lib/db');
const { requireAdmin } = require('../../lib/auth');
const { getMatchData } = require('../../lib/results-helper');

const GENDER_TEXT = { male: '男生', female: '女生' };

module.exports = async (req, res) => {
  try {
    await ensureTables();
    if (!requireAdmin(req)) return res.status(401).json({ error: '请先登录' });

    const submissions = (await db.execute(`
      SELECT s.id, s.participant_id, p.name as participant_name, p.gender as participant_gender,
        s.pick1_id, s.pick2_id, s.pick3_id, s.submitted_at
      FROM submissions s
      JOIN participants p ON s.participant_id = p.id
      ORDER BY s.submitted_at DESC
    `)).rows;

    const matchData = await getMatchData(db);
    const { allP } = matchData;

    const formatted = submissions.map(s => {
      const makePick = (pid) => {
        if (!pid) return { id: null, name: '—', gender: null };
        const person = allP[pid];
        return {
          id: pid,
          name: person ? person.name : '(已删除)',
          gender: person ? person.gender : 'unknown'
        };
      };
      return {
        id: s.id,
        participant_id: s.participant_id,
        participant_name: s.participant_name,
        participant_gender: s.participant_gender,
        participant_gender_text: GENDER_TEXT[s.participant_gender],
        picks: [makePick(s.pick1_id), makePick(s.pick2_id), makePick(s.pick3_id)],
        submitted_at: s.submitted_at
      };
    });

    const pickCountList = Object.entries(matchData.pickCount).map(([pid, cnt]) => {
      const p = allP[pid];
      return {
        id: parseInt(pid),
        name: p ? p.name : '(已删除)',
        gender: p ? p.gender : 'unknown',
        gender_text: p ? GENDER_TEXT[p.gender] : '',
        count: cnt
      };
    }).sort((a, b) => b.count - a.count);

    res.json({
      submissions: formatted,
      mutualLikes: matchData.mutualLikes,
      oneWayLikes: matchData.oneWayLikes,
      pickCount: pickCountList
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
