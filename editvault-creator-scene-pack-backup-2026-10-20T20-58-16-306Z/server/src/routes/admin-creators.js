const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth, adminOnly);

// Lists regular members and creator accounts; never returns password hashes or private profile photos.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, display_name, role, verification_status,
              verification_note, tiktok_url, created_at
       FROM users
       WHERE role <> 'admin'
       ORDER BY CASE WHEN role = 'creator' AND verification_status = 'verified' THEN 0
                     WHEN verification_status = 'pending' THEN 1 ELSE 2 END,
                created_at DESC
       LIMIT 300`
    );
    res.json({ users: rows });
  } catch (error) { next(error); }
});

// Admin can activate an already registered account by email. This does not create a fake account.
router.post('/activate', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address for an existing member.' });
    }
    const { rows } = await db.query(
      `UPDATE users
       SET role = 'creator', verification_status = 'verified',
           verification_note = 'Creator access granted directly by an administrator.'
       WHERE LOWER(email) = $1 AND role <> 'admin'
       RETURNING id, email, display_name, role, verification_status, verification_note, tiktok_url, created_at`,
      [email]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No non-admin account exists with that email.' });
    res.json({ user: rows[0], message: 'Creator access activated by administrator.' });
  } catch (error) { next(error); }
});

// Remove or restore creator privileges; the account and purchase records remain intact.
router.patch('/:userId', async (req, res, next) => {
  try {
    const userId = String(req.params.userId || '');
    const active = req.body?.active;
    if (typeof active !== 'boolean') return res.status(400).json({ error: 'active must be true or false.' });
    if (userId === String(req.user.id)) return res.status(403).json({ error: 'You cannot change your own administrator access.' });

    const sql = active
      ? `UPDATE users SET role = 'creator', verification_status = 'verified',
           verification_note = 'Creator access granted by administrator.'
         WHERE id = $1 AND role <> 'admin'
         RETURNING id, email, display_name, role, verification_status, verification_note, tiktok_url, created_at`
      : `UPDATE users SET role = 'user', verification_status = 'rejected',
           verification_note = 'Creator access removed by administrator.'
         WHERE id = $1 AND role <> 'admin'
         RETURNING id, email, display_name, role, verification_status, verification_note, tiktok_url, created_at`;
    const { rows } = await db.query(sql, [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Member not found or administrator accounts cannot be changed here.' });
    res.json({ user: rows[0], message: active ? 'Creator access activated.' : 'Creator access removed.' });
  } catch (error) { next(error); }
});

module.exports = router;
