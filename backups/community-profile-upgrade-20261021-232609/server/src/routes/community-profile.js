const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const PROFILE_PUBLIC_FIELDS = `
  id, username, display_name, bio, cover_data_url, avatar_data_url,
  role, verification_status, created_at
`;

function validUsername(value) {
  return typeof value === 'string' && /^[a-z0-9_]{3,24}$/.test(value);
}

function validCover(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || value.length > 950000) return false;
  const match = value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.length > 0 && bytes.length <= 700 * 1024 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

router.get('/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ${PROFILE_PUBLIC_FIELDS}, email, profile_visibility
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

router.put('/me', auth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    const visibility = body.profileVisibility;
    const cover = body.coverDataUrl;
    if (!validUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3–24 characters and use only lowercase letters, numbers, or underscores.' });
    }
    if (bio.length > 300) return res.status(400).json({ error: 'Bio must be 300 characters or fewer.' });
    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Choose public or private profile visibility.' });
    }
    if (cover !== undefined && !validCover(cover)) {
      return res.status(400).json({ error: 'Cover must be a compressed JPEG image smaller than 700 KB.' });
    }
    const { rows } = await db.query(
      `UPDATE users
       SET username = $1, bio = $2, profile_visibility = $3,
           cover_data_url = CASE WHEN $4::boolean THEN $5 ELSE cover_data_url END
       WHERE id = $6
       RETURNING id, username, display_name, bio, cover_data_url, avatar_data_url,
                 role, verification_status, profile_visibility, created_at`,
      [username, bio, visibility, cover !== undefined, cover === '' ? null : (cover ?? null), req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: rows[0], message: 'Community profile saved.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
    next(error);
  }
});

router.get('/u/:username', async (req, res, next) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    if (!validUsername(username)) return res.status(404).json({ error: 'Profile not found.' });
    const { rows } = await db.query(
      `SELECT ${PROFILE_PUBLIC_FIELDS}
       FROM users
       WHERE lower(username) = $1 AND profile_visibility = 'public'`,
      [username]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found or private.' });
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
