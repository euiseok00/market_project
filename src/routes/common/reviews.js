import express from 'express';
import pool from '../../db/pool.js';

const router = express.Router();

// POST /reviews/:id/report - report a review
router.post('/:id/report', async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('로그인 필요');
  const reviewId = req.params.id;
  const reporterId = req.session.user.user_id;
  const { detail = '', reason = '기타' } = req.body;
  try {
    await pool.query(
      'INSERT INTO Report (review_id, reporter_id, detail, reason) VALUES (?, ?, ?, ?)',
      [reviewId, reporterId, detail, reason]
    );
    // increment report_count on Review if column exists
    try {
      await pool.query('UPDATE Review SET report_count = IFNULL(report_count,0) + 1 WHERE review_id = ?', [reviewId]);
    } catch (e) {
      // ignore
    }
    res.redirect('back');
  } catch (err) {
    console.error('Failed to submit report', err.message || err);
    // For compatibility, don't fail hard if Report table missing
    res.status(200).send('신고 접수(테스트 모드)');
  }
});

// GET /reviews/new?game_id= - render new review form
router.get('/new', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/auth/login');
  // admins should not be able to write reviews
  if (req.session.user && req.session.user.role === 'admin') return res.status(403).send('관리자는 리뷰를 작성할 수 없습니다.');
  const gameId = req.query.game_id;
  res.render('common/review_new', { gameId, user: req.session.user });
});

// POST /reviews - create a new review
router.post('/', async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).send('로그인 필요');
  const userId = req.session.user.user_id;
  // prevent admins from posting reviews
  if (req.session.user && req.session.user.role === 'admin') return res.status(403).send('관리자는 리뷰를 작성할 수 없습니다.');

  const { game_id, comment } = req.body;
  if (!game_id) return res.status(400).send('game_id 필요');

  // expected rating fields
  const ratingFields = ['rating_graphic','rating_quality','rating_fun','rating_replay','rating_price','rating_first_impression','rating_access','rating_competitive'];
  const ratings = {};
  ratingFields.forEach(f => { if (typeof req.body[f] !== 'undefined' && req.body[f] !== '') ratings[f] = Number(req.body[f]); });
  try {
    // ensure the user actually purchased this game
    try {
      const [pRows] = await pool.query('SELECT 1 FROM Purchase WHERE user_id = ? AND game_id = ? LIMIT 1', [userId, game_id]);
      if (!pRows || pRows.length === 0) {
        const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
        if (isXhr) return res.status(403).json({ success: false, message: '구매한 사용자만 리뷰를 작성할 수 있습니다.' });
        return res.status(403).send('구매한 사용자만 리뷰를 작성할 수 있습니다.');
      }
    } catch (e) {
      // If Purchase table/query fails, log and deny to be safe
      console.error('Failed to verify purchase before creating review', e.message || e);
      return res.status(500).send('서버 에러');
    }

    // prevent duplicate reviews: one review per user per game
    try {
      const [exists] = await pool.query('SELECT 1 FROM Review WHERE user_id = ? AND game_id = ? LIMIT 1', [userId, game_id]);
      if (Array.isArray(exists) && exists.length > 0) {
        const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
        if (isXhr) return res.status(400).json({ success: false, message: '이미 이 게임에 대한 리뷰를 작성하셨습니다.' });
        return res.status(400).send('이미 이 게임에 대한 리뷰를 작성하셨습니다.');
      }
    } catch (e) {
      console.warn('Could not check existing review (proceeding to insert):', e && e.message ? e.message : e);
    }

    // determine which rating columns actually exist in Review table to avoid SQL errors
    let availableCols = new Set();
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM Review');
      if (cols && cols.length) cols.forEach(c => availableCols.add(c.Field));
    } catch (e) {
      // if SHOW COLUMNS fails, proceed conservatively (only required fields)
      console.warn('Could not fetch Review columns, proceeding with basic fields only');
    }

    const fields = ['user_id', 'game_id', 'comment'];
    const params = [userId, game_id, comment || ''];

    // add only rating columns that exist in the table
    Object.keys(ratings).forEach(k => {
      if (availableCols.size === 0 || availableCols.has(k)) {
        fields.push(k);
        params.push(ratings[k]);
      }
    });

    const placeholders = fields.map(_ => '?').join(', ');
    const sql = `INSERT INTO Review (${fields.join(',')}) VALUES (${placeholders})`;
    await pool.query(sql, params);
  const isXhr = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');
  if (isXhr) return res.json({ success: true, message: '리뷰 작성 완료' });
  res.redirect(`/games/${game_id}`);
  } catch (err) {
    console.error('Failed to create review', err.message || err);
    res.status(500).send('서버 에러');
  }
});

export default router;
