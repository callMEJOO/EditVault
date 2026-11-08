const router = require('express').Router();
const jwt = require('jsonwebtoken');
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Public reviews can optionally detect whether the visitor is an eligible buyer.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token && process.env.JWT_SECRET) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch { /* public reviews still load */ }
  }
  next();
}

async function getVerifiedCreator(creatorId) {
  const { rows } = await db.query(
    `SELECT id, display_name FROM users
     WHERE id = $1 AND role IN ('creator', 'admin') AND verification_status = 'verified'`,
    [creatorId]
  );
  return rows[0] || null;
}

async function hasPurchasedFrom(buyerId, creatorId) {
  if (!buyerId) return false;
  const { rows } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM purchases p
       JOIN edits e ON e.id = p.edit_id
       WHERE p.buyer_id = $1 AND e.creator_id = $2
     ) AS eligible`,
    [buyerId, creatorId]
  );
  return Boolean(rows[0]?.eligible);
}

async function reviewPayload(creatorId, viewerId = null) {
  const [{ rows: reviewRows }, { rows: summaryRows }] = await Promise.all([
    db.query(
      `SELECT r.id, r.rating, r.review_text, r.created_at, r.updated_at,
              u.display_name AS reviewer_name
       FROM creator_reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.creator_id = $1
       ORDER BY r.updated_at DESC, r.created_at DESC
       LIMIT 50`,
      [creatorId]
    ),
    db.query(
      `SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS average_rating,
              COUNT(*)::int AS review_count
       FROM creator_reviews WHERE creator_id = $1`,
      [creatorId]
    ),
  ]);
  let canReview = false;
  let myReview = null;
  if (viewerId) {
    canReview = await hasPurchasedFrom(viewerId, creatorId);
    const { rows } = await db.query(
      `SELECT id, rating, review_text, created_at, updated_at
       FROM creator_reviews WHERE creator_id = $1 AND reviewer_id = $2`,
      [creatorId, viewerId]
    );
    myReview = rows[0] || null;
  }
  return {
    reviews: reviewRows,
    summary: summaryRows[0] || { average_rating: 0, review_count: 0 },
    canReview,
    myReview,
  };
}

// GET /api/creator-reviews/:creatorId
router.get('/:creatorId', optionalAuth, async (req, res, next) => {
  try {
    const creatorId = String(req.params.creatorId || '');
    if (!UUID_RE.test(creatorId)) return res.status(400).json({ error: 'Invalid creator id.' });
    const creator = await getVerifiedCreator(creatorId);
    if (!creator) return res.status(404).json({ error: 'Verified creator not found.' });
    const payload = await reviewPayload(creatorId, req.user?.id || null);
    res.set('Cache-Control', 'no-store');
    res.json(payload);
  } catch (error) { next(error); }
});

// POST /api/creator-reviews/:creatorId; only a customer who bought from this creator may review.
router.post('/:creatorId', auth, async (req, res, next) => {
  try {
    const creatorId = String(req.params.creatorId || '');
    if (!UUID_RE.test(creatorId)) return res.status(400).json({ error: 'Invalid creator id.' });
    if (String(req.user.id) === creatorId) return res.status(403).json({ error: 'You cannot review your own creator page.' });

    const rating = Number(req.body?.rating);
    const reviewText = String(req.body?.reviewText || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
    }
    if (reviewText.length < 8 || reviewText.length > 1000) {
      return res.status(400).json({ error: 'Write a review between 8 and 1,000 characters.' });
    }

    const creator = await getVerifiedCreator(creatorId);
    if (!creator) return res.status(404).json({ error: 'Verified creator not found.' });
    const eligible = await hasPurchasedFrom(req.user.id, creatorId);
    if (!eligible) return res.status(403).json({ error: 'Reviews are available only to customers who purchased at least one edit from this creator.' });

    const { rows } = await db.query(
      `INSERT INTO creator_reviews (creator_id, reviewer_id, rating, review_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (creator_id, reviewer_id)
       DO UPDATE SET rating = EXCLUDED.rating,
                     review_text = EXCLUDED.review_text,
                     updated_at = NOW()
       RETURNING id, rating, review_text, created_at, updated_at`,
      [creatorId, req.user.id, rating, reviewText]
    );
    const payload = await reviewPayload(creatorId, req.user.id);
    res.status(200).json({ ...payload, review: rows[0], message: 'Your review was saved.' });
  } catch (error) { next(error); }
});

module.exports = router;
