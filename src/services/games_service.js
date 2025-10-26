import pool from "../db/pool.js";

// games_service_js
export async function getGame(gameId) {
  const [[game]] = await pool.query("SELECT * FROM Game WHERE game_id = ?", [gameId]);
  return game;
}
