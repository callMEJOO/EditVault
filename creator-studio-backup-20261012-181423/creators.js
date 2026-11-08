const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');
router.post('/verification-request', auth, async (req, res, next) => {
  try {
    const { tiktokUrl } = req.body || {};
    let parsed; try { parsed = new URL(tiktokUrl); } catch { return res.status(400).json({ error: 'Provide a valid TikTok profile URL' }); }
    if (!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(parsed.hostname)) return res.status(400).json({ error: 'Only TikTok profile URLs are accepted' });
    const { rows } = await db.query("UPDATE users SET tiktok_url=$1,verification_status='pending',verification_note=NULL WHERE id=$2 RETURNING id,display_name,tiktok_url,verification_status", [parsed.toString(),req.user.id]);
    res.json({ user: rows[0], message: 'Verification request submitted for manual review' });
  } catch (e) { next(e); }
});
router.get('/verification-queue', auth, adminOnly, async (_req, res, next) => {
  try { const { rows } = await db.query("SELECT id,email,display_name,tiktok_url,verification_status,created_at FROM users WHERE verification_status='pending' ORDER BY created_at ASC"); res.json({ requests: rows }); }
  catch (e) { next(e); }
});
router.post('/verification/:userId/review', auth, adminOnly, async (req, res, next) => {
  try {
    const { decision, note = '' } = req.body || {};
    if (!['verified','rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be verified or rejected' });
    const { rows } = await db.query("UPDATE users SET verification_status=$1,verification_note=$2,role=CASE WHEN $1='verified' AND role='user' THEN 'creator' ELSE role END WHERE id=$3 AND verification_status='pending' RETURNING id,display_name,tiktok_url,verification_status,verification_note,role", [decision,String(note).slice(0,1000),req.params.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Pending verification request not found' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});
router.get('/sales', auth, async (req, res, next) => {
  try { const { rows } = await db.query(`SELECT e.id,e.title,COUNT(p.id)::int AS sales,COALESCE(SUM(p.price_points),0)::int AS points_earned FROM edits e LEFT JOIN purchases p ON p.edit_id=e.id WHERE e.creator_id=$1 GROUP BY e.id ORDER BY sales DESC,e.created_at DESC`, [req.user.id]); res.json({ sales: rows }); }
  catch (e) { next(e); }
});
module.exports = router;
