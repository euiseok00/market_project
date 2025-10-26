import pool from "../db/pool.js";

export async function getReviews(gameId) {
  const [reviews] = await pool.query(
    `SELECT r.*, u.id
     FROM Review r
     JOIN User u ON r.user_id = u.user_id
     WHERE r.game_id = ? AND r.is_hidden = FALSE
     ORDER BY r.created_at DESC`,
    [gameId]
  );
  return reviews;
}