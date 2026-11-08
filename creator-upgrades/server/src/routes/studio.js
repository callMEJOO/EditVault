const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 300) * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('Only MP4, MOV, and WebM video files are supported.'));
    }
    callback(null, true);
  },
});

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    const absolute = path.resolve(filePath);
    const relative = path.relative(uploadDir, absolute);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative) && fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
    }
  } catch { /* Best-effort cleanup only. */ }
};

const isManagedUpload = (filePath) => {
  if (!filePath) return false;
  const absolute = path.resolve(filePath);
  const relative = path.relative(uploadDir, absolute);
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
};

async function verifiedCreatorOnly(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT role, verification_status FROM users WHERE id = $1',
      [req.user.id]
    );
    const account = rows[0];
    if (!account) return res.status(401).json({ error: 'Account not found.' });
    if (account.role !== 'admin' && (account.role !== 'creator' || account.verification_status !== 'verified')) {
      return res.status(403).json({
        error: 'Verify your TikTok profile before uploading or changing published edits.',
        verificationRequired: true,
      });
    }
    next();
  } catch (error) { next(error); }
}

function validateClipRange(startValue, endValue) {
  const start = Number(startValue);
  const end = Number(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return { error: 'Choose a valid start and end time for the preview.' };
  }
  const duration = end - start;
  if (duration < 3) return { error: 'The preview must be at least 3 seconds long.' };
  if (duration > 60) return { error: 'The preview cannot be longer than 60 seconds.' };
  if (end > 24 * 60 * 60) return { error: 'The selected end time is too large.' };
  return { start, end, duration };
}

function createPreview(sourcePath, start, end) {
  return new Promise((resolve, reject) => {
    let ffmpegPath;
    try { ffmpegPath = require('ffmpeg-static'); }
    catch {
      return reject(new Error('Preview generator is not installed. Run npm install in the server folder.'));
    }
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      return reject(new Error('FFmpeg is unavailable. Run npm install in the server folder.'));
    }

    const outputPath = path.join(uploadDir, `${Date.now()}-preview-${crypto.randomUUID()}.mp4`);
    const duration = (end - start).toFixed(3);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', String(start), '-i', sourcePath, '-t', duration,
      '-map', '0:v:0', '-map', '0:a?',
      '-vf', "scale='min(960,iw)':-2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart', '-sn', outputPath,
    ];
    let stderr = '';
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-6000); });
    child.on('error', (error) => {
      safeUnlink(outputPath);
      reject(new Error(`Could not start FFmpeg: ${error.message}`));
    });
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        return resolve(outputPath);
      }
      safeUnlink(outputPath);
      reject(new Error(`Could not create the selected preview. Make sure the selected time range contains video.${stderr ? ` ${stderr}` : ''}`));
    });
  });
}

function validTikTokUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid public TikTok profile URL.'); }
  if (!['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(parsed.hostname.toLowerCase()) || !parsed.pathname.startsWith('/@')) {
    throw new Error('Use a public TikTok profile URL such as https://www.tiktok.com/@username.');
  }
  return parsed.toString();
}

// Creator public-profile settings. Follower counts are creator-reported, not fetched from TikTok.
router.put('/profile', auth, async (req, res, next) => {
  try {
    const displayName = String(req.body?.displayName || '').trim();
    const followersRaw = req.body?.tiktokFollowers;
    const followers = Number(followersRaw);
    if (displayName.length < 2 || displayName.length > 50) {
      return res.status(400).json({ error: 'Page name must be between 2 and 50 characters.' });
    }
    if (!Number.isSafeInteger(followers) || followers < 0 || followers > 2000000000) {
      return res.status(400).json({ error: 'TikTok follower count must be a whole number between 0 and 2,000,000,000.' });
    }
    let tiktokUrl;
    try { tiktokUrl = validTikTokUrl(req.body?.tiktokUrl); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    const { rows } = await db.query(
      `UPDATE users
       SET display_name = $1,
           tiktok_url = $2,
           tiktok_followers_updated_at = CASE
             WHEN tiktok_followers IS DISTINCT FROM $3::bigint OR tiktok_followers_updated_at IS NULL THEN NOW()
             ELSE tiktok_followers_updated_at
           END,
           tiktok_followers = $3,
           verification_status = CASE
             WHEN tiktok_url IS DISTINCT FROM $2 THEN CASE WHEN $2 IS NULL THEN 'not_requested' ELSE 'pending' END
             ELSE verification_status
           END,
           verification_note = CASE WHEN tiktok_url IS DISTINCT FROM $2 THEN NULL ELSE verification_note END
       WHERE id = $4
       RETURNING id, display_name, role, tiktok_url, tiktok_followers,
                 tiktok_followers_updated_at, verification_status, verification_note`,
      [displayName, tiktokUrl, followers, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json({
      user: { ...rows[0], tiktok_followers: Number(rows[0].tiktok_followers || 0) },
      message: 'Public creator profile saved. TikTok followers are marked as creator-reported.',
    });
  } catch (error) { next(error); }
});

// Current creator's full profile settings (never exposed anonymously).
router.get('/profile/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, display_name, role, tiktok_url, tiktok_followers,
              tiktok_followers_updated_at, verification_status, verification_note
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: { ...rows[0], tiktok_followers: Number(rows[0].tiktok_followers || 0) } });
  } catch (error) { next(error); }
});

// Public creator page, containing only published edits with a real preview file.
router.get('/profile/:creatorId', async (req, res, next) => {
  try {
    const { rows: profileRows } = await db.query(
      `SELECT id, display_name, tiktok_url, tiktok_followers,
              tiktok_followers_updated_at, verification_status, created_at
       FROM users WHERE id = $1`,
      [req.params.creatorId]
    );
    if (!profileRows[0]) return res.status(404).json({ error: 'Creator profile not found.' });

    const { rows: editRows } = await db.query(
      `SELECT e.id, e.title, e.description, e.category, e.editing_software,
              e.price_points, e.created_at,
              (SELECT COUNT(*)::int FROM purchases p WHERE p.edit_id = e.id) AS sales
       FROM edits e
       WHERE e.creator_id = $1 AND e.status = 'published'
       ORDER BY e.created_at DESC`,
      [req.params.creatorId]
    );
    const publicEdits = editRows;
    const previewRows = await db.query(
      `SELECT id, preview_path FROM edits WHERE creator_id = $1 AND status = 'published'`,
      [req.params.creatorId]
    );
    const availablePreviewIds = new Set(previewRows.rows.filter((row) => {
      if (!row.preview_path || !isManagedUpload(row.preview_path)) return false;
      return fs.existsSync(path.resolve(row.preview_path));
    }).map((row) => String(row.id)));

    res.json({
      creator: {
        ...profileRows[0],
        tiktok_followers: Number(profileRows[0].tiktok_followers || 0),
        is_verified: profileRows[0].verification_status === 'verified',
        follower_count_source: 'creator_reported',
      },
      edits: publicEdits.filter((edit) => availablePreviewIds.has(String(edit.id))).map((edit) => ({
        ...edit,
        has_preview: true,
        previewUrl: `/api/edits/${edit.id}/preview`,
      })),
    });
  } catch (error) { next(error); }
});

// Private creator catalog, with no server file paths exposed to the browser.
router.get('/edits/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.description, e.category, e.editing_software,
              e.price_points, e.status, e.created_at,
              e.preview_path, e.preview_start_seconds, e.preview_end_seconds,
              COUNT(p.id)::int AS sales,
              COALESCE(SUM(p.price_points), 0)::int AS points_earned
       FROM edits e LEFT JOIN purchases p ON p.edit_id = e.id
       WHERE e.creator_id = $1 AND e.status <> 'removed'
       GROUP BY e.id ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ edits: rows.map(({ preview_path, ...edit }) => ({
      ...edit,
      has_preview: Boolean(preview_path && isManagedUpload(preview_path) && fs.existsSync(path.resolve(preview_path))),
    })) });
  } catch (error) { next(error); }
});

// Create edit and encode just the chosen section as its public preview.
router.post('/edits', auth, verifiedCreatorOnly, upload.single('original'), async (req, res, next) => {
  const original = req.file;
  let generatedPreview = null;
  try {
    if (!original) return res.status(400).json({ error: 'Choose an original video file.' });

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || 'Other').trim().slice(0, 40) || 'Other';
    const editingSoftware = String(req.body?.editingSoftware || '').trim().slice(0, 80);
    const price = Number(req.body?.pricePoints);
    if (title.length < 2 || title.length > 120 || !Number.isInteger(price) || price < 1 || price > 100000) {
      safeUnlink(original.path);
      return res.status(400).json({ error: 'Enter a title (2–120 characters) and a price from 1 to 100,000 points.' });
    }
    if (description.length > 2000) {
      safeUnlink(original.path);
      return res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' });
    }
    const clip = validateClipRange(req.body?.previewStartSeconds, req.body?.previewEndSeconds);
    if (clip.error) {
      safeUnlink(original.path);
      return res.status(400).json({ error: clip.error });
    }

    generatedPreview = await createPreview(original.path, clip.start, clip.end);
    const { rows } = await db.query(
      `INSERT INTO edits (
         creator_id, title, description, category, editing_software,
         price_points, preview_path, original_path, original_filename,
         preview_start_seconds, preview_end_seconds
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, description, category, editing_software,
                 price_points, status, created_at, preview_start_seconds, preview_end_seconds`,
      [req.user.id, title, description, category, editingSoftware, price, generatedPreview,
       original.path, path.basename(original.originalname), clip.start, clip.end]
    );
    res.status(201).json({
      edit: { ...rows[0], has_preview: true },
      message: `Edit published with a ${clip.duration.toFixed(1)} second public preview. The original remains protected.`,
    });
  } catch (error) {
    safeUnlink(original?.path);
    safeUnlink(generatedPreview);
    next(error);
  }
});

// Stream the creator's own original into the studio preview selector; never public.
router.get('/edits/:id/original', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.original_path, e.original_filename, e.creator_id, u.role AS requester_role
       FROM edits e JOIN users u ON u.id = $2 WHERE e.id = $1 AND e.status <> 'removed'`,
      [req.params.id, req.user.id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Edit not found.' });
    if (String(row.creator_id) !== String(req.user.id) && row.requester_role !== 'admin') {
      return res.status(403).json({ error: 'Only the edit owner or an admin can access the original in Creator Studio.' });
    }
    if (!isManagedUpload(row.original_path) || !fs.existsSync(path.resolve(row.original_path))) {
      return res.status(410).json({ error: 'Original file is unavailable.' });
    }
    res.set('Cache-Control', 'no-store');
    const originalExtension = path.extname(row.original_filename || row.original_path).toLowerCase();
    const originalContentType = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }[originalExtension] || 'video/mp4';
    res.type(originalContentType);
    return res.sendFile(path.resolve(row.original_path));
  } catch (error) { next(error); }
});

// Replace an existing edit's preview by selecting a new time range from its protected original.
router.post('/edits/:id/preview/trim', auth, async (req, res, next) => {
  let generatedPreview = null;
  try {
    const clip = validateClipRange(req.body?.startSeconds, req.body?.endSeconds);
    if (clip.error) return res.status(400).json({ error: clip.error });
    const { rows } = await db.query(
      `SELECT e.id, e.creator_id, e.original_path, e.preview_path, u.role AS requester_role
       FROM edits e JOIN users u ON u.id = $2
       WHERE e.id = $1 AND e.status <> 'removed'`,
      [req.params.id, req.user.id]
    );
    const edit = rows[0];
    if (!edit) return res.status(404).json({ error: 'Edit not found.' });
    if (String(edit.creator_id) !== String(req.user.id) && edit.requester_role !== 'admin') {
      return res.status(403).json({ error: 'Only the edit owner or an admin can change this preview.' });
    }
    if (!isManagedUpload(edit.original_path) || !fs.existsSync(path.resolve(edit.original_path))) {
      return res.status(410).json({ error: 'Original file is unavailable.' });
    }
    generatedPreview = await createPreview(path.resolve(edit.original_path), clip.start, clip.end);
    await db.query(
      `UPDATE edits SET preview_path = $1, preview_start_seconds = $2, preview_end_seconds = $3 WHERE id = $4`,
      [generatedPreview, clip.start, clip.end, edit.id]
    );
    if (edit.preview_path && edit.preview_path !== edit.original_path) safeUnlink(edit.preview_path);
    res.json({
      editId: edit.id,
      has_preview: true,
      previewUrl: `/api/edits/${edit.id}/preview`,
      message: `Preview changed to ${clip.duration.toFixed(1)} seconds.`,
    });
  } catch (error) {
    safeUnlink(generatedPreview);
    next(error);
  }
});

// Edit listing information without replacing the original or resetting purchases.
router.patch('/edits/:id', auth, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || 'Other').trim().slice(0, 40) || 'Other';
    const editingSoftware = String(req.body?.editingSoftware || '').trim().slice(0, 80);
    const price = Number(req.body?.pricePoints);
    if (title.length < 2 || title.length > 120 || !Number.isInteger(price) || price < 1 || price > 100000) {
      return res.status(400).json({ error: 'Enter a title (2–120 characters) and a price from 1 to 100,000 points.' });
    }
    if (description.length > 2000) return res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' });
    const { rows: ownerRows } = await db.query(
      `SELECT e.id, e.creator_id, u.role AS requester_role FROM edits e JOIN users u ON u.id=$2 WHERE e.id=$1 AND e.status <> 'removed'`,
      [req.params.id, req.user.id]
    );
    const row = ownerRows[0];
    if (!row) return res.status(404).json({ error: 'Edit not found.' });
    if (String(row.creator_id) !== String(req.user.id) && row.requester_role !== 'admin') {
      return res.status(403).json({ error: 'Only the edit owner or an admin can edit this listing.' });
    }
    const { rows } = await db.query(
      `UPDATE edits SET title=$1, description=$2, category=$3, editing_software=$4, price_points=$5
       WHERE id=$6 RETURNING id,title,description,category,editing_software,price_points,status,created_at`,
      [title, description, category, editingSoftware, price, req.params.id]
    );
    res.json({ edit: rows[0], message: 'Edit listing updated.' });
  } catch (error) { next(error); }
});

// Soft-remove from public browsing. Purchases and original files are retained for prior buyers.
router.delete('/edits/:id', auth, async (req, res, next) => {
  try {
    const { rows: ownerRows } = await db.query(
      `SELECT e.id, e.creator_id, u.role AS requester_role FROM edits e JOIN users u ON u.id=$2 WHERE e.id=$1 AND e.status <> 'removed'`,
      [req.params.id, req.user.id]
    );
    const row = ownerRows[0];
    if (!row) return res.status(404).json({ error: 'Edit not found or already removed.' });
    if (String(row.creator_id) !== String(req.user.id) && row.requester_role !== 'admin') {
      return res.status(403).json({ error: 'Only the edit owner or an admin can remove this listing.' });
    }
    await db.query(`UPDATE edits SET status='removed' WHERE id=$1`, [req.params.id]);
    res.json({ removed: true, message: 'Edit removed from public browsing. Purchase history was retained.' });
  } catch (error) { next(error); }
});

module.exports = router;
