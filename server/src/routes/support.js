const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

// Users can create and view their own support tickets; only administrators can reply via admin-control.
router.post('/tickets', auth, async (req, res, next) => {
  try {
    const subject = String(req.body?.subject || '').trim().slice(0, 160);
    const message = String(req.body?.message || '').trim().slice(0, 5000);
    const category = String(req.body?.category || 'general');
    if (subject.length < 4 || message.length < 10) return res.status(400).json({ error: 'Subject must be at least 4 characters and message at least 10 characters.' });
    if (!['general','payment','points','purchase','creator','content','account','other'].includes(category)) return res.status(400).json({ error: 'Invalid complaint category.' });
    const { rows } = await db.query('INSERT INTO support_tickets(user_id,subject,message,category) VALUES($1,$2,$3,$4) RETURNING id,subject,message,category,status,created_at', [req.user.id,subject,message,category]);
    res.status(201).json({ ticket: rows[0], message: 'Your complaint was sent to EditVault support.' });
  } catch (error) { next(error); }
});
router.get('/tickets', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id,subject,message,category,status,admin_response,created_at,updated_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json({ tickets: rows });
  } catch (error) { next(error); }
});
module.exports = router;
