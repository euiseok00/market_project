import express from 'express';
import pool from '../../db/pool.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// GET /auth/login - show login page
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    // redirect based on role
    if (req.session.user.role === 'admin') return res.redirect('/admin/game_list');
    return res.redirect('/users/game_list');
  }
  // render common/login.ejs
  res.render('common/login', { error: null, id: '' });
});

// POST /auth/login - perform login
router.post('/login', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) return res.status(400).send('Missing credentials');

  try {
    const [rows] = await pool.query('SELECT user_id, id, password, role FROM User WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) return res.status(401).render('common/login', { error: '아이디 또는 비밀번호가 일치하지 않습니다.', id });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).render('common/login', { error: '아이디 또는 비밀번호가 일치하지 않습니다.', id });

  req.session.user = { user_id: user.user_id, role: user.role, id: user.id };
  // redirect to admin page if admin
  if (user.role === 'admin') return res.redirect('/admin/game_list');
  return res.redirect('/users/game_list');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

// GET /auth/logout - destroy session
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Session destroy error', err);
      }
      res.redirect('/auth/login');
    });
  } else {
    res.redirect('/auth/login');
  }
});

export default router;
