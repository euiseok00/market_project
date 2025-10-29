import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';

async function run() {
  try {
    const [rows] = await pool.query('SELECT user_id, password FROM User');
    for (const r of rows) {
      const pw = r.password || '';
      // naive check: if starts with $2 -> already bcrypt
      if (pw.startsWith('$2')) continue;
      const hash = await bcrypt.hash(pw, 10);
      await pool.query('UPDATE User SET password = ? WHERE user_id = ?', [hash, r.user_id]);
      console.log('hashed user', r.user_id);
    }
    console.log('done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
