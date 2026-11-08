const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const REFERRER_POINTS = Math.max(1, Math.min(500, Number(process.env.REFERRER_REWARD_POINTS || 40)));
const FRIEND_POINTS = Math.max(1, Math.min(500, Number(process.env.REFERRED_REWARD_POINTS || 20)));

router.use(auth);

router.get('/summary', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified
       FROM referrals WHERE referrer_id = $1`,
      [req.user.id]
    );
    res.set('Cache-Control', 'no-store');
    res.json({
      referralCode: req.user.id,
      referrals: rows[0] || { total: 0, pending: 0, qualified: 0 },
      reward: { referrerPoints: REFERRER_POINTS, invitedMemberPoints: FRIEND_POINTS, requirement: 'Publish an edit or complete a marketplace purchase.' },
      pointType: 'in_platform_points',
    });
  } catch (error) { next(error); }
});

// Referral rewards are earned only after the invitee actually publishes an edit or completes a marketplace purchase.
// Either member may trigger this check; the server verifies the action from the database and awards each referral once.
router.post('/refresh', async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: referrals } = await client.query(
      `SELECT id, referrer_id, referred_id, status
       FROM referrals
       WHERE status = 'pending' AND (referrer_id = $1 OR referred_id = $1)
       ORDER BY created_at ASC
       FOR UPDATE`,
      [req.user.id]
    );

    let newlyQualified = 0;
    let pointsAdded = 0;
    for (const referral of referrals) {
      const { rows: activityRows } = await client.query(
        `SELECT
           EXISTS (SELECT 1 FROM edits WHERE creator_id = $1 AND status = 'published') AS has_published_edit,
           EXISTS (SELECT 1 FROM purchases WHERE buyer_id = $1) AS has_purchase`,
        [referral.referred_id]
      );
      const activity = activityRows[0];
      if (!activity?.has_published_edit && !activity?.has_purchase) continue;

      const { rows: updated } = await client.query(
        `UPDATE referrals SET status = 'qualified', qualified_at = NOW()
         WHERE id = $1 AND status = 'pending' RETURNING id`,
        [referral.id]
      );
      if (!updated.length) continue;

      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [REFERRER_POINTS, referral.referrer_id]
      );
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [FRIEND_POINTS, referral.referred_id]
      );
      await client.query(
        `INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
         VALUES ($1, $2, 'referral_reward', $3, $4), ($5, $6, 'referral_reward', $3, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [referral.referrer_id, REFERRER_POINTS, referral.id, `${referral.id}:referrer`, referral.referred_id, FRIEND_POINTS, `${referral.id}:referred`]
      );
      newlyQualified += 1;
      if (String(req.user.id) === String(referral.referrer_id)) pointsAdded += REFERRER_POINTS;
      if (String(req.user.id) === String(referral.referred_id)) pointsAdded += FRIEND_POINTS;
    }

    await client.query('COMMIT');
    res.json({ newlyQualified, pointsAdded, message: newlyQualified ? 'Referral rewards were added.' : 'No new referrals qualified yet.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may have ended */ }
    next(error);
  } finally { client.release(); }
});

module.exports = router;
