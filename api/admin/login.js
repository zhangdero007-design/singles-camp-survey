const crypto = require('crypto');
const { db, ensureTables } = require('../../lib/db');
const { createToken } = require('../../lib/auth');
const { getBody } = require('../../lib/helper');

module.exports = async (req, res) => {
  try {
    await ensureTables();
    const { password } = getBody(req);
    if (!password) return res.status(400).json({ error: '请输入密码' });
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const result = await db.execute('SELECT * FROM admins WHERE username = ?', ['admin']);
    if (result.rows.length === 0 || result.rows[0].password !== hash) {
      return res.status(401).json({ error: '密码错误' });
    }
    const token = createToken();
    res.json({ success: true, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
