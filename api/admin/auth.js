const { requireAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  res.json({ isAdmin: requireAdmin(req) });
};
