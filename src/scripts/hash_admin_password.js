#!/usr/bin/env node
/**
 * Simple helper to hash the admin password stored in User.id='admin'.
 * Usage:
 *   node src/scripts/hash_admin_password.js            # hashes literal 'admin' and updates
 *   node src/scripts/hash_admin_password.js newpass   # hashes 'newpass' and updates
 *
 * It will read DB config via existing src/db/pool.js (which uses dotenv).
 */
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';

async function run() {
  const newPlain = process.argv[2] || 'admin';
  console.log('Hashing and updating admin account with provided password (hidden)');

  try {
    const [rows] = await pool.query("SELECT user_id, id, password FROM User WHERE id = 'admin'");
    if (!rows || rows.length === 0) {
      console.error("User with id='admin' not found. Aborting.");
      process.exit(1);
    }
    const user = rows[0];
    // If the password already looks like a bcrypt hash ($2a$ or $2b$), skip unless forced
    if (typeof user.password === 'string' && /^\$2[aby]\$\d{2}\$/.test(user.password)) {
      console.log('Admin password already appears hashed. No change made.');
      process.exit(0);
    }

    const hashed = bcrypt.hashSync(newPlain, 10);
    const [res] = await pool.query('UPDATE User SET password = ? WHERE id = ?', [hashed, 'admin']);
    console.log('Updated admin password hash in DB.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update admin password:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

run();
