'use strict';

const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(['accepted', 'declined', 'quoted', 'in_progress', 'delivered', 'cancelled']);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function safeOptionalUrl(value) {
  const raw = cleanText(value, 1200);
  if (!raw) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid reference URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Reference URL must use HTTP or HTTPS.');
  return parsed.toString();
}

router.post('/', auth, async (req, res, next) => {
  try {
    const requesterId = req.user?.id;
    const creatorId = String(req.body?.creatorId || req.body?.creator_id || '');
    const title = cleanText(req.body?.title, 120);
    const brief = cleanText(req.body?.brief, 4000);
    const category = cleanText(req.body?.category, 80) || 'Custom edit';
    const deadlineRaw = cleanText(req.body?.deadline, 10);
    const budgetRaw = req.body?.budgetPoints;
    const budgetPoints = budgetRaw === '' || budgetRaw === null || budgetRaw === undefined ? null : Number(budgetRaw);
    let referenceUrl;

    if (!requesterId) return res.status(401).json({ error: 'Please sign in again.' });
    if (!UUID_RE.test(creatorId)) return res.status(400).json({ error: 'Invalid creator profile.' });
    if (creatorId === requesterId) return res.status(400).json({ error: 'You cannot request an edit from your own account.' });
    if (title.length < 3) return res.status(400).json({ error: 'The request title must contain at least 3 characters.' });
    if (brief.length < 15) return res.status(400).json({ error: 'Please describe the edit in at least 15 characters.' });
    if (budgetPoints !== null && (!Number.isSafeInteger(budgetPoints) || budgetPoints < 0 || budgetPoints > 1000000)) {
      return res.status(400).json({ error: 'Budget must be a whole number between 0 and 1,000,000 points.' });
    }
    let deadline = null;
    if (deadlineRaw) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) || Number.isNaN(Date.parse(`${deadlineRaw}T12:00:00Z`))) {
        return res.status(400).json({ error: 'Enter a valid deadline.' });
      }
      deadline = deadlineRaw;
    }
    try { referenceUrl = safeOptionalUrl(req.body?.referenceUrl); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    const creatorResult = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'creator'", [creatorId]);
    if (!creatorResult.rows[0]) return res.status(404).json({ error: 'Creator profile not found.' });

    const { rows } = await db.query(
      `INSERT INTO custom_edit_requests
         (requester_id, creator_id, title, brief, category, reference_url, deadline, budget_points, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'requested')
       RETURNING id, requester_id, creator_id, title, brief, category, reference_url, deadline, budget_points, quote_points, creator_note, status, created_at, updated_at`,
      [requesterId, creatorId, title, brief, category, referenceUrl, deadline, budgetPoints]
    );
    res.status(201).json({ request: rows[0], message: 'Your custom edit request was sent to the creator.' });
  } catch (error) { next(error); }
});

router.get('/mine', auth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
    const { rows } = await db.query(
      `SELECT r.id, r.requester_id, r.creator_id, r.title, r.brief, r.category,
              r.reference_url, r.deadline, r.budget_points, r.quote_points, r.creator_note,
              r.status, r.created_at, r.updated_at,
              requester.display_name AS requester_name,
              creator.display_name AS creator_name
       FROM custom_edit_requests r
       JOIN users requester ON requester.id = r.requester_id
       JOIN users creator ON creator.id = r.creator_id
       WHERE r.requester_id = $1 OR r.creator_id = $1
       ORDER BY r.updated_at DESC, r.created_at DESC
       LIMIT 200`,
      [userId]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ requests: rows });
  } catch (error) { next(error); }
});

router.patch('/:id/status', auth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const requestId = String(req.params.id || '');
    const status = String(req.body?.status || '');
    const quoteRaw = req.body?.quotePoints;
    const quotePoints = quoteRaw === null || quoteRaw === undefined || quoteRaw === '' ? null : Number(quoteRaw);
    if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
    if (!UUID_RE.test(requestId)) return res.status(400).json({ error: 'Invalid request id.' });
    if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ error: 'Unsupported request status.' });
    if (status === 'quoted' && (!Number.isSafeInteger(quotePoints) || quotePoints < 1 || quotePoints > 1000000)) {
      return res.status(400).json({ error: 'Enter a valid offer between 1 and 1,000,000 points.' });
    }

    const { rows: found } = await db.query(
      `SELECT id, requester_id, creator_id, status FROM custom_edit_requests WHERE id = $1`, [requestId]
    );
    const request = found[0];
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    let allowed = false;
    if (request.creator_id === userId) {
      allowed = (status === 'accepted' && request.status === 'requested')
        || (status === 'declined' && request.status === 'requested')
        || (status === 'quoted' && ['requested', 'accepted'].includes(request.status))
        || (status === 'in_progress' && request.status === 'accepted')
        || (status === 'delivered' && request.status === 'in_progress');
    } else if (request.requester_id === userId) {
      allowed = (status === 'accepted' && request.status === 'quoted')
        || (status === 'cancelled' && ['requested', 'quoted', 'accepted'].includes(request.status));
    }
    if (!allowed) return res.status(403).json({ error: 'This status change is not allowed for your account or the current request state.' });

    const creatorNote = request.creator_id === userId ? cleanText(req.body?.creatorNote, 1200) || null : null;
    const { rows: updated } = await db.query(
      `UPDATE custom_edit_requests
       SET status = $2,
           quote_points = CASE WHEN $2 = 'quoted' THEN $3 ELSE quote_points END,
           creator_note = CASE WHEN $4::text IS NULL THEN creator_note ELSE $4 END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, requester_id, creator_id, title, brief, status, quote_points, creator_note, updated_at`,
      [requestId, status, quotePoints, creatorNote]
    );
    res.json({ request: updated[0], message: 'Request status updated.' });
  } catch (error) { next(error); }
});

module.exports = router;
