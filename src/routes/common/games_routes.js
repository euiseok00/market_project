import express from "express";
import { getGame } from "../../services/games_service.js";
import { getReviews } from "../../services/reviews_service.js";
import pool from "../../db/pool.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const game = await getGame(req.params.id);
    if (!game) {
      return res.status(404).send("게임을 찾을 수 없습니다.");
    }
    
    const reviews = await getReviews(req.params.id);

    // determine if current user has purchased this game (for enabling review button)
    let purchased = false;
    try {
      if (req.session && req.session.user) {
        const userId = req.session.user.user_id;
        const [rows] = await pool.query('SELECT 1 AS exists_flag FROM Purchase WHERE user_id = ? AND game_id = ? LIMIT 1', [userId, req.params.id]);
        if (Array.isArray(rows) && rows.length > 0) purchased = true;
      }
    } catch (e) {
      // ignore DB errors here; leave purchased=false
      console.warn('Could not determine purchase status:', e && e.message ? e.message : e);
    }

    res.render("common/game_detail", { game, reviews, user: req.user || null, purchased });
  } catch (err) {
    res.status(500).send("서버 에러");
  }
});

export default router;
