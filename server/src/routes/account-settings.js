const router = require('express').Router();
const bcrypt = require('bcrypt');
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.patch('/email', auth, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const currentPassword = String(req.body?.currentPassword || '');
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!currentPassword) return res.status(400).json({ error: 'Enter your current password to confirm this change.' });
    const { rows: accountRows } = await db.query('SELECT id, email, password_hash, display_name, role, verification_status FROM users WHERE id=$1', [req.user.id]);
    const account = accountRows[0];
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    if (!(await bcrypt.compare(currentPassword, account.password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
    const { rows: duplicateRows } = await db.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND id<>$2 LIMIT 1', [email, req.user.id]);
    if (duplicateRows[0]) return res.status(409).json({ error: 'That email address is already in use.' });
    try {
      const { rows } = await db.query('UPDATE users SET email=$1 WHERE id=$2 RETURNING id,email,display_name,role,verification_status', [email, req.user.id]);
      return res.json({ user: rows[0], message: 'Email address updated.' });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That email address is already in use.' });
      throw error;
    }
  } catch (error) { next(error); }
});

router.patch('/password', auth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword) return res.status(400).json({ error: 'Enter your current password.' });
    if (newPassword.length < 8 || newPassword.length > 200 || Buffer.byteLength(newPassword, 'utf8') > 72) return res.status(400).json({ error: 'New password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'Choose a different password from your current one.' });
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, req.user.id]);
    res.json({ message: 'Password changed successfully. For your security, review active sessions on other devices.' });
  } catch (error) { next(error); }
});

module.exports = router;
