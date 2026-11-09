const router = require('express').Router();
const db = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth, adminOnly);

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, creators, edits, published, purchases, points, pendingPremium, recentPurchases, complaints, payouts] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM users'),
      db.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'creator'"),
      db.query('SELECT COUNT(*)::int AS count FROM edits'),
      db.query("SELECT COUNT(*)::int AS count FROM edits WHERE status = 'published'"),
      db.query('SELECT COUNT(*)::int AS count FROM purchases'),
      db.query('SELECT COALESCE(SUM(balance), 0)::bigint AS total FROM wallets'),
      db.query("SELECT COUNT(*)::int AS count FROM premium_account_orders WHERE status = 'pending'"),
      db.query(`SELECT p.id, p.price_points, p.created_at, u.display_name AS buyer_name, u.email AS buyer_email, e.title AS edit_title, e.id AS edit_id FROM purchases p JOIN users u ON u.id = p.buyer_id JOIN edits e ON e.id = p.edit_id ORDER BY p.created_at DESC LIMIT 8`),
      db.query("SELECT COUNT(*)::int AS count FROM support_tickets WHERE status IN ('open','in_progress')"),
      db.query("SELECT COUNT(*)::int AS count FROM creator_payouts WHERE status = 'pending'")
    ]);
    res.json({ stats: {
      users: users.rows[0].count, creators: creators.rows[0].count, edits: edits.rows[0].count,
      publishedEdits: published.rows[0].count, purchases: purchases.rows[0].count,
      pointsInWallets: Number(points.rows[0].total || 0), pendingPremiumOrders: pendingPremium.rows[0].count,
      openComplaints: complaints.rows[0].count, pendingPayouts: payouts.rows[0].count
    }, recentPurchases: recentPurchases.rows });
  } catch (error) { next(error); }
});

router.get('/users', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 100);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.display_name, u.role, u.created_at, COALESCE(w.balance, 0)::int AS points_balance,
        (SELECT COUNT(*)::int FROM purchases p WHERE p.buyer_id = u.id) AS purchase_count,
        (SELECT COUNT(*)::int FROM edits e WHERE e.creator_id = u.id) AS edit_count
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
       ORDER BY u.created_at DESC LIMIT $2`, [search, limit]);
    res.json({ users: rows });
  } catch (error) { next(error); }
});

// Atomic, audited wallet adjustment. amount is always positive; direction controls sign.
router.post('/points-adjust', async (req, res, next) => {
  const client = await db.connect();
  try {
    const userId = String(req.body?.userId || '').trim();
    const amount = Number(req.body?.amount);
    const direction = String(req.body?.direction || '');
    const note = String(req.body?.note || '').trim().slice(0, 500);
    if (!userId || !Number.isSafeInteger(amount) || amount <= 0 || amount > 10000000 || !['credit','debit'].includes(direction) || note.length < 3) {
      return res.status(400).json({ error: 'Choose a user, enter a positive whole-number amount, choose add/deduct, and provide a reason (at least 3 characters).' });
    }
    await client.query('BEGIN');
    const user = await client.query('SELECT id, display_name, email FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!user.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found.' }); }
    await client.query('INSERT INTO wallets(user_id,balance) VALUES($1,0) ON CONFLICT(user_id) DO NOTHING', [userId]);
    const signedAmount = direction === 'credit' ? amount : -amount;
    const wallet = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [userId]);
    if (Number(wallet.rows[0].balance) + signedAmount < 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The user does not have enough points for this deduction.' }); }
    const updated = await client.query('UPDATE wallets SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2 RETURNING balance', [signedAmount, userId]);
    const ledger = await client.query('INSERT INTO point_ledger(user_id,amount,reason,admin_id,admin_note) VALUES($1,$2,\'admin_adjustment\',$3,$4) RETURNING id,amount,created_at', [userId, signedAmount, req.user.id, note]);
    await client.query('COMMIT');
    res.status(201).json({ user: user.rows[0], balance: updated.rows[0].balance, entry: ledger.rows[0] });
  } catch (error) { await client.query('ROLLBACK').catch(()=>{}); next(error); }
  finally { client.release(); }
});

// Bulk point grants: server-authorized, atomic, logged per recipient, and idempotent.
// Requires: node src/db/apply-admin-bulk-points.js once on the connected database.
router.get('/points-grant-all/preview', async (_req, res, next) => {
  try {
    const result = await db.query('SELECT COUNT(*)::int AS total FROM users');
    res.json({ recipientCount: result.rows[0].total });
  } catch (error) { next(error); }
});

router.get('/points-grants', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT g.id, g.points, g.note, g.recipient_count, g.created_at,
        u.display_name AS admin_name
      FROM admin_bulk_grants g LEFT JOIN users u ON u.id = g.admin_id
      ORDER BY g.created_at DESC LIMIT 30`);
    res.json({ grants: result.rows });
  } catch (error) { next(error); }
});

router.post('/points-grant-all', async (req, res, next) => {
  const amount = Number(req.body?.amount);
  const note = String(req.body?.note || '').trim();
  const requestId = String(req.body?.requestId || '').trim();
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000 ||
      note.length < 5 || note.length > 500 || !uuidPattern.test(requestId) ||
      req.body?.confirmation !== 'GRANT_TO_ALL') {
    return res.status(400).json({ error: 'Enter 1–100000 points, a reason (5–500 chars) and the required confirmation.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // A stale admin JWT must not grant points after an administrator is demoted.
    const admin = await client.query('SELECT id FROM users WHERE id=$1 AND role=$2', [req.user.id, 'admin']);
    if (!admin.rowCount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Administrator access was revoked.' });
    }
    const create = await client.query(`
      INSERT INTO admin_bulk_grants(id,admin_id,points,note)
      VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [requestId, req.user.id, amount, note]);
    if (!create.rowCount) {
      const existing = await client.query(
        'SELECT admin_id,points,note,recipient_count,created_at FROM admin_bulk_grants WHERE id=$1', [requestId]);
      await client.query('ROLLBACK');
      const grant = existing.rows[0];
      if (!grant || grant.admin_id !== req.user.id || Number(grant.points) !== amount || grant.note !== note) {
        return res.status(409).json({ error: 'Request ID was already used for a different grant.' });
      }
      return res.json({ alreadyApplied: true, recipientCount: grant.recipient_count, amount, requestId });
    }

    // Account for users with no wallet yet; every operation is in one DB transaction.
    await client.query(`INSERT INTO wallets(user_id,balance)
      SELECT id,0 FROM users ON CONFLICT(user_id) DO NOTHING`);
    const credited = await client.query(`
      WITH recipients AS (
        UPDATE wallets SET balance = balance + $1, updated_at = NOW()
        WHERE user_id IN (SELECT id FROM users)
        RETURNING user_id
      )
      INSERT INTO point_ledger(user_id,amount,reason,reference_id,idempotency_key,admin_id,admin_note)
      SELECT user_id,$1,'admin_adjustment',$2::uuid,
        'bulk:' || $2::text || ':' || user_id::text,$3::uuid,$4
      FROM recipients
      RETURNING id`, [amount, requestId, req.user.id, note]);
    const recipientCount = credited.rowCount;
    await client.query('UPDATE admin_bulk_grants SET recipient_count=$2 WHERE id=$1', [requestId, recipientCount]);
    await client.query('COMMIT');
    res.status(201).json({ amount, recipientCount, requestId, alreadyApplied: false });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

router.get('/edits', async (req, res, next) => {
  try {
    const status = ['draft', 'published', 'removed'].includes(String(req.query.status || '')) ? String(req.query.status) : null;
    const search = String(req.query.search || '').trim().slice(0, 100);
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.category, e.price_points, e.status, e.created_at, u.id AS creator_id, u.display_name AS creator_name, u.email AS creator_email,
       (SELECT COUNT(*)::int FROM purchases p WHERE p.edit_id = e.id) AS purchase_count
       FROM edits e JOIN users u ON u.id = e.creator_id WHERE ($1::text IS NULL OR e.status = $1)
       AND ($2 = '' OR e.title ILIKE '%' || $2 || '%' OR u.display_name ILIKE '%' || $2 || '%') ORDER BY e.created_at DESC LIMIT 200`, [status, search]);
    res.json({ edits: rows });
  } catch (error) { next(error); }
});

router.patch('/edits/:editId/status', async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    if (!['published', 'removed', 'draft'].includes(status)) return res.status(400).json({ error: 'Status must be published, removed, or draft.' });
    const { rows } = await db.query('UPDATE edits SET status=$1 WHERE id=$2 RETURNING id,title,status,creator_id,created_at', [status, req.params.editId]);
    if (!rows[0]) return res.status(404).json({ error: 'Edit not found.' });
    res.json({ edit: rows[0] });
  } catch (error) { next(error); }
});

router.get('/ledger', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const { rows } = await db.query(
      `SELECT l.id,l.amount,l.reason,l.reference_id,l.admin_note,l.created_at,u.id AS user_id,u.display_name,u.email, a.display_name AS admin_name
       FROM point_ledger l JOIN users u ON u.id=l.user_id LEFT JOIN users a ON a.id=l.admin_id ORDER BY l.created_at DESC LIMIT $1`, [limit]);
    res.json({ entries: rows });
  } catch (error) { next(error); }
});

router.get('/complaints', async (_req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT t.*,u.display_name AS user_name,u.email FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at DESC LIMIT 300`);
    res.json({ complaints: rows });
  } catch (error) { next(error); }
});
router.patch('/complaints/:ticketId', async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    const response = String(req.body?.adminResponse || '').trim().slice(0, 4000);
    if (!['open','in_progress','resolved','closed'].includes(status)) return res.status(400).json({ error: 'Invalid complaint status.' });
    const { rows } = await db.query(`UPDATE support_tickets SET status=$1,admin_response=$2,handled_by=$3,updated_at=NOW() WHERE id=$4 RETURNING *`, [status, response || null, req.user.id, req.params.ticketId]);
    if (!rows[0]) return res.status(404).json({ error: 'Complaint not found.' });
    res.json({ complaint: rows[0] });
  } catch (error) { next(error); }
});

router.get('/payouts', async (_req, res, next) => {
  try {
    const [payouts, creators] = await Promise.all([
      db.query(`SELECT p.*,u.display_name AS creator_name,u.email FROM creator_payouts p JOIN users u ON u.id=p.creator_id ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,p.created_at DESC LIMIT 300`),
      db.query(`SELECT u.id,u.display_name,u.email,COALESCE(SUM(CASE WHEN l.reason='sale' AND l.amount>0 THEN l.amount ELSE 0 END),0)::bigint AS lifetime_sale_points FROM users u LEFT JOIN point_ledger l ON l.user_id=u.id WHERE u.role='creator' GROUP BY u.id ORDER BY u.display_name`)
    ]);
    res.json({ payouts: payouts.rows, creators: creators.rows });
  } catch (error) { next(error); }
});
router.post('/payouts', async (req, res, next) => {
  try {
    const creatorId = String(req.body?.creatorId || '').trim();
    const amount = Number(req.body?.amount);
    const currency = String(req.body?.currency || 'USD').toUpperCase();
    const method = String(req.body?.method || '').trim().slice(0, 80);
    const reference = String(req.body?.reference || '').trim().slice(0, 200);
    const note = String(req.body?.note || '').trim().slice(0, 1000);
    if (!creatorId || !Number.isFinite(amount) || amount <= 0 || amount > 1000000 || !['USD','EUR','EGP','GBP'].includes(currency) || method.length < 2) return res.status(400).json({ error: 'Select a creator and enter a valid amount, currency and payout method.' });
    const creator = await db.query("SELECT id FROM users WHERE id=$1 AND role='creator'", [creatorId]);
    if (!creator.rows[0]) return res.status(404).json({ error: 'Creator account not found.' });
    const { rows } = await db.query(`INSERT INTO creator_payouts(creator_id,amount,currency,method,reference,admin_note,status,created_by) VALUES($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *`, [creatorId,amount,currency,method,reference||null,note||null,req.user.id]);
    res.status(201).json({ payout: rows[0] });
  } catch (error) { next(error); }
});
router.patch('/payouts/:payoutId', async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    const reference = String(req.body?.reference || '').trim().slice(0,200);
    const note = String(req.body?.note || '').trim().slice(0,1000);
    if (!['paid','rejected','pending'].includes(status)) return res.status(400).json({ error: 'Invalid payout status.' });
    const { rows } = await db.query(`UPDATE creator_payouts SET status=$1,reference=COALESCE(NULLIF($2,''),reference),admin_note=COALESCE(NULLIF($3,''),admin_note),paid_at=CASE WHEN $1='paid' THEN COALESCE(paid_at,NOW()) ELSE NULL END,updated_at=NOW(),handled_by=$4 WHERE id=$5 RETURNING *`, [status,reference,note,req.user.id,req.params.payoutId]);
    if (!rows[0]) return res.status(404).json({ error: 'Payout record not found.' });
    res.json({ payout: rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
