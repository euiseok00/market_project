import pool from '../db/pool.js';
import axios from 'axios';

// Sample list of Steam AppIDs to fetch (10). You can edit this list.
const APPIDS = [1091500, 1086940, 1245620, 620, 570, 730, 578080, 252950, 271590, 582010];

function toDateString(maybeDate) {
  const d = new Date(maybeDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0,10);
}

async function ensureGenre(name) {
  const [rows] = await pool.query('SELECT genre_id FROM Genre WHERE genre_name = ?', [name]);
  if (rows.length > 0) return rows[0].genre_id;
  const [res] = await pool.query('INSERT INTO Genre (genre_name) VALUES (?)', [name]);
  return res.insertId;
}

async function linkGameToGenre(gameId, genreId) {
  await pool.query('INSERT IGNORE INTO GameGenre (game_id, genre_id) VALUES (?, ?)', [gameId, genreId]);
}

async function findGameByTitle(title) {
  const [rows] = await pool.query('SELECT game_id FROM Game WHERE game_title = ?', [title]);
  return rows.length ? rows[0].game_id : null;
}

async function insertOrUpdateGame({ title, image, release_date, developer, price, description }) {
  // check by title
  const existingId = await findGameByTitle(title);
  if (existingId) {
    // update some fields
    await pool.query(
      `UPDATE Game SET game_image = COALESCE(?, game_image), release_date = COALESCE(?, release_date), developer = COALESCE(?, developer), price = COALESCE(?, price), description = COALESCE(?, description) WHERE game_id = ?`,
      [image, release_date, developer, price, description, existingId]
    );
    return existingId;
  }

  const [res] = await pool.query(
    `INSERT INTO Game (game_title, game_image, release_date, developer, price, description) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, image, release_date, developer, price, description]
  );
  return res.insertId;
}

async function fetchAppDetails(appid) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`;
  const resp = await axios.get(url, { timeout: 8000 });
  const obj = resp.data && resp.data[appid];
  if (!obj || !obj.success) return null;
  return obj.data;
}

async function processApp(appid) {
  try {
    console.log('Fetching', appid);
    const data = await fetchAppDetails(appid);
    if (!data) {
      console.warn('No data for', appid);
      return { appid, ok: false };
    }

    const title = data.name || `App ${appid}`;
    const image = data.header_image || null;
    // Try to parse release date
    const rel = data.release_date && data.release_date.date ? toDateString(data.release_date.date) : null;
    const developer = Array.isArray(data.developers) ? data.developers.join(', ') : (data.developer || null);
    // Default price to 0 if Steam doesn't provide price_overview (e.g., free titles)
    let price = 0;
    if (data.price_overview && typeof data.price_overview.final === 'number') {
      price = data.price_overview.final; // keep raw value from Steam
    }
    const description = data.short_description || data.about_the_game || null;

    const gameId = await insertOrUpdateGame({ title, image, release_date: rel, developer, price, description });

    // collect genres
    const genres = (Array.isArray(data.genres) && data.genres.map(g => g.description || g) ) || [];
    // fallback to categories
    if (genres.length === 0 && Array.isArray(data.categories)) {
      for (const c of data.categories) genres.push(c.description || c.label || c);
    }

    for (const gname of genres) {
      if (!gname) continue;
      const gid = await ensureGenre(gname);
      await linkGameToGenre(gameId, gid);
    }

    console.log(`Stored game ${title} (id=${gameId}) with genres:`, genres.join(', '));
    return { appid, ok: true, gameId, title, genres };
  } catch (err) {
    console.error('Error processing', appid, err.stack || err.message || err);
    return { appid, ok: false, error: err.message };
  }
}

async function main() {
  console.log('Starting Steam fetch & insert for', APPIDS.length, 'apps');
  for (const id of APPIDS) {
    // small delay to be polite
    await new Promise(r => setTimeout(r, 400));
    await processApp(id);
  }
  console.log('Done.');
  process.exit(0);
}

// Execute main when run as a script (ESM-friendly)
main().catch(err => { console.error(err); process.exit(1); });
