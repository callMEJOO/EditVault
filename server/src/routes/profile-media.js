const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const PROFILE_FIELDS = `
  id, email, display_name, username, role, avatar_data_url, tiktok_url,
  tiktok_followers, tiktok_followers_updated_at, verification_status, verification_note
`;

function isValidJpegDataUrl(value) {
  if (typeof value !== 'string' || value.length > 350000) return false;
  const match = value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.length > 0 && bytes.length <= 260 * 1024 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// Authenticated profile payload used by the navbar and Profile Settings.
router.get('/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

// Profile photos are resized to small JPEG data URLs in the browser before upload.
// This avoids exposing credentials or adding a separate static-file bucket for avatars.
router.post('/avatar', auth, async (req, res, next) => {
  try {
    const value = req.body?.avatarDataUrl;
    if (value !== null && value !== '' && !isValidJpegDataUrl(value)) {
      return res.status(400).json({ error: 'Choose a valid JPG, PNG, or WebP photo smaller than 260 KB after compression.' });
    }
    const avatar = value === null || value === '' ? null : value;
    const { rows } = await db.query(
      `UPDATE users SET avatar_data_url = $1 WHERE id = $2 RETURNING ${PROFILE_FIELDS}`,
      [avatar, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: rows[0], message: avatar ? 'Profile photo updated.' : 'Profile photo removed.' });
  } catch (error) { next(error); }
});

// Public subset used on verified creator pages. Never return email or other private fields.
router.get('/creator/:creatorId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, display_name, username, avatar_data_url, role, verification_status
       FROM users WHERE id = $1 AND verification_status = 'verified'`,
      [req.params.creatorId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Verified creator not found.' });
    res.set('Cache-Control', 'public, max-age=120');
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
