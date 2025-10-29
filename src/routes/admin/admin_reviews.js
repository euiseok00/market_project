import express from 'express';
import pool from '../../db/pool.js';
import requireAdmin from '../../middleware/requireAdmin.js';

const router = express.Router();

// Admin: hide a review
router.post('/:id/hide', requireAdmin, async (req, res) => {
    const reviewId = req.params.id;
    try {
        await pool.query('UPDATE Review SET is_hidden = TRUE WHERE review_id = ?', [reviewId]);
        res.redirect('back');
    } catch (err) {
        console.error('Failed to hide review', err);
        res.status(500).send('서버 에러');
    }
});

// Admin: show (unhide) a review
router.post('/:id/show', requireAdmin, async (req, res) => {
    const reviewId = req.params.id;
    try {
        await pool.query('UPDATE Review SET is_hidden = FALSE WHERE review_id = ?', [reviewId]);
        res.redirect('back');
    } catch (err) {
        console.error('Failed to show review', err);
        res.status(500).send('서버 에러');
    }
});

export default router;
