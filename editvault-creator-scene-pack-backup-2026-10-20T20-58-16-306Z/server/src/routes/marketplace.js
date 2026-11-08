const crypto = require('crypto');
const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIP_STATUSES = new Set(['submitted', 'reviewing', 'quoted', 'in_progress', 'completed', 'cancelled']);

function safeHttpUrl(value, optional = false) {
  const raw = String(value || '').trim();
  if (!raw && optional) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid URL.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only HTTP(S) URLs are allowed.');
  return parsed.toString();
}

// Public catalog deliberately excludes the private delivery URL.
router.get('/scene-packs', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.title, p.description, p.category, p.price_points, p.cover_url, p.created_at,
              u.display_name AS creator_name
       FROM scene_packs p LEFT JOIN users u ON u.id = p.created_by
       WHERE p.status = 'available'
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.set('Cache-Control', 'no-store');
    res.json({ packs: rows });
  } catch (error) { next(error); }
});

router.get('/scene-packs/admin', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, description, category, price_points, cover_url, status, created_at
       FROM scene_packs ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ packs: rows });
  } catch (error) { next(error); }
});

router.post('/scene-packs/admin', auth, adminOnly, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || 'Scene Pack').trim().slice(0, 50) || 'Scene Pack';
    const price = Number(req.body?.pricePoints);
    if (title.length < 2 || title.length > 120) return res.status(400).json({ error: 'Title must be between 2 and 120 characters.' });
    if (description.length > 2000) return res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' });
    if (!Number.isSafeInteger(price) || price < 1 || price > 100000) return res.status(400).json({ error: 'Price must be a whole number between 1 and 100,000 points.' });
    let coverUrl; let assetUrl;
    try {
      coverUrl = safeHttpUrl(req.body?.coverUrl, true);
      assetUrl = safeHttpUrl(req.body?.assetUrl);
    } catch (error) { return res.status(400).json({ error: error.message }); }
    const { rows } = await db.query(
      `INSERT INTO scene_packs (created_by, title, description, category, price_points, cover_url, asset_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, description, category, price_points, cover_url, status, created_at`,
      [req.user.id, title, description, category, price, coverUrl, assetUrl]
    );
    res.status(201).json({ pack: rows[0], message: 'Scene pack published.' });
  } catch (error) { next(error); }
});

router.patch('/scene-packs/admin/:id', auth, adminOnly, async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid scene pack id.' });
  try {
    const status = String(req.body?.status || '');
    if (!['available', 'hidden'].includes(status)) return res.status(400).json({ error: 'Status must be available or hidden.' });
    const { rows } = await db.query(
      `UPDATE scene_packs SET status=$1 WHERE id=$2
       RETURNING id, title, status`, [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Scene pack not found.' });
    res.json({ pack: rows[0], message: status === 'available' ? 'Scene pack published.' : 'Scene pack hidden.' });
  } catch (error) { next(error); }
});

router.post('/scene-packs/:id/purchase', auth, async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid scene pack id.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: packRows } = await client.query(
      `SELECT id, price_points, status FROM scene_packs WHERE id=$1 FOR UPDATE`, [req.params.id]
    );
    const pack = packRows[0];
    if (!pack || pack.status !== 'available') { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Scene pack is not available.' }); }
    const { rows: existing } = await client.query(
      `SELECT id FROM scene_pack_purchases WHERE buyer_id=$1 AND scene_pack_id=$2`, [req.user.id, pack.id]
    );
    if (existing[0]) {
      await client.query('COMMIT');
      return res.json({ purchased: true, alreadyOwned: true, message: 'You already own this scene pack. Opening download…' });
    }
    const { rows: walletRows } = await client.query(
      `UPDATE wallets SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2 AND balance >= $1 RETURNING balance`,
      [pack.price_points, req.user.id]
    );
    if (!walletRows[0]) { await client.query('ROLLBACK'); return res.status(402).json({ error: 'Not enough points to unlock this scene pack.' }); }
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO scene_pack_purchases (buyer_id, scene_pack_id, price_points) VALUES ($1,$2,$3) RETURNING id`,
      [req.user.id, pack.id, pack.price_points]
    );
    await client.query(
      `INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
       VALUES ($1,$2,'purchase',$3,$4)`,
      [req.user.id, -Number(pack.price_points), pack.id, crypto.randomUUID()]
    );
    await client.query('COMMIT');
    res.status(201).json({ purchased: true, alreadyOwned: false, purchaseId: purchaseRows[0].id, balance: Number(walletRows[0].balance), message: 'Scene pack unlocked. Opening download…' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    next(error);
  } finally { client.release(); }
});

router.get('/scene-packs/:id/download', auth, async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid scene pack id.' });
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.title, p.asset_url FROM scene_packs p
       WHERE p.id=$1 AND ($3::boolean OR EXISTS (SELECT 1 FROM scene_pack_purchases sp WHERE sp.scene_pack_id=p.id AND sp.buyer_id=$2))`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Purchase this scene pack before downloading it.' });
    res.set('Cache-Control', 'no-store');
    res.json({ title: rows[0].title, downloadUrl: rows[0].asset_url });
  } catch (error) { next(error); }
});

router.get('/clip-requests', auth, async (req, res, next) => {
  try {
    const query = req.user.role === 'admin'
      ? `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email
         FROM clip_assembly_requests r JOIN users u ON u.id=r.requester_id
         ORDER BY r.created_at DESC LIMIT 300`
      : `SELECT id, requester_id, title, style, target_duration, source_links, budget_points, description, status, created_at, updated_at
         FROM clip_assembly_requests WHERE requester_id=$1 ORDER BY created_at DESC LIMIT 100`;
    const { rows } = req.user.role === 'admin' ? await db.query(query) : await db.query(query, [req.user.id]);
    res.json({ requests: rows });
  } catch (error) { next(error); }
});

router.post('/clip-requests', auth, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const style = String(req.body?.style || '').trim();
    const targetDuration = String(req.body?.targetDuration || '').trim();
    const sourceLinks = String(req.body?.sourceLinks || '').trim();
    const description = String(req.body?.description || '').trim();
    const budgetRaw = req.body?.budgetPoints;
    const budget = budgetRaw === null || budgetRaw === undefined || budgetRaw === '' ? null : Number(budgetRaw);
    if (title.length < 3 || title.length > 120) return res.status(400).json({ error: 'Project title must be between 3 and 120 characters.' });
    if (style.length < 2 || style.length > 100) return res.status(400).json({ error: 'Enter an editing style.' });
    if (!targetDuration || targetDuration.length > 60) return res.status(400).json({ error: 'Enter a target duration (up to 60 characters).' });
    if (sourceLinks.length > 5000) return res.status(400).json({ error: 'Source links cannot exceed 5,000 characters.' });
    if (description.length > 2000) return res.status(400).json({ error: 'Notes cannot exceed 2,000 characters.' });
    if (budget !== null && (!Number.isSafeInteger(budget) || budget < 0 || budget > 100000)) return res.status(400).json({ error: 'Budget must be a whole number from 0 to 100,000.' });
    const { rows } = await db.query(
      `INSERT INTO clip_assembly_requests (requester_id, title, style, target_duration, source_links, budget_points, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, requester_id, title, style, target_duration, source_links, budget_points, description, status, created_at, updated_at`,
      [req.user.id, title, style, targetDuration, sourceLinks, budget, description]
    );
    res.status(201).json({ request: rows[0], message: 'Clip assembly request submitted.' });
  } catch (error) { next(error); }
});

router.patch('/clip-requests/:id', auth, adminOnly, async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid clip request id.' });
  try {
    const status = String(req.body?.status || '');
    if (!CLIP_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid clip request status.' });
    const { rows } = await db.query(
      `UPDATE clip_assembly_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, title, status, updated_at`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Clip request not found.' });
    res.json({ request: rows[0], message: 'Clip request status updated.' });
  } catch (error) { next(error); }
});

module.exports = router;
