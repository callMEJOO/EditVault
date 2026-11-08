const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIP_STATUSES = new Set(['submitted', 'reviewing', 'quoted', 'in_progress', 'completed', 'cancelled']);

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');
const scenePackUploadDir = path.join(uploadRoot, 'scene-packs');
const scenePackCoverDir = path.join(uploadRoot, 'scene-pack-covers');
fs.mkdirSync(scenePackUploadDir, { recursive: true });
fs.mkdirSync(scenePackCoverDir, { recursive: true });
const allowedPackExtensions = new Set(['.zip', '.7z', '.rar']);
const allowedCoverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const packUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, callback) => callback(null, file.fieldname === 'cover' ? scenePackCoverDir : scenePackUploadDir),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: Number(process.env.MAX_SCENE_PACK_MB || 500) * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (file.fieldname === 'cover') {
      if (!allowedCoverExtensions.has(extension) || !String(file.mimetype || '').toLowerCase().startsWith('image/')) return callback(new Error('Scene pack cover must be a JPG, PNG, or WebP image.'));
      return callback(null, true);
    }
    if (file.fieldname !== 'asset' || !allowedPackExtensions.has(extension)) return callback(new Error('Scene packs must be ZIP, 7Z, or RAR archives.'));
    callback(null, true);
  },
});

function removePackFile(file) {
  if (file?.path) {
    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch { /* best-effort cleanup */ }
  }
}

function removeScenePackUploads(req) {
  for (const file of [req.file, ...Object.values(req.files || {}).flat()]) removePackFile(file);
}

function managedPackPath(filePath) {
  if (!filePath) return false;
  const absolute = path.resolve(filePath);
  const relative = path.relative(scenePackUploadDir, absolute);
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function managedCoverPath(filePath) {
  if (!filePath) return false;
  const absolute = path.resolve(filePath);
  const relative = path.relative(scenePackCoverDir, absolute);
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function scenePackUploads(req) {
  return {
    asset: req.files?.asset?.[0] || req.file || null,
    cover: req.files?.cover?.[0] || null,
  };
}

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
      `SELECT p.id, p.title, p.description, p.category, p.quality, p.price_points,
              CASE WHEN p.cover_file_path IS NOT NULL THEN '/api/marketplace/scene-packs/' || p.id || '/cover' ELSE p.cover_url END AS cover_url,
              p.created_at, u.display_name AS creator_name
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
      `SELECT p.id, p.title, p.description, p.category, p.quality, p.price_points,
              CASE WHEN p.cover_file_path IS NOT NULL THEN '/api/marketplace/scene-packs/' || p.id || '/cover' ELSE p.cover_url END AS cover_url,
              p.status, p.created_by, u.display_name AS creator_name,
              CASE WHEN p.asset_file_path IS NULL THEN 'link' ELSE 'upload' END AS source_mode, p.created_at
       FROM scene_packs p LEFT JOIN users u ON u.id=p.created_by
       ORDER BY p.created_at DESC LIMIT 200`
    );
    res.json({ packs: rows });
  } catch (error) { next(error); }
});

async function createScenePack(req, res, next) {
  const { asset: uploaded, cover } = scenePackUploads(req);
  let saved = false;
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || 'Scene Pack').trim().slice(0, 50) || 'Scene Pack';
    const quality = String(req.body?.quality || '1080p').trim();
    const allowedQuality = new Set(['720p', '1080p', '1440p', '4K', 'Mixed', 'Other']);
    const price = Number(req.body?.pricePoints);
    if (!cover) { removeScenePackUploads(req); return res.status(400).json({ error: 'Upload a cover image (JPG, PNG, or WebP) for every scene pack.' }); }
    if (cover.size > 5 * 1024 * 1024) { removeScenePackUploads(req); return res.status(400).json({ error: 'Cover image must be 5 MB or smaller.' }); }
    if (title.length < 2 || title.length > 120) { removeScenePackUploads(req); return res.status(400).json({ error: 'Name must be between 2 and 120 characters.' }); }
    if (!allowedQuality.has(quality)) { removeScenePackUploads(req); return res.status(400).json({ error: 'Choose a supported scene-pack quality.' }); }
    if (description.length > 2000) { removeScenePackUploads(req); return res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' }); }
    if (!Number.isSafeInteger(price) || price < 1 || price > 100000) { removeScenePackUploads(req); return res.status(400).json({ error: 'Price must be a whole number between 1 and 100,000 points.' }); }
    let assetUrl = null;
    try {
      if (!uploaded) assetUrl = safeHttpUrl(req.body?.assetUrl);
    } catch (error) { removeScenePackUploads(req); return res.status(400).json({ error: error.message }); }
    if (!uploaded && !assetUrl) { removeScenePackUploads(req); return res.status(400).json({ error: 'Upload a ZIP, 7Z, or RAR file, or enter a download link.' }); }
    if (uploaded && String(req.body?.assetUrl || '').trim()) { removeScenePackUploads(req); return res.status(400).json({ error: 'Choose either an uploaded archive or a download link, not both.' }); }
    const originalName = uploaded ? String(uploaded.originalname || 'scene-pack.zip').replace(/\\/g, '/').split('/').pop().slice(0, 255) : null;
    const coverName = String(cover.originalname || 'cover').replace(/\\/g, '/').split('/').pop().slice(0, 255);
    const { rows } = await db.query(
      `INSERT INTO scene_packs
         (created_by, title, description, category, quality, price_points, cover_url, cover_file_path, cover_original_name, asset_url, asset_file_path, asset_original_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,'available')
       RETURNING id, title, description, category, quality, price_points, status, created_at`,
      [req.user.id, title, description, category, quality, price, cover.path, coverName, assetUrl, uploaded ? uploaded.path : null, originalName]
    );
    saved = true;
    const pack = { ...rows[0], cover_url: `/api/marketplace/scene-packs/${rows[0].id}/cover`, creator_name: req.user.display_name || null };
    res.status(201).json({ pack, message: 'Scene pack published.' });
  } catch (error) {
    if (!saved) removeScenePackUploads(req);
    next(error);
  }
}

// Any signed-in member may submit a scene pack, but a cover image is mandatory.
router.post('/scene-packs', auth, packUpload.fields([{ name: 'cover', maxCount: 1 }, { name: 'asset', maxCount: 1 }]), createScenePack);
// Keep the existing admin route compatible; it follows the same cover-image rule.
router.post('/scene-packs/admin', auth, adminOnly, packUpload.fields([{ name: 'cover', maxCount: 1 }, { name: 'asset', maxCount: 1 }]), createScenePack);

router.get('/scene-packs/:id/cover', async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid scene pack id.' });
  try {
    const { rows } = await db.query('SELECT cover_file_path, cover_url FROM scene_packs WHERE id=$1', [req.params.id]);
    const pack = rows[0];
    if (!pack) return res.status(404).json({ error: 'Scene pack not found.' });
    if (pack.cover_file_path) {
      if (!managedCoverPath(pack.cover_file_path) || !fs.existsSync(pack.cover_file_path)) return res.status(410).json({ error: 'Scene pack cover is unavailable.' });
      res.set('Cache-Control', 'public, max-age=3600');
      return res.sendFile(path.basename(pack.cover_file_path), { root: scenePackCoverDir });
    }
    if (pack.cover_url) {
      try { return res.redirect(302, safeHttpUrl(pack.cover_url)); }
      catch { return res.status(410).json({ error: 'Scene pack cover is unavailable.' }); }
    }
    return res.status(404).json({ error: 'Scene pack cover not found.' });
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
      `SELECT p.id, p.title, p.asset_url, p.asset_file_path, p.asset_original_name FROM scene_packs p
       WHERE p.id=$1 AND ($3::boolean OR EXISTS (SELECT 1 FROM scene_pack_purchases sp WHERE sp.scene_pack_id=p.id AND sp.buyer_id=$2))`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Purchase this scene pack before downloading it.' });
    res.set('Cache-Control', 'no-store');
    if (rows[0].asset_file_path) {
      if (!managedPackPath(rows[0].asset_file_path) || !fs.existsSync(rows[0].asset_file_path)) {
        return res.status(410).json({ error: 'The uploaded scene-pack file is no longer available.' });
      }
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ error: 'Secure downloads are not configured.' });
      const ticket = jwt.sign({ purpose: 'scene-pack-download', packId: String(rows[0].id), userId: String(req.user.id) }, process.env.JWT_SECRET, { expiresIn: '2m' });
      const origin = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      return res.json({ title: rows[0].title, downloadUrl: `${origin}/api/marketplace/scene-packs/${rows[0].id}/file?ticket=${encodeURIComponent(ticket)}` });
    }
    if (!rows[0].asset_url) return res.status(410).json({ error: 'The scene-pack download is not available.' });
    res.json({ title: rows[0].title, downloadUrl: rows[0].asset_url });
  } catch (error) { next(error); }
});

// Short-lived signed ticket endpoint for private uploaded files; a token is issued only after purchase/admin authorization.
router.get('/scene-packs/:id/file', async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid scene pack id.' });
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ error: 'Secure downloads are not configured.' });
    let payload;
    try { payload = jwt.verify(String(req.query.ticket || ''), process.env.JWT_SECRET); }
    catch { return res.status(403).json({ error: 'This download link has expired or is invalid. Unlock the pack again to receive a new link.' }); }
    if (payload?.purpose !== 'scene-pack-download' || String(payload.packId) !== String(req.params.id) || !payload.userId) {
      return res.status(403).json({ error: 'Invalid download ticket.' });
    }
    const { rows } = await db.query(
      `SELECT title, asset_file_path, asset_original_name FROM scene_packs WHERE id = $1`, [req.params.id]
    );
    const pack = rows[0];
    if (!pack || !managedPackPath(pack.asset_file_path) || !fs.existsSync(pack.asset_file_path)) {
      return res.status(410).json({ error: 'The uploaded scene-pack file is no longer available.' });
    }
    res.set('Cache-Control', 'no-store');
    return res.download(pack.asset_file_path, pack.asset_original_name || `${pack.title}.zip`);
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
    if (style.length > 100) return res.status(400).json({ error: 'Editing style cannot exceed 100 characters.' });
    if (targetDuration.length > 60) return res.status(400).json({ error: 'Target duration cannot exceed 60 characters.' });
    if (sourceLinks.length > 5000) return res.status(400).json({ error: 'Source links cannot exceed 5,000 characters.' });
    if (description.length < 8) return res.status(400).json({ error: 'Add a short brief of at least 8 characters.' });
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
