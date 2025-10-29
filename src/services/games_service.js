import pool from "../db/pool.js";

// games_service_js
export async function getGame(gameId) {
  const [rows] = await pool.query(
    `
      SELECT g.*, GROUP_CONCAT(DISTINCT gr.genre_name SEPARATOR ', ') AS genre
      FROM Game g
      LEFT JOIN GameGenre gg ON gg.game_id = g.game_id
      LEFT JOIN Genre gr ON gr.genre_id = gg.genre_id
      WHERE g.game_id = ?
      GROUP BY g.game_id
      LIMIT 1
    `,
    [gameId]
  );
  return (rows && rows[0]) ? { ...rows[0], genre: rows[0].genre || null } : null;
}

export async function getAllGames(limit = 100) {
  // Game table doesn't store a single `genre` column; genres are many-to-many
  // Use GROUP_CONCAT to aggregate genres per game and alias to `genre` for templates
  const [rows] = await pool.query(
    `
      SELECT g.game_id, g.game_title, g.game_image, g.price,
             GROUP_CONCAT(DISTINCT gr.genre_name SEPARATOR ', ') AS genre
      FROM Game g
      LEFT JOIN GameGenre gg ON gg.game_id = g.game_id
      LEFT JOIN Genre gr ON gr.genre_id = gg.genre_id
      GROUP BY g.game_id
      ORDER BY g.game_id DESC
      LIMIT ?
    `,
    [limit]
  );
  return rows.map(r => ({ ...r, genre: r.genre || null }));
}
