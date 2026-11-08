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
const allowedCoverMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const scenePackUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, callback) => callback(null, file.fieldname === 'cover' ? scenePackCoverDir : scenePackUploadDir),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: Number(process.env.MAX_SCENE_PACK_MB || 500) * 1024 * 1024, files: 2, fields: 10 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (file.fieldname === 'cover') {
      if (!allowedCoverExtensions.has(extension) || !allowedCoverMimeTypes.has(file.mimetype)) {
        return callback(new Error('Cover must be a JPG, PNG, or WebP image.'));
      }
      return callback(null, true);
    }
    if (file.fieldname !== 'asset' || !allowedPackExtensions.has(extension)) {
      return callback(new Error('Scene packs must be ZIP, 7Z, or RAR archives.'));
    }
    callback(null, true);
  },
});
const scenePackFields = scenePackUpload.fields([{ name: 'asset', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

function cleanupUploaded(file) {
  if (file?.path) {
    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch { /* best-effort cleanup */ }
  }
}
function cleanupScenePackUploads(req) {
  for (const values of Object.values(req.files || {})) for (const file of values || []) cleanupUploaded(file);
}
function managedFilePath(filePath, managedDirectory) {
  if (!filePath) return false;
  const absolute = path.resolve(filePath);
  const relative = path.relative(managedDirectory, absolute);
  return Boolean(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function managedPackPath(filePath) { return managedFilePath(filePath, scenePackUploadDir); }
function managedCoverPath(filePath) { return managedFilePath(filePath, scenePackCoverDir); }
function safeHttpUrl(value, optional = false) {
  const raw = String(value || '').trim();
  if (!raw && optional) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid URL.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only HTTP(S) URLs are allowed.');
  return parsed.toString();
}

function coverPathFor(id) { return `/api/marketplace/scene-packs/${id}/cover`; }

// Public catalog exposes a public cover image, never private asset delivery fields.
router.get('/scene-packs', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.title, p.description, p.category, p.quality, p.price_points,
              CASE WHEN p.cover_file_path IS NOT NULL THEN '/api/marketplace/scene-packs/' || p.id::text || '/cover' ELSE p.cover_url END AS cover_url,
              p.created_at, u.display_name AS creator_name
       FROM scene_packs p LEFT JOIN users u ON u.id = p.created_by
       WHERE p.status = 'available'
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.set('Cache-Control', 'no-store');
    res.json({ packs: rows });
  } catch (error) { next(error); }
});

// Admin-only view for moderation and visibility controls. No private asset paths are returned.
router.get('/scene-packs/admin', auth, adminOnly, async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.title, p.description, p.category, p.quality, p.price_points,
              CASE WHEN p.cover_file_path IS NOT NULL THEN '/api/marketplace/scene-packs/' || p.id::text || '/cover' ELSE p.cover_url END AS cover_url,
              p.status, CASE WHEN p.asset_file_path IS NULL THEN 'link' ELSE 'upload' END AS source_mode,
              p.created_at, u.display_name AS creator_name
       FROM scene_packs p LEFT JOIN users u ON u.id = p.created_by
       ORDER BY p.created_at DESC LIMIT 300`
    );
    res.set('Cache-Control', 'no-store');
    res.json({ packs: rows });
  } catch (error) { next(error); }
});

async function createScenePack(req, res, next) {
  const uploaded = req.files?.asset?.[0] || null;
  const cover = req.files?.cover?.[0] || null;
  let saved = false;
  try {
    if (!cover) {
      cleanupScenePackUploads(req);
      return res.status(400).json({ error: 'Upload a cover image (JPG, PNG, or WebP) for every scene pack.' });
    }
    if (cover.size > 5 * 1024 * 1024) {
      cleanupScenePackUploads(req);
      return res.status(413).json({ error: 'Cover image must be 5 MB or smaller.' });
    }
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || 'Scene Pack').trim().slice(0, 50) || 'Scene Pack';
    const quality = String(req.body?.quality || '1080p').trim();
    const allowedQuality = new Set(['720p', '1080p', '1440p', '4K', 'Mixed', 'Other']);
    const price = Number(req.body?.pricePoints);
    if (title.length < 2 || title.length > 120) { cleanupScenePackUploads(req); return res.status(400).json({ error: 'Name must be between 2 and 120 characters.' }); }
    if (!allowedQuality.has(quality)) { cleanupScenePackUploads(req); return res.status(400).json({ error: 'Choose a supported scene-pack quality.' }); }
    if (description.length > 2000) { cleanupScenePackUploads(req); return res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' }); }
    if (!Number.isSafeInteger(price) || price < 1 || price > 100000) { cleanupScenePackUploads(req); return res.status(400).json({ error: 'Price must be a whole number between 1 and 100,000 points.' }); }
    let assetUrl = null;
    try { if (!uploaded) assetUrl = safeHttpUrl(req.body?.assetUrl); }
    catch (error) { cleanupScenePackUploads(req); return res.status(400).json({ error: error.message }); }
    if (!uploaded && !assetUrl) { cleanupScenePackUploads(req); return res.status(400).json({ error: 'Upload a ZIP, 7Z, or RAR file, or enter a download link.' }); }
    const originalName = uploaded ? String(uploaded.originalname || 'scene-pack.zip').replace(/\\/g, '/').split('/').pop().slice(0, 255) : null;
    const coverName = String(cover.originalname || 'scene-pack-cover.webp').replace(/\\/g, '/').split('/').pop().slice(0, 255);
    const { rows } = await db.query(
      `INSERT INTO scene_packs
         (created_by, title, description, category, quality, price_points, cover_url, cover_file_path, cover_original_name, asset_url, asset_file_path, asset_original_name)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11)
       RETURNING id, title, description, category, quality, price_points, status, created_at`,
      [req.user.id, title, description, category, quality, price, cover.path, coverName, assetUrl, uploaded ? uploaded.path : null, originalName]
    );
    saved = true;
    res.status(201).json({ pack: { ...rows[0], cover_url: coverPathFor(rows[0].id) }, message: 'Scene pack published.' });
  } catch (error) {
    if (!saved) cleanupScenePackUploads(req);
    next(error);
  }
}

// Any signed-in member can publish a scene pack, but a cover image is mandatory.
router.post('/scene-packs', auth, scenePackFields, createScenePack);
// Backwards-compatible admin upload route for older clients.
router.post('/scene-packs/admin', auth, adminOnly, scenePackFields, createScenePack);

router.get('/scene-packs/:id/cover', async (req, res, next) => {
  if (!UUID_RE.test(String(req.params.id || ''))) return res.status(400).json({ error: 'Invalid scene pack id.' });
  try {
    const { rows } = await db.query(`SELECT cover_file_path, cover_original_name FROM scene_packs WHERE id=$1`, [req.params.id]);
    const cover = rows[0];
    if (!cover || !managedCoverPath(cover.cover_file_path) || !fs.existsSync(cover.cover_file_path)) {
      return res.status(404).json({ error: 'Cover image not found.' });
    }
    res.set('Cache-Control', 'public, max-age=300');
    return res.sendFile(cover.cover_file_path);
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
      `SELECT id, created_by, price_points, status FROM scene_packs WHERE id=$1 FOR UPDATE`, [req.params.id]
    );
    const pack = packRows[0];
    if (!pack || pack.status !== 'available') { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Scene pack is not available.' }); }
    if (String(pack.created_by || '') === String(req.user.id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You cannot purchase your own scene pack.' }); }
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
      [req.user.id, -Number(pack.price_points), purchaseRows[0].id, `scene-pack-purchase:${purchaseRows[0].id}`]
    );
    if (pack.created_by) {
      await client.query(
        `INSERT INTO wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING`,
        [pack.created_by]
      );
      await client.query(
        `UPDATE wallets SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2`,
        [Number(pack.price_points), pack.created_by]
      );
      await client.query(
        `INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
         VALUES ($1,$2,'sale',$3,$4)`,
        [pack.created_by, Number(pack.price_points), purchaseRows[0].id, `scene-pack-sale:${purchaseRows[0].id}`]
      );
    }
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ purchased: true, alreadyOwned: false, purchaseId: purchaseRows[0].id, balance: Number(walletRows[0].balance), message: 'Scene pack unlocked. Opening your download…' });
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
