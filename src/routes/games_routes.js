import express from "express";
import { getGame } from "../services/games_service.js";
import { getReviews } from "../services/reviews_service.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const game = await getGame(req.params.id);
    const reviews = await getReviews(req.params.id);
    res.render("game_detail.ejs", { game, reviews, user: req.user || null });
  } catch (err) {
    res.status(500).send("서버 에러");
  }
});

export default router;
