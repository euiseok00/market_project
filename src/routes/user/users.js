import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../../db/pool.js';

const router = express.Router();

// GET /users/my_page - render user's my page (requires login)
router.get('/my_page', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  try {
    const userId = req.session.user.user_id;
    const [rows] = await pool.query('SELECT id FROM User WHERE user_id = ?', [userId]);
    const userRow = rows[0] || {};
    res.render('users/my_page', { user: { id: userRow.id || req.session.user.id } });
  } catch (err) {
    console.error('Failed to load my_page', err);
    res.status(500).send('서버 에러');
  }
});

// GET /users/wishlist - show user's wishlist
router.get('/wishlist', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  const userId = req.session.user.user_id;
  try {
    // Attempt to join Wish -> Game and aggregate genres; if Wish table missing, fall back to empty
    const [rows] = await pool.query(
      `SELECT g.game_id, g.game_title, g.game_image, g.price,
              GROUP_CONCAT(DISTINCT gr.genre_name SEPARATOR ', ') AS genre
       FROM Wish w
       JOIN Game g ON w.game_id = g.game_id
       LEFT JOIN GameGenre gg ON gg.game_id = g.game_id
       LEFT JOIN Genre gr ON gr.genre_id = gg.genre_id
       WHERE w.user_id = ?
       GROUP BY g.game_id
       ORDER BY w.created_at DESC`,
      [userId]
    );
    res.render('users/wishlist', { items: rows });
  } catch (err) {
    console.warn('Could not load wishlist (maybe table missing):', err.message || err);
    res.render('users/wishlist', { items: [] });
  }
});

// GET /users/reviews - show reviews written by current user
router.get('/reviews', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  const userId = req.session.user.user_id;
  try {
    const [rows] = await pool.query(
      `SELECT r.*, g.game_title, g.game_id
       FROM Review r
       JOIN Game g ON r.game_id = g.game_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );
    res.render('users/reviews', { reviews: rows, user: req.session.user });
  } catch (err) {
    console.error('Failed to load user reviews', err);
    res.render('users/reviews', { reviews: [], user: req.session.user });
  }
});

// POST /users/reviews/:id/delete - delete a review belonging to current user
router.post('/reviews/:id/delete', async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('로그인 필요');
  const userId = req.session.user.user_id;
  const reviewId = req.params.id;
  if (!reviewId) return res.status(400).send('review id 필요');
  try {
    // verify ownership
    const [rows] = await pool.query('SELECT user_id, game_id FROM Review WHERE review_id = ? LIMIT 1', [reviewId]);
    if (!rows || rows.length === 0) return res.status(404).send('리뷰를 찾을 수 없습니다.');
    const owner = rows[0];
    if (owner.user_id !== userId) {
      const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
      if (isXhr) return res.status(403).json({ success: false, message: '자신의 리뷰만 삭제할 수 있습니다.' });
      return res.status(403).send('자신의 리뷰만 삭제할 수 있습니다.');
    }

    // delete the review
    await pool.query('DELETE FROM Review WHERE review_id = ? AND user_id = ?', [reviewId, userId]);
    const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
    if (isXhr) return res.json({ success: true, message: '리뷰가 삭제되었습니다', game_id: owner.game_id });
    return res.redirect('/users/reviews');
  } catch (err) {
    console.error('Failed to delete review', err);
    return res.status(500).send('서버 에러');
  }
});

// GET /users/purchased - show user's purchases
router.get('/purchased', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  const userId = req.session.user.user_id;
  try {
    // determine which price column exists in Purchase table
    const [cols] = await pool.query('SHOW COLUMNS FROM Purchase');
    const colNames = Array.isArray(cols) ? cols.map(c => c.Field) : [];
    const priceCandidates = ['price_at_purchase', 'price', 'price_paid', 'amount'];
    const priceCol = priceCandidates.find(c => colNames.includes(c));

    const priceSelect = priceCol ? `p.${priceCol} AS price` : 'NULL AS price';

    const sql = `SELECT g.game_id, g.game_title, g.game_image,
    GROUP_CONCAT(DISTINCT gr.genre_name SEPARATOR ', ') AS genre,
    p.purchased_at AS purchased_at, ${priceSelect}
  FROM Purchase p
  JOIN Game g ON p.game_id = g.game_id
  LEFT JOIN GameGenre gg ON gg.game_id = g.game_id
  LEFT JOIN Genre gr ON gr.genre_id = gg.genre_id
  WHERE p.user_id = ?
  GROUP BY g.game_id, p.purchased_at
  ORDER BY p.purchased_at DESC`;

    const [rows] = await pool.query(sql, [userId]);
    res.render('users/purchased', { items: rows });
  } catch (err) {
    console.warn('Could not load purchases (maybe table missing):', err.message || err);
    res.render('users/purchased', { items: [] });
  }
});

// GET /users/check-id?id=someid -> JSON { available: true/false }
router.get('/check-id', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ available: false, message: 'id required' });
  try {
    const [rows] = await pool.query('SELECT user_id FROM User WHERE id = ?', [id]);
    if (rows.length > 0) return res.json({ available: false, message: '이미 사용중인 아이디입니다.' });
    return res.json({ available: true, message: '사용 가능한 아이디입니다.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ available: false, message: '서버 에러' });
  }
});

// POST /users/wishlist/add - add to wishlist and redirect to wishlist page
router.post('/wishlist/add', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  const userId = req.session.user.user_id;
  const { game_id } = req.body;
  if (!game_id) return res.status(400).send('game_id 필요');
  try {
  // avoid duplicate - Wish uses composite PK (user_id, game_id), so check presence differently
  const [exists] = await pool.query('SELECT 1 AS exists_flag FROM Wish WHERE user_id = ? AND game_id = ? LIMIT 1', [userId, game_id]);
    if (Array.isArray(exists) && exists.length > 0) {
      const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
      if (isXhr) return res.json({ success: false, message: '이미 관심목록에 있습니다' });
      return res.redirect('/users/wishlist');
    }
    await pool.query('INSERT INTO Wish (user_id, game_id, created_at) VALUES (?, ?, NOW())', [userId, game_id]);
    const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
    if (isXhr) return res.json({ success: true, message: '관심목록에 추가되었습니다' });
    return res.redirect('/users/wishlist');
  } catch (err) {
    console.error('Failed to add wishlist', err);
    // if Wish table missing, still redirect to wishlist page with empty state
    const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
    if (isXhr) return res.status(500).json({ success: false, message: '서버 에러' });
    return res.redirect('/users/wishlist');
  }
});

// POST /users/wishlist/remove - remove from wishlist
router.post('/wishlist/remove', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  const userId = req.session.user.user_id;
  const { game_id } = req.body;
  if (!game_id) return res.status(400).send('game_id 필요');
  try {
    await pool.query('DELETE FROM Wish WHERE user_id = ? AND game_id = ?', [userId, game_id]);
    const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
    if (isXhr) return res.json({ success: true, message: '관심목록에서 삭제되었습니다' });
    return res.redirect('/users/wishlist');
  } catch (err) {
    console.error('Failed to remove wishlist', err);
    return res.redirect('/users/wishlist');
  }
});

// POST /purchase - create a purchase record for logged-in user
router.post('/purchase', async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('로그인 필요');
  const userId = req.session.user.user_id;
  if (!req.body) return res.status(400).send('요청 본문이 없습니다');
  const { game_id } = req.body;
  if (!game_id) return res.status(400).send('game_id 필요');

  try {
    // fetch current price from Game
    const [grows] = await pool.query('SELECT price FROM Game WHERE game_id = ?', [game_id]);
    if (!grows || grows.length === 0) return res.status(404).send('게임을 찾을 수 없습니다.');
    const price = grows[0].price == null ? 0 : Number(grows[0].price);

    // Prevent duplicate purchases
    try {
      const [existing] = await pool.query('SELECT 1 AS exists_flag FROM Purchase WHERE user_id = ? AND game_id = ? LIMIT 1', [userId, game_id]);
      if (Array.isArray(existing) && existing.length > 0) {
        const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
        if (isXhr) return res.status(400).json({ success: false, message: '이미 구매한 게임입니다' });
        return res.redirect('/users/purchased');
      }
    } catch (e) {
      // if Purchase table missing or query fails, proceed to insert and let DB handle errors
      console.warn('Could not check existing purchases:', e && e.message ? e.message : e);
    }

    // Simple insert: record user_id, game_id and purchased_at
    // (assumes Purchase table has `purchased_at` column)
    await pool.query('INSERT INTO Purchase (user_id, game_id, purchased_at) VALUES (?, ?, NOW())', [userId, game_id]);

    // If this was an XHR/fetch request, return JSON so client can show a popup
    const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
    if (isXhr) {
      return res.json({ success: true, message: '구매완료했습니다' });
    }
    // otherwise redirect to purchases page
    res.redirect('/users/purchased');
  } catch (err) {
    console.error('Failed to create purchase', err);
    res.status(500).send('서버 에러');
  }
});

// POST /users/sign_up - register new user
router.post('/sign_up', async (req, res) => {
  const { id, password, password_confirm } = req.body;
  if (!id || !password || !password_confirm) return res.status(400).render('common/sign_in', { error: '모든 필드를 입력해주세요.' });
  if (password !== password_confirm) return res.status(400).render('common/sign_in', { error: '비밀번호가 일치하지 않습니다.' });

  try {
    // check duplicate id
    const [rows] = await pool.query('SELECT user_id FROM User WHERE id = ?', [id]);
    if (rows.length > 0) return res.status(400).render('common/sign_in', { error: '이미 사용중인 아이디입니다.' });

  // hash password and insert
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO User (id, password, role) VALUES (?, ?, ?)', [id, hash, 'user']);

  // After successful signup redirect back to login page (user will login manually)
  return res.redirect('/auth/login?signup=success');
  } catch (err) {
    console.error(err);
    return res.status(500).render('common/sign_in', { error: '서버 에러, 잠시후 다시 시도하세요.' });
  }
});

export default router;

