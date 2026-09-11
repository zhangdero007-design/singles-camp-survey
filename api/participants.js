const { db, ensureTables } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    await ensureTables();
    const sql = 'SELECT id, name, gender FROM participants WHERE is_active = 1 ORDER BY name';
    const result = await db.execute(sql, []);
    res.status(200).json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
};
