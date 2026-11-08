const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const db = require('../db/pool');
const { auth } = require('../middleware/auth');
const { normalizeWatermark } = require('../lib/personalized-watermarks');
const { personalizedDownload } = require('../lib/personalized-download');

// Upload directory
const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || './uploads'
);

fs.mkdirSync(uploadDir, { recursive: true });

// Video upload configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(
      null,
      `${Date.now()}-${crypto.randomUUID()}${extension}`
    );
  },
});

const allowedMimeTypes = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const upload = multer({
  storage,

  limits: {
    fileSize:
      Number(process.env.MAX_UPLOAD_MB || 300) *
      1024 *
      1024,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error('Only MP4, MOV, and WebM videos are supported.')
      );
    }

    cb(null, true);
  },
});

async function generateWatermarkedPreview(inputPath, outputPathOverride = null) {
  const parsed = path.parse(inputPath);
  const outputPath = outputPathOverride || path.join(parsed.dir, `${parsed.name}-editvault-preview.mp4`);
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const filter = "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='EDITVAULT':fontcolor=white@0.26:fontsize=h/20:borderw=2:bordercolor=black@0.16:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='EDITVAULT':fontcolor=white@0.42:fontsize=h/38:borderw=1:bordercolor=black@0.18:x=w-text_w-24:y=h-text_h-22";
  try {
    await execFileAsync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a?', '-vf', filter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
    ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error('FFmpeg created an empty preview file.');
    return outputPath;
  } catch (error) {
    if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch { /* cleanup best effort */ } }
    error.code = 'EV_FFMPEG_PREVIEW_FAILED';
    throw error;
  }
}

// GET /api/edits
// Return published edits without exposing filesystem paths.
router.get('/', async (req, res, next) => {
  try {
    const q = `%${String(req.query.q || '').slice(0, 80)}%`;
    const category = String(req.query.category || '');

    const { rows } = await db.query(
      `
      SELECT
        e.id,
        e.title,
        e.description,
        e.category,
        e.editing_software,
        e.price_points,
        e.created_at,
        e.preview_path,
        EXISTS (SELECT 1 FROM purchases p WHERE p.edit_id = e.id) AS is_sold,
        COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM edit_reviews r WHERE r.edit_id = e.id), 0)::float AS avg_rating,
        COALESCE((SELECT COUNT(*)::int FROM edit_reviews r WHERE r.edit_id = e.id), 0)::int AS rating_count,
        u.id AS creator_id,
        u.display_name AS creator_name,
        u.tiktok_url,
        u.verification_status
      FROM edits e
      JOIN users u ON u.id = e.creator_id
      WHERE
        e.status = 'published'
        AND LOWER(e.title) NOT IN (
          'neon after hours',
          'midnight run',
          'after the rain',
          'limitless / amv',
          'city in motion',
          'soft focus'
        )
        AND ($1 = '' OR e.category = $1)
        AND (
          e.title ILIKE $2
          OR u.display_name ILIKE $2
        )
      ORDER BY e.created_at DESC
      LIMIT 60
      `,
      [category, q]
    );

    const publicEdits = rows
      .filter((edit) => {
        if (!edit.preview_path) return false;
        const previewPath = path.resolve(edit.preview_path);
        const relativePath = path.relative(uploadDir, previewPath);
        return Boolean(
          relativePath &&
          !relativePath.startsWith('..') &&
          !path.isAbsolute(relativePath) &&
          fs.existsSync(previewPath)
        );
      })
      .map(({ preview_path: _previewPath, ...edit }) => ({
        ...edit,
        has_preview: true,
      }));

    res.json({ edits: publicEdits });
  } catch (error) {
    console.error('GET /api/edits failed:', error);
    next(error);
  }
});

// GET /api/edits/mine - edits uploaded by the signed-in creator.
router.get('/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `
        SELECT
          e.id, e.title, e.description, e.category, e.editing_software,
          e.price_points, e.status, e.created_at,
          COUNT(p.id)::int AS sales,
          COALESCE(SUM(p.price_points), 0)::int AS points_earned
        FROM edits e
        LEFT JOIN purchases p ON p.edit_id = e.id
        WHERE e.creator_id = $1
        GROUP BY e.id
        ORDER BY e.created_at DESC
      `,
      [req.user.id]
    );
    res.json({ edits: rows });
  } catch (error) {
    next(error);
  }
});
async function verifiedCreatorOnly(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT role, verification_status FROM users WHERE id = $1',
      [req.user.id]
    );
    const account = rows[0];
    if (!account) return res.status(401).json({ error: 'Account not found.' });
    if (account.role !== 'admin' && account.role !== 'creator') {
      return res.status(403).json({
        error: 'Verify your TikTok profile before uploading videos.',
        verificationRequired: true
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}
// GET /api/edits/mine/library
// Return edits purchased by the logged-in user.
router.get('/mine/library', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `
      SELECT
        p.id AS purchase_id,
        p.created_at AS purchased_at,
        p.watermark_name, p.watermark_style,
        e.id, e.title, e.description, e.category, e.price_points,
        u.display_name AS creator_name,
        COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM edit_reviews r WHERE r.edit_id = e.id), 0)::float AS avg_rating,
        COALESCE((SELECT COUNT(*)::int FROM edit_reviews r WHERE r.edit_id = e.id), 0)::int AS rating_count,
        mine_review.rating AS my_rating,
        mine_review.comment AS my_comment
      FROM purchases p
      JOIN edits e ON e.id = p.edit_id
      JOIN users u ON u.id = e.creator_id
      LEFT JOIN edit_reviews mine_review ON mine_review.edit_id = e.id AND mine_review.buyer_id = p.buyer_id
      WHERE p.buyer_id = $1
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );

    res.json({ library: rows });
  } catch (error) {
    next(error);
  }
});


// GET /api/edits/:id/reviews - public aggregate and recent reviews.
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT r.rating, r.comment, r.created_at, u.display_name AS reviewer_name ' +
      'FROM edit_reviews r JOIN users u ON u.id = r.buyer_id ' +
      'WHERE r.edit_id = $1 ORDER BY r.created_at DESC LIMIT 30',
      [req.params.id]
    );
    const { rows: stats } = await db.query(
      'SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS avg_rating, COUNT(*)::int AS rating_count ' +
      'FROM edit_reviews WHERE edit_id = $1',
      [req.params.id]
    );
    res.json({ reviews: rows, avgRating: stats[0]?.avg_rating || 0, ratingCount: stats[0]?.rating_count || 0 });
  } catch (error) {
    next(error);
  }
});

// POST /api/edits/:id/reviews - only confirmed buyers may rate an edit.
router.post('/:id/reviews', auth, async (req, res, next) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim().slice(0, 600);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be an integer from 1 to 5.' });
    const { rows: owned } = await db.query(
      'SELECT 1 FROM purchases WHERE buyer_id = $1 AND edit_id = $2 LIMIT 1',
      [req.user.id, req.params.id]
    );
    if (!owned.length) return res.status(403).json({ error: 'Buy this edit before leaving a rating.' });
    const { rows } = await db.query(
      'INSERT INTO edit_reviews (buyer_id, edit_id, rating, comment) VALUES ($1, $2, $3, $4) ' +
      'ON CONFLICT (buyer_id, edit_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW() ' +
      'RETURNING id, rating, comment, created_at, updated_at',
      [req.user.id, req.params.id, rating, comment]
    );
    const { rows: stats } = await db.query(
      'SELECT ROUND(AVG(rating)::numeric, 1)::float AS avg_rating, COUNT(*)::int AS rating_count ' +
      'FROM edit_reviews WHERE edit_id = $1',
      [req.params.id]
    );
    res.status(200).json({ review: rows[0], avgRating: stats[0]?.avg_rating || 0, ratingCount: stats[0]?.rating_count || 0 });
  } catch (error) {
    next(error);
  }
});

// GET /api/edits/:id/preview
// Serve the preview only, never the protected original.
router.get('/:id/preview', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `
      SELECT preview_path
      FROM edits
      WHERE id = $1
        AND status = 'published'
      `,
      [req.params.id]
    );

    if (!rows[0] || !rows[0].preview_path) {
      return res.status(404).json({
        error: 'Preview is not available.',
      });
    }

    const previewPath = path.resolve(rows[0].preview_path);

    // Only serve files located inside the configured upload directory.
    const relativePath = path.relative(uploadDir, previewPath);

    if (
      !relativePath ||
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(403).json({
        error: 'Invalid preview path.',
      });
    }

    if (!fs.existsSync(previewPath)) {
      return res.status(410).json({
        error: 'Preview file is missing.',
      });
    }

    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');

    return res.sendFile(previewPath);
  } catch (error) {
    next(error);
  }
});

// POST /api/edits
// Upload a protected original and generate a full-duration, watermarked public preview from it.
router.post(
  '/',
  auth,
  verifiedCreatorOnly,
  upload.fields([
    { name: 'original', maxCount: 1 },
    { name: 'preview', maxCount: 1 }, // Accepted for backward compatibility; public preview comes from the original.
  ]),
  async (req, res, next) => {
    const originalFile = req.files?.original?.[0];
    const previewFile = req.files?.preview?.[0];
    let watermarkedPreviewPath = null;

    const removeUploadedFiles = ({ keepOriginal = false, keepWatermarked = false } = {}) => {
      for (const file of [originalFile, previewFile]) {
        if (!file?.path || (keepOriginal && file === originalFile)) continue;
        try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch { /* Best-effort cleanup. */ }
      }
      if (watermarkedPreviewPath && !keepWatermarked) {
        try { if (fs.existsSync(watermarkedPreviewPath)) fs.unlinkSync(watermarkedPreviewPath); } catch { /* Best-effort cleanup. */ }
      }
    };

    try {
      if (!originalFile) {
        removeUploadedFiles();
        return res.status(400).json({ error: 'Upload the original video file.' });
      }

      const {
        title,
        description = '',
        category = 'Other',
        editingSoftware = '',
        pricePoints,
      } = req.body;
      const price = Number(pricePoints);

      if (!title?.trim() || !Number.isInteger(price) || price < 1 || price > 100000) {
        removeUploadedFiles();
        return res.status(400).json({ error: 'A title and price between 1 and 100000 points are required.' });
      }

      try {
        watermarkedPreviewPath = await generateWatermarkedPreview(originalFile.path);
      } catch (previewError) {
        removeUploadedFiles();
        console.error('Watermarked full-video preview generation failed:', previewError.message);
        return res.status(503).json({ error: 'Could not generate the full-length watermarked preview. Confirm FFmpeg is installed on the server and FFMPEG_PATH is correct, then retry.' });
      }

      const { rows } = await db.query(
        `INSERT INTO edits (
          creator_id, title, description, category, editing_software,
          price_points, preview_path, original_path, original_filename
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, title, description, category, editing_software, price_points, status, created_at`,
        [
          req.user.id,
          title.trim(),
          String(description).slice(0, 2000),
          String(category).slice(0, 40),
          String(editingSoftware).slice(0, 80),
          price,
          watermarkedPreviewPath,
          originalFile.path,
          originalFile.originalname,
        ]
      );

      // Keep the protected original and committed preview. Remove unused upload fields only.
      removeUploadedFiles({ keepOriginal: true, keepWatermarked: true });
      res.status(201).json({
        edit: { ...rows[0], has_preview: true },
        message: 'Edit uploaded with a full-length watermarked preview. The original remains protected.',
      });
    } catch (error) {
      removeUploadedFiles();
      next(error);
    }
  }
);

// POST /api/edits/:id/preview
// Regenerate the full-length watermarked preview from the protected original.
router.post('/:id/preview', auth, verifiedCreatorOnly, upload.single('preview'), async (req, res, next) => {
  let newWatermarkedPath = null;
  const cleanupUpload = () => {
    if (req.file?.path) {
      try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch { /* best-effort cleanup */ }
    }
  };
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.creator_id, e.preview_path, e.original_path, u.role AS requester_role
       FROM edits e JOIN users u ON u.id = $2
       WHERE e.id = $1 AND e.status <> 'removed'`,
      [req.params.id, req.user.id]
    );
    const edit = rows[0];
    if (!edit) { cleanupUpload(); return res.status(404).json({ error: 'Edit not found.' }); }
    if (String(edit.creator_id) !== String(req.user.id) && edit.requester_role !== 'admin') {
      cleanupUpload();
      return res.status(403).json({ error: 'Only the edit owner or an admin can refresh this preview.' });
    }

    const originalPath = path.resolve(edit.original_path || '');
    const relativePath = path.relative(uploadDir, originalPath);
    if (!edit.original_path || !relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(originalPath)) {
      cleanupUpload();
      return res.status(410).json({ error: 'Protected original is unavailable; a full preview cannot be regenerated.' });
    }

    const parsed = path.parse(originalPath);
    const uniqueOutput = path.join(parsed.dir, parsed.name + '-editvault-preview-' + Date.now() + '.mp4');
    newWatermarkedPath = await generateWatermarkedPreview(originalPath, uniqueOutput);
    const { rows: updated } = await db.query(
      'UPDATE edits SET preview_path = $1 WHERE id = $2 RETURNING id, title, status',
      [newWatermarkedPath, edit.id]
    );
    if (!updated[0]) throw new Error('Preview path could not be saved.');

    cleanupUpload();
    newWatermarkedPath = null;
    res.json({ edit: updated[0], editId: edit.id, has_preview: true, previewUrl: `/api/edits/${edit.id}/preview`, message: 'Full-length watermarked preview regenerated.' });
  } catch (error) {
    cleanupUpload();
    if (newWatermarkedPath && fs.existsSync(newWatermarkedPath)) { try { fs.unlinkSync(newWatermarkedPath); } catch { /* best-effort cleanup */ } }
    if (error?.code === 'EV_FFMPEG_PREVIEW_FAILED') {
      return res.status(503).json({ error: 'FFmpeg could not generate the full-length watermarked preview. Check FFMPEG_PATH.' });
    }
    next(error);
  }
});

// POST /api/edits/:id/purchase
// Purchase an edit using points.
router.post('/:id/purchase', auth, async (req, res, next) => {
  let watermark;
  try { watermark = normalizeWatermark(req.body?.watermark); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const { rows: editRows } = await client.query(
      `
      SELECT id, creator_id, price_points, title
      FROM edits
      WHERE id = $1 AND status = 'published'
      FOR UPDATE
      `,
      [req.params.id]
    );

    const edit = editRows[0];

    if (!edit) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Edit not found.',
      });
    }

    if (edit.creator_id === req.user.id) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'You cannot buy your own edit.',
      });
    }

    const { rows: priorSale } = await client.query(
      `SELECT id, buyer_id FROM purchases WHERE edit_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [edit.id]
    );

    if (priorSale.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: priorSale[0].buyer_id === req.user.id
          ? 'You already own this edit.'
          : 'This one-of-one edit has already been sold.',
      });
    }

    const { rows: wallets } = await client.query(
      `
      SELECT balance
      FROM wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [req.user.id]
    );

    if (
      !wallets[0] ||
      wallets[0].balance < edit.price_points
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Not enough points.',
      });
    }

    await client.query(
      `
      UPDATE wallets
      SET balance = balance - $1,
          updated_at = NOW()
      WHERE user_id = $2
      `,
      [edit.price_points, req.user.id]
    );

    const { rows: purchases } = await client.query(
      `
      INSERT INTO purchases (
        buyer_id,
        edit_id,
        price_points,
        watermark_name,
        watermark_style
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
      `,
      [req.user.id, edit.id, edit.price_points, watermark.name, watermark.style]
    );

    await client.query(
      `
      INSERT INTO point_ledger (
        user_id,
        amount,
        reason,
        reference_id
      )
      VALUES ($1, $2, 'purchase', $3)
      `,
      [
        req.user.id,
        -edit.price_points,
        purchases[0].id,
      ]
    );

    await client.query(
      `
      UPDATE wallets
      SET balance = balance + $1,
          updated_at = NOW()
      WHERE user_id = $2
      `,
      [edit.price_points, edit.creator_id]
    );

    await client.query(
      `
      INSERT INTO point_ledger (
        user_id,
        amount,
        reason,
        reference_id
      )
      VALUES ($1, $2, 'sale', $3)
      `,
      [
        edit.creator_id,
        edit.price_points,
        purchases[0].id,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      purchase: purchases[0],
      pointsSpent: edit.price_points,
      message: 'Edit unlocked. Download it from your library.',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({ error: 'This edit has already been sold or is already in your library.' });
    }

    next(error);
  } finally {
    client.release();
  }
});

// Personalized copy: auth and ownership checks live in the handler.
router.get('/:id/download-personalized', auth, personalizedDownload(db));

// GET /api/edits/:id/download
// Download the original only if the user has purchased it.
router.get('/:id/download', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `
      SELECT e.original_path, e.original_filename
      FROM edits e
      JOIN purchases p ON p.edit_id = e.id
      WHERE e.id = $1
        AND p.buyer_id = $2
      `,
      [req.params.id, req.user.id]
    );

    if (!rows[0]) {
      return res.status(403).json({
        error: 'Purchase required to download this original.',
      });
    }

    if (!fs.existsSync(rows[0].original_path)) {
      return res.status(410).json({
        error: 'Original file is not available.',
      });
    }

    return res.download(
      rows[0].original_path,
      path.basename(rows[0].original_filename)
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
