const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'singles-camp-survey-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 * 4 }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ───
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(401).json({ error: '请先登录' });
  next();
}

const RATING_TEXT = { good: '有好感', normal: '一般', bad: '无好感' };
const GENDER_TEXT = { male: '男生', female: '女生' };

// ─── User APIs ───

// Get active participants (optionally filtered by gender)
app.get('/api/participants', (req, res) => {
  const { gender } = req.query;
  let sql = 'SELECT id, name, gender FROM participants WHERE is_active = 1';
  const params = [];
  if (gender === 'male' || gender === 'female') {
    sql += ' AND gender = ?';
    params.push(gender);
  }
  sql += ' ORDER BY name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Check if a participant has already submitted
app.post('/api/check-submitted', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '缺少姓名' });
  const p = db.prepare('SELECT id FROM participants WHERE name = ?').get(name);
  if (!p) return res.json({ submitted: false });
  const s = db.prepare('SELECT id FROM submissions WHERE participant_id = ?').get(p.id);
  res.json({ submitted: !!s });
});

// Submit survey
app.post('/api/submit', (req, res) => {
  const { participant_id, picks } = req.body;
  if (!participant_id || !Array.isArray(picks) || picks.length < 1 || picks.length > 3) {
    return res.status(400).json({ error: '请至少选择 1 位' });
  }
  const p = db.prepare('SELECT id, gender FROM participants WHERE id = ?').get(participant_id);
  if (!p) return res.status(400).json({ error: '参加者不存在' });
  const existing = db.prepare('SELECT id FROM submissions WHERE participant_id = ?').get(participant_id);
  if (existing) return res.status(409).json({ error: '你已经完成本次调查' });
  const ids = picks.map(x => x.id);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: '不能重复选择同一个人' });
  for (const pick of picks) {
    const picked = db.prepare('SELECT id, gender FROM participants WHERE id = ?').get(pick.id);
    if (!picked) return res.status(400).json({ error: '选择的对象不存在' });
    if (picked.gender === p.gender) return res.status(400).json({ error: '只能选择异性' });
  }
  const padded = [...picks];
  while (padded.length < 3) padded.push({ id: null });
  db.prepare(`
    INSERT INTO submissions (participant_id, pick1_id, pick2_id, pick3_id)
    VALUES (?, ?, ?, ?)
  `).run(
    participant_id,
    padded[0].id,
    padded[1].id,
    padded[2].id
  );
  res.json({ success: true });
});

// ─── Admin Auth ───

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请输入密码' });
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get('admin');
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (!admin || admin.password !== hash) {
    return res.status(401).json({ error: '密码错误' });
  }
  req.session.isAdmin = true;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/auth', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// ─── Admin: Participants ───

app.get('/api/admin/participants', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, gender, is_active, created_at,
      (SELECT COUNT(*) FROM submissions WHERE participant_id = participants.id) as submitted
    FROM participants ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/admin/participants', requireAdmin, (req, res) => {
  const { name, gender } = req.body;
  if (!name || !gender) return res.status(400).json({ error: '姓名和性别不能为空' });
  if (!['male', 'female'].includes(gender)) return res.status(400).json({ error: '性别无效' });
  try {
    db.prepare('INSERT INTO participants (name, gender) VALUES (?, ?)').run(name, gender);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '姓名已存在' });
    res.status(500).json({ error: '添加失败' });
  }
});

app.put('/api/admin/participants/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, gender, is_active } = req.body;
  const current = db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: '人员不存在' });
  const newName = name || current.name;
  const newGender = gender || current.gender;
  const newActive = typeof is_active === 'boolean' ? (is_active ? 1 : 0) : current.is_active;
  if (!newName) return res.status(400).json({ error: '姓名不能为空' });
  try {
    db.prepare('UPDATE participants SET name = ?, gender = ?, is_active = ? WHERE id = ?')
      .run(newName, newGender, newActive, id);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '姓名已存在' });
    res.status(500).json({ error: '修改失败' });
  }
});

app.delete('/api/admin/submissions/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  res.json({ success: true });
});

app.delete('/api/admin/participants/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const hasSub = db.prepare('SELECT COUNT(*) as cnt FROM submissions WHERE participant_id = ?').get(id);
  if (hasSub.cnt > 0) {
    db.prepare('UPDATE participants SET is_active = 0 WHERE id = ?').run(id);
    return res.json({ success: true, deactivated: true });
  }
  db.prepare('DELETE FROM participants WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Admin: Results ───

const { getMatchData } = require('./server-results-helper');

app.get('/api/admin/results', requireAdmin, (req, res) => {
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

  const matchData = getMatchData(db);
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
      picks: [
        makePick(s.pick1_id),
        makePick(s.pick2_id),
        makePick(s.pick3_id)
      ],
      submitted_at: s.submitted_at
    };
  });

  const pickCountList = Object.entries(matchData.pickCount).map(([pid, cnt]) => {
    const p = allP[pid];
    return { id: parseInt(pid), name: p ? p.name : '(已删除)', gender: p ? p.gender : 'unknown', gender_text: p ? GENDER_TEXT[p.gender] : '', count: cnt };
  }).sort((a, b) => b.count - a.count);

  res.json({
    submissions: formatted,
    mutualLikes: matchData.mutualLikes,
    oneWayLikes: matchData.oneWayLikes,
    pickCount: pickCountList
  });
});

// ─── Admin: Stats ───

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM participants WHERE is_active = 1').get().cnt;
  const males = db.prepare("SELECT COUNT(*) as cnt FROM participants WHERE is_active = 1 AND gender = 'male'").get().cnt;
  const females = db.prepare("SELECT COUNT(*) as cnt FROM participants WHERE is_active = 1 AND gender = 'female'").get().cnt;
  const submitted = db.prepare('SELECT COUNT(*) as cnt FROM submissions').get().cnt;
  const notSubmitted = total - submitted;
  const rate = total > 0 ? Math.round(submitted / total * 100) : 0;

  const results = getMatchData(db);
  const mutualCount = results.mutualLikes.length;

  res.json({
    total, males, females, submitted, notSubmitted, rate, mutualCount
  });
});

// ─── Admin: Export ───

app.get('/api/admin/export/submissions', requireAdmin, (req, res) => {
  const allP = {};
  db.prepare('SELECT id, name, gender FROM participants').all().forEach(p => { allP[p.id] = p; });

  const rows = db.prepare(`
    SELECT s.*, p.name as p_name, p.gender as p_gender
    FROM submissions s
    JOIN participants p ON s.participant_id = p.id
    ORDER BY s.submitted_at DESC
  `).all();

  const header = '提交者,提交者性别,第一选择,选择对象性别,第二选择,选择对象性别,第三选择,选择对象性别,提交时间\n';
  let csv = '\ufeff' + header;

  for (const s of rows) {
    const pickInfo = (pid) => {
      if (!pid) return ['—', ''];
      const person = allP[pid];
      return [
        person ? person.name : '(已删除)',
        person ? GENDER_TEXT[person.gender] : ''
      ];
    };
    const p1 = pickInfo(s.pick1_id);
    const p2 = pickInfo(s.pick2_id);
    const p3 = pickInfo(s.pick3_id);
    csv += `${s.p_name},${GENDER_TEXT[s.p_gender]},${p1[0]},${p1[1]},${p2[0]},${p2[1]},${p3[0]},${p3[1]},${s.submitted_at}\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
  res.send(csv);
});

app.get('/api/admin/export/matches', requireAdmin, (req, res) => {
  const results = getMatchData(db);

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
});

// HTML routes
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  let lanIP = '未检测到';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIP = net.address;
      }
    }
  }
  console.log(`\n  调查网页已启动！\n`);
  console.log(`  本机访问: http://localhost:${PORT}`);
  console.log(`  局域网访问（手机同WiFi）: http://${lanIP}:${PORT}`);
  console.log(`  管理后台: http://${lanIP}:${PORT}/admin/login`);
  console.log(`  管理密码: admin123\n`);
  console.log(`  让参加者扫码或输入上面的局域网地址即可填写。\n`);
});
