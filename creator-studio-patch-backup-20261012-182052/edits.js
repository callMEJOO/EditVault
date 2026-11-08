const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const db = require('../db/pool');
const { auth } = require('../middleware/auth');

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
        e.price_points,
        e.created_at,
        (e.preview_path IS NOT NULL) AS has_preview,
        u.id AS creator_id,
        u.display_name AS creator_name,
        u.tiktok_url,
        u.verification_status
      FROM edits e
      JOIN users u ON u.id = e.creator_id
      WHERE
        e.status = 'published'
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

    res.json({ edits: rows });
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

    res.type('video/mp4');
    res.set('Cache-Control', 'private, max-age=300');

    return res.sendFile(previewPath);
  } catch (error) {
    next(error);
  }
});

// POST /api/edits
// Upload a new original edit.
router.post(
  '/',
  auth,
  upload.single('original'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Upload an MP4, MOV, or WebM original video.',
        });
      }

      const {
        title,
        description = '',
        category = 'Other',
        pricePoints,
      } = req.body;

      const price = Number(pricePoints);

      if (
        !title?.trim() ||
        !Number.isInteger(price) ||
        price < 1 ||
        price > 100000
      ) {
        fs.unlinkSync(req.file.path);

        return res.status(400).json({
          error:
            'A title and price between 1 and 100000 points are required.',
        });
      }

      const { rows } = await db.query(
        `
        INSERT INTO edits (
          creator_id,
          title,
          description,
          category,
          price_points,
          original_path,
          original_filename
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          title,
          description,
          category,
          price_points,
          status,
          created_at
        `,
        [
          req.user.id,
          title.trim(),
          String(description).slice(0, 2000),
          String(category).slice(0, 40),
          price,
          req.file.path,
          req.file.originalname,
        ]
      );

      res.status(201).json({
        edit: rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/edits/mine/library
// Return edits purchased by the logged-in user.
router.get('/mine/library', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `
      SELECT
        p.id AS purchase_id,
        p.created_at AS purchased_at,
        e.id,
        e.title,
        e.category,
        e.price_points
      FROM purchases p
      JOIN edits e ON e.id = p.edit_id
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

// POST /api/edits/:id/purchase
// Purchase an edit using points.
router.post('/:id/purchase', auth, async (req, res, next) => {
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

    const { rows: prior } = await client.query(
      `
      SELECT id
      FROM purchases
      WHERE buyer_id = $1 AND edit_id = $2
      `,
      [req.user.id, edit.id]
    );

    if (prior.length) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error: 'You already own this edit.',
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
        price_points
      )
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [req.user.id, edit.id, edit.price_points]
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
      return res.status(409).json({
        error: 'You already own this edit.',
      });
    }

    next(error);
  } finally {
    client.release();
  }
});

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