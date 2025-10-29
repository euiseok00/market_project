import fs from 'fs';
import path from 'path';
import pool from '../db/pool.js';

async function main() {
  console.log('Starting price normalization...');
  const [rows] = await pool.query('SELECT game_id, game_title, price FROM Game');
  console.log('Total games:', rows.length);

  const toUpdate = [];
  const ambiguous = [];

  for (const r of rows) {
    const p = r.price == null ? null : Number(r.price);
    if (p == null) continue;
    if (p === 0) continue; // free, fine

    // Heuristic: prices that look 100x too large (e.g., 6600000 should be 66000)
    if (p >= 1000000) {
      if (p % 100 === 0) {
        const candidate = p / 100;
        // sanity range: 100원 ~ 2,000,000원 (very wide) -> accept
        if (candidate >= 100 && candidate <= 2000000) {
          toUpdate.push({ game_id: r.game_id, title: r.game_title, old: p, new: candidate });
        } else {
          ambiguous.push({ game_id: r.game_id, title: r.game_title, price: p, reason: 'candidate outside sanity range' });
        }
      } else {
        ambiguous.push({ game_id: r.game_id, title: r.game_title, price: p, reason: 'not divisible by 100' });
      }
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const backupFile = path.join(backupDir, `price_fix_backup_${ts}.json`);

  fs.writeFileSync(backupFile, JSON.stringify({ timestamp: new Date().toISOString(), totalRows: rows.length, toUpdate, ambiguous }, null, 2));
  console.log('Backup written to', backupFile);

  if (toUpdate.length === 0) {
    console.log('No automatic updates detected. Ambiguous cases:', ambiguous.length);
    console.table(ambiguous.slice(0, 20));
    return;
  }

  console.log('Rows to be updated (automatic):', toUpdate.length);
  toUpdate.forEach(u => console.log(`  id=${u.game_id} title=${u.title} ${u.old} -> ${u.new}`));

  // Ask for confirmation? The user already requested option A. Proceed.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const u of toUpdate) {
      await conn.query('UPDATE Game SET price = ? WHERE game_id = ?', [u.new, u.game_id]);
    }
    await conn.commit();
    console.log('Update committed. Updated rows:', toUpdate.length);
  } catch (err) {
    await conn.rollback();
    console.error('DB error, rolled back:', err.message || err);
    process.exit(1);
  } finally {
    conn.release();
  }

  // Verify
  const [afterRows] = await pool.query('SELECT game_id, game_title, price FROM Game WHERE game_id IN (' + toUpdate.map(u=>u.game_id).join(',') + ')');
  console.log('Post-update verification:');
  afterRows.forEach(r => console.log(`  id=${r.game_id} title=${r.game_title} price=${r.price}`));

  console.log('Done. If anything looks wrong, use the backup JSON to restore values manually.');
}

main().then(()=>process.exit(0)).catch(err=>{console.error('Fatal error:', err); process.exit(1);});
