import express from 'express';
import pool from '../../db/pool.js';
import requireAdmin from '../../middleware/requireAdmin.js';

const router = express.Router();

// GET /admin/games/:id/edit - render edit form
router.get('/:id/edit', requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM Game WHERE game_id = ?', [id]);
    const game = rows[0];
    if (!game) return res.status(404).send('게임을 찾을 수 없습니다.');
    res.render('admin/game_edit', { game, user: req.user });
  } catch (err) {
    console.error('Failed to load game for edit', err);
    res.status(500).send('서버 에러');
  }
});

// POST /admin/games/:id/edit - process edit
router.post('/:id/edit', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { game_title, description, price, game_image, developer, release_date } = req.body;
  // basic validation
  if (!game_title) return res.status(400).send('제목은 필수입니다.');
  const priceNum = price ? Number(price) : 0;
  if (price && Number.isNaN(priceNum)) return res.status(400).send('가격은 숫자여야 합니다.');

  try {
    await pool.query(
      `UPDATE Game SET game_title = ?, description = ?, price = ?, game_image = ?, developer = ?, release_date = ? WHERE game_id = ?`,
      [game_title, description || null, priceNum, game_image || null, developer || null, release_date || null, id]
    );
    // Redirect to admin view of the game's detail
    res.redirect(`/games/${id}`);
  } catch (err) {
    console.error('Failed to update game', err);
    res.status(500).send('서버 에러');
  }
});

export default router;
