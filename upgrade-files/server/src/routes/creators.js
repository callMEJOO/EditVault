'use strict';

const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTikTokUrl(value) {
  let parsed;
  try { parsed = new URL(String(value || '').trim()); }
  catch { throw new Error('Provide a valid TikTok profile URL.'); }
  if (!['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('Only TikTok profile URLs are accepted.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('TikTok profile URL must use HTTP or HTTPS.');
  }
  if (!/^\/@[A-Za-z0-9._]+\/?$/.test(parsed.pathname)) {
    throw new Error('Use your TikTok profile URL, not a video link.');
  }
  return parsed.toString();
}

// Creator access applications are separate from public profile settings.
router.get('/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, display_name, role, tiktok_url,
              verification_status, verification_note
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

async function submitApplication(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Please sign in again.' });

    let tiktokUrl;
    try { tiktokUrl = parseTikTokUrl(req.body?.tiktokUrl); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    const applicantNote = String(req.body?.applicantNote || '').trim().slice(0, 700);
    const { rows: userRows } = await db.query(
      'SELECT id, role, verification_status FROM users WHERE id = $1', [userId]
    );
    const account = userRows[0];
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    if (account.role === 'admin' || (account.role === 'creator' && account.verification_status === 'verified')) {
      return res.status(409).json({ error: 'Creator access is already active for this account.' });
    }

    const { rows: pendingRows } = await db.query(
      `SELECT id, user_id, tiktok_url, applicant_note, status, admin_note, created_at
       FROM creator_applications WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (pendingRows[0]) {
      return res.status(409).json({
        error: 'Your creator application is already waiting for review.',
        application: pendingRows[0],
      });
    }

    const { rows } = await db.query(
      `INSERT INTO creator_applications (user_id, tiktok_url, applicant_note, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, user_id, tiktok_url, applicant_note, status, admin_note, created_at`,
      [userId, tiktokUrl, applicantNote]
    );
    res.status(201).json({
      application: rows[0],
      message: 'Creator application sent to the administrator for review.',
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A pending creator application already exists.' });
    next(error);
  }
}

router.post('/apply', auth, submitApplication);
// Compatibility alias for old clients; this no longer edits public profile settings.
router.post('/verification-request', auth, submitApplication);

router.get('/applications/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, user_id, tiktok_url, applicant_note, status, admin_note, created_at, reviewed_at
       FROM creator_applications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ application: rows[0] || null });
  } catch (error) { next(error); }
});

router.get('/verification-queue', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.user_id, a.tiktok_url, a.applicant_note, a.status, a.created_at,
              u.email, u.display_name
       FROM creator_applications a
       JOIN users u ON u.id = a.user_id
       WHERE a.status = 'pending' AND u.role <> 'admin'
       ORDER BY a.created_at ASC LIMIT 300`
    );
    res.set('Cache-Control', 'no-store');
    res.json({ requests: rows });
  } catch (error) { next(error); }
});

// Application ID is used here, not a user ID. Only admins can approve or reject.
router.post('/verification/:applicationId/review', auth, adminOnly, async (req, res, next) => {
  const applicationId = String(req.params.applicationId || '');
  const { decision, note = '' } = req.body || {};
  if (!UUID_RE.test(applicationId)) return res.status(400).json({ error: 'Invalid creator application id.' });
  if (!['verified', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be verified or rejected.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: found } = await client.query(
      `SELECT a.id, a.user_id, a.status, u.role AS user_role
       FROM creator_applications a JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 FOR UPDATE OF a, u`,
      [applicationId]
    );
    const application = found[0];
    if (!application || application.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending creator application not found.' });
    }
    if (application.user_role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Administrator accounts cannot apply for creator access.' });
    }

    const nextStatus = decision === 'verified' ? 'approved' : 'rejected';
    const safeNote = String(note || '').trim().slice(0, 1000);
    const { rows: updated } = await client.query(
      `UPDATE creator_applications
       SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, tiktok_url, applicant_note, status, admin_note, created_at, reviewed_at`,
      [applicationId, nextStatus, safeNote || null, req.user.id]
    );

    let user = null;
    if (decision === 'verified') {
      const { rows: userRows } = await client.query(
        `UPDATE users SET role = 'creator', verification_status = 'verified'
         WHERE id = $1 AND role <> 'admin'
         RETURNING id, display_name, email, role, verification_status`,
        [application.user_id]
      );
      user = userRows[0] || null;
    }
    await client.query('COMMIT');
    res.json({
      application: updated[0],
      user,
      message: decision === 'verified' ? 'Creator application approved.' : 'Creator application declined.',
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    next(error);
  } finally { client.release(); }
});

router.get('/sales', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.title, COUNT(p.id)::int AS sales,
              COALESCE(SUM(p.price_points), 0)::int AS points_earned
       FROM edits e LEFT JOIN purchases p ON p.edit_id = e.id
       WHERE e.creator_id = $1 GROUP BY e.id ORDER BY sales DESC, e.created_at DESC`,
      [req.user.id]
    );
    res.json({ sales: rows });
  } catch (error) { next(error); }
});

module.exports = router;
