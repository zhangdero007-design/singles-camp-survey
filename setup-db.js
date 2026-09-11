const crypto = require('crypto');
const { db, ensureTables } = require('./lib/db');

async function setup() {
  console.log('Creating tables...');
  await ensureTables();

  console.log('Seeding admin...');
  const adminCount = (await db.execute('SELECT COUNT(*) as cnt FROM admins')).rows[0].cnt;
  if (adminCount === 0) {
    const hash = crypto.createHash('sha256').update('admin123').digest('hex');
    await db.execute({ sql: 'INSERT INTO admins (username, password) VALUES (?, ?)', args: ['admin', hash] });
    console.log('Admin created (password: admin123)');
  } else {
    console.log('Admin already exists');
  }

  console.log('Seeding sample participants...');
  const pCount = (await db.execute('SELECT COUNT(*) as cnt FROM participants')).rows[0].cnt;
  if (pCount === 0) {
    const samples = [
      ['张伟', 'male'], ['王强', 'male'], ['李明', 'male'], ['赵磊', 'male'], ['刘洋', 'male'],
      ['陈静', 'female'], ['王芳', 'female'], ['李娜', 'female'], ['赵敏', 'female'], ['刘婷', 'female']
    ];
    for (const [name, gender] of samples) {
      await db.execute({ sql: 'INSERT INTO participants (name, gender, is_active) VALUES (?, ?, 1)', args: [name, gender] });
    }
    console.log('Sample participants added (5 males, 5 females)');
  } else {
    console.log('Participants already exist');
  }

  console.log('\nDatabase setup complete!');
  console.log('You can now deploy to Vercel.');
  process.exit(0);
}

setup().catch(e => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});
