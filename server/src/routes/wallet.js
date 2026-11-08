const router = require('express').Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');
router.get('/', auth, async (req, res, next) => {
  try {
    const [{ rows: wallet }, { rows: ledger }] = await Promise.all([
      db.query('SELECT balance FROM wallets WHERE user_id=$1', [req.user.id]),
      db.query('SELECT amount,reason,reference_id,created_at FROM point_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id])
    ]);
    res.json({ balance: wallet[0]?.balance ?? 0, ledger });
  } catch (e) { next(e); }
});
// Reward points must only be credited by a provider's authenticated server-to-server callback.
router.post('/reward-ad', (_req, res) => res.status(501).json({ error: 'Rewarded ads are not enabled. Configure a provider callback and verify its signature before crediting points.' }));
module.exports = router;
