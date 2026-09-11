const GENDER_TEXT = { male: '男生', female: '女生' };

function getMatchData(db) {
  const submissions = db.prepare(`
    SELECT
      s.id, s.participant_id,
      p.name as participant_name, p.gender as participant_gender,
      s.pick1_id, s.pick2_id, s.pick3_id,
      s.submitted_at
    FROM submissions s
    JOIN participants p ON s.participant_id = p.id
    ORDER BY s.submitted_at DESC
  `).all();

  const allP = {};
  db.prepare('SELECT id, name, gender FROM participants').all().forEach(p => {
    allP[p.id] = p;
  });

  const subMap = {};
  for (const s of submissions) {
    subMap[s.participant_id] = s;
  }

  // "被选择次数" = 每个人被多少人选中
  const pickCount = {};

  // "双向选择" = A 选了 B 且 B 也选了 A
  const mutualSet = new Set();
  const mutualLikes = [];
  const oneWayLikes = [];

  for (const s of submissions) {
    const pickIds = [s.pick1_id, s.pick2_id, s.pick3_id].filter(id => id !== null);
    for (const pid of pickIds) {
      pickCount[pid] = (pickCount[pid] || 0) + 1;
      const other = subMap[pid];
      if (!other) continue;
      const otherPickIds = [other.pick1_id, other.pick2_id, other.pick3_id].filter(id => id !== null);
      const mutual = otherPickIds.includes(s.participant_id);
      const key = [Math.min(s.participant_id, pid), Math.max(s.participant_id, pid)].join('-');
      if (mutual) {
        if (!mutualSet.has(key)) {
          mutualSet.add(key);
          const a = allP[s.participant_id];
          const b = allP[pid];
          if (a && b) {
            mutualLikes.push({
              person_a: { id: s.participant_id, name: a.name, gender: a.gender, gender_text: GENDER_TEXT[a.gender] },
              person_b: { id: pid, name: b.name, gender: b.gender, gender_text: GENDER_TEXT[b.gender] }
            });
          }
        }
      } else {
        const fromP = allP[s.participant_id];
        const toP = allP[pid];
        if (fromP && toP) {
          oneWayLikes.push({
            from: { id: s.participant_id, name: fromP.name, gender: fromP.gender, gender_text: GENDER_TEXT[fromP.gender] },
            to: { id: pid, name: toP.name, gender: toP.gender, gender_text: GENDER_TEXT[toP.gender] }
          });
        }
      }
    }
  }

  return { mutualLikes, oneWayLikes, pickCount, subMap, allP };
}

module.exports = { getMatchData };
