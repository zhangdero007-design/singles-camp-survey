const { db, ensureTables } = require('../lib/db');

module.exports = async (req, res) => {
  try {
    await ensureTables();
    const { gender } = req.query || {};
    let sql = 'SELECT id, name, gender FROM participants WHERE is_active = 1';
    const args = [];
    if (gender === 'male' || gender === 'female') {
      sql += ' AND gender = ?';
      args.push(gender);
    }
    sql += ' ORDER BY name';
    const result = await db.execute(sql, args);
    res.status(200).json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
