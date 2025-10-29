import pool from '../db/pool.js';

(async function(){
  try {
    const [rows] = await pool.query('SELECT game_id, game_title, price FROM Game ORDER BY game_id DESC LIMIT 10');
    console.log('FOUND', rows.length, 'rows');
    rows.forEach(r => {
      console.log(`id=${r.game_id} title=${r.game_title} price=${r.price}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('ERROR while querying DB:', err.message || err);
    process.exit(1);
  }
})();
