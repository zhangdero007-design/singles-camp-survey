const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'singles-camp-survey-2026-secret';

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function sign(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const data = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}

function verify(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== parts[2]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function createToken() {
  return sign({ role: 'admin', exp: Date.now() + 3600000 * 24 });
}

function requireAdmin(req) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) return false;
  const payload = verify(token);
  return payload && payload.role === 'admin';
}

module.exports = { createToken, requireAdmin };
