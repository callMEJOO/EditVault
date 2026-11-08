const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function creatorApplicationTikTokUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Enter your TikTok profile URL.');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid TikTok profile URL.'); }
  if (!['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(parsed.hostname.toLowerCase()) || !parsed.pathname.startsWith('/@')) {
    throw new Error('Use a public TikTok profile URL such as https://www.tiktok.com/@username.');
  }
  return parsed.toString();
}

function creatorApplicationOptionalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.length > 1200) throw new Error('Portfolio URL cannot exceed 1,200 characters.');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid portfolio URL.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Portfolio URL must use HTTP or HTTPS.');
  return parsed.toString();
}

router.get('/applications/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, user_id, tiktok_url, portfolio_url, message, status, admin_note, created_at, updated_at
       FROM creator_applications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 10`, [req.user.id]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ application: rows[0] || null, applications: rows });
  } catch (error) { next(error); }
});

router.post('/applications', auth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '');
    if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
    const { rows: userRows } = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (!userRows[0]) return res.status(404).json({ error: 'Account not found.' });
    if (userRows[0].role === 'admin') return res.status(403).json({ error: 'Administrator accounts do not need creator applications.' });
    if (userRows[0].role === 'creator') return res.status(409).json({ error: 'Creator access is already approved.' });
    let tiktokUrl; let portfolioUrl;
    try {
      tiktokUrl = creatorApplicationTikTokUrl(req.body?.tiktokUrl);
      portfolioUrl = creatorApplicationOptionalUrl(req.body?.portfolioUrl);
    } catch (error) { return res.status(400).json({ error: error.message }); }
    const message = String(req.body?.message || '').trim().slice(0, 1000);
    const { rows: pendingRows } = await db.query(
      `SELECT id FROM creator_applications WHERE user_id = $1 AND status = 'pending' LIMIT 1`, [userId]
    );
    if (pendingRows[0]) return res.status(409).json({ error: 'Your creator application is already waiting for review.' });
    const { rows } = await db.query(
      `INSERT INTO creator_applications (user_id, tiktok_url, portfolio_url, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, tiktok_url, portfolio_url, message, status, admin_note, created_at, updated_at`,
      [userId, tiktokUrl, portfolioUrl, message]
    );
    res.status(201).json({ application: rows[0], message: 'Creator application sent to the administrator. Your profile settings were not changed.' });
  } catch (error) {
    if (error?.code === '23505' && String(error.constraint || '').includes('creator_applications_one_pending')) {
      return res.status(409).json({ error: 'Your creator application is already waiting for review.' });
    }
    next(error);
  }
});

router.get('/applications/queue', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.user_id, a.tiktok_url, a.portfolio_url, a.message, a.status, a.admin_note,
              a.created_at, u.display_name, u.email
       FROM creator_applications a JOIN users u ON u.id = a.user_id
       WHERE a.status = 'pending' ORDER BY a.created_at ASC LIMIT 300`
    );
    res.set('Cache-Control', 'no-store');
    res.json({ requests: rows });
  } catch (error) { next(error); }
});

router.post('/applications/:applicationId/review', auth, adminOnly, async (req, res, next) => {
  const applicationId = String(req.params.applicationId || '');
  const decision = String(req.body?.decision || '');
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  if (!UUID_RE.test(applicationId)) return res.status(400).json({ error: 'Invalid creator application id.' });
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be approved or rejected.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: applicationRows } = await client.query(
      `SELECT id, user_id, status FROM creator_applications WHERE id = $1 FOR UPDATE`, [applicationId]
    );
    const application = applicationRows[0];
    if (!application || application.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending creator application not found.' });
    }
    if (decision === 'approved') {
      const { rows: memberRows } = await client.query(
        `UPDATE users SET role = 'creator' WHERE id = $1 AND role <> 'admin'
         RETURNING id, display_name, email, role`, [application.user_id]
      );
      if (!memberRows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Applicant account was not found or cannot be changed.' });
      }
    }
    const { rows: updatedRows } = await client.query(
      `UPDATE creator_applications
       SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, status, admin_note, reviewed_at, updated_at`,
      [applicationId, decision, note, req.user.id]
    );
    await client.query('COMMIT');
    res.json({ application: updatedRows[0], message: decision === 'approved' ? 'Creator access approved.' : 'Creator application rejected.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    next(error);
  } finally { client.release(); }
});
// GET /api/creators/me - current user's creator verification profile.
router.get('/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, display_name, role, tiktok_url,
              verification_status, verification_note
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});
// Deprecated: creator applications now use the separate creator_applications table.
router.post('/verification-request', auth, (_req, res) => {
  res.status(410).json({ error: 'Creator applications have moved. Use POST /api/creators/applications.' });
});

router.get('/verification-queue', auth, adminOnly, (_req, res) => {
  res.status(410).json({ error: 'Creator applications have moved. Use GET /api/creators/applications/queue.' });
});

router.post('/verification/:userId/review', auth, adminOnly, (_req, res) => {
  res.status(410).json({ error: 'Creator applications have moved. Use POST /api/creators/applications/:applicationId/review.' });
});

router.get('/sales', auth, async (req, res, next) => {
  try { const { rows } = await db.query(`SELECT e.id,e.title,COUNT(p.id)::int AS sales,COALESCE(SUM(p.price_points),0)::int AS points_earned FROM edits e LEFT JOIN purchases p ON p.edit_id=e.id WHERE e.creator_id=$1 GROUP BY e.id ORDER BY sales DESC,e.created_at DESC`, [req.user.id]); res.json({ sales: rows }); }
  catch (e) { next(e); }
});
module.exports = router;
