'use strict';
// Offerwall.me integration. NEVER award points based on an unverified browser event.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const enabled = () => process.env.REWARDED_ADS_ENABLED === 'true'
  && Boolean(process.env.OFFERWALL_PUBLIC_KEY && process.env.OFFERWALL_PRIVATE_KEY);
const secret = () => process.env.OFFERWALL_PRIVATE_KEY || '';
const publicKey = () => process.env.OFFERWALL_PUBLIC_KEY || '';

router.get('/status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: enabled(), provider: 'offerwall', requiresLogin: true, rewardType: 'in_platform_points' });
});

// Always use the identity from the verified JWT; never trust a user ID sent by the browser.
router.get('/link', auth, (req, res) => {
  if (!enabled()) return res.status(503).json({ error: 'Rewarded ads are not available yet.' });
  const uid = String(req.user?.id || '');
  if (!UUID_RE.test(uid)) return res.status(401).json({ error: 'Invalid session' });
  const expires = String(Math.floor(Date.now() / 1000) + 3600);
  const message = `offerwall-user-v1\n${publicKey()}\n${uid}\n${expires}`;
  const signature = crypto.createHmac('sha256', secret()).update(message, 'utf8').digest('hex');
  const url = new URL(`https://offerwall.me/offerwall/${encodeURIComponent(publicKey())}/${encodeURIComponent(uid)}`);
  url.searchParams.set('identityExpires', expires);
  url.searchParams.set('identitySignature', signature);
  res.set('Cache-Control', 'no-store');
  res.json({ url: url.toString(), expiresAt: new Date(Number(expires) * 1000).toISOString() });
});

router.get('/history', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT transaction_id, reward_points, credited_to_wallet, status, created_at, reversed_at
         FROM offerwall_reward_events WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 30`, [req.user.id]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ events: rows });
  } catch (e) { next(e); }
});

// Provider sends a POST (x-www-form-urlencoded or JSON), not a request from the UI.
router.post('/offerwall/postback', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
  if (!enabled()) return res.status(503).send('disabled');
  const body = req.body || {};
  const uid = String(body.subId || '');
  const txid = String(body.transId || '');
  const rawReward = String(body.reward ?? '');
  const sig = String(body.signature || '');
  const status = String(body.status || '1');

  if (!UUID_RE.test(uid) || !/^[a-z0-9_.:-]{1,150}$/i.test(txid)
    || !/^(?:[0-9]{1,4})(?:\.[0-9]{1,4})?$/.test(rawReward)
    || !['1', '2'].includes(status) || !/^[0-9a-f]{32}$/i.test(sig)) {
    return res.status(400).send('invalid');
  }
  const points = Number(rawReward);
  // Bound the amount a single callback can credit, independent of the caller's input.
  if (!Number.isSafeInteger(points) || points > 5000) return res.status(400).send('invalid reward');

  const calculated = crypto.createHash('md5').update(uid + txid + rawReward + secret(), 'utf8').digest();
  const provided = Buffer.from(sig, 'hex');
  if (provided.length !== calculated.length || !crypto.timingSafeEqual(provided, calculated)) {
    return res.status(403).send('invalid signature');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Serialize all reward and reversal operations for a user against the wallet row.
    const exists = await client.query('SELECT id FROM users WHERE id = $1', [uid]);
    if (!exists.rowCount) { await client.query('ROLLBACK'); return res.status(404).send('unknown user'); }
    await client.query('INSERT INTO wallets(user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING', [uid]);
    const { rows: walletRows } = await client.query('SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE', [uid]);
    const balance = Number(walletRows[0].balance);

    const { rows: existingRows } = await client.query(
      'SELECT * FROM offerwall_reward_events WHERE transaction_id = $1 FOR UPDATE', [txid]
    );
    const existing = existingRows[0];
    if (existing && (String(existing.user_id) !== uid || Number(existing.reward_points) !== points)) {
      await client.query('ROLLBACK');
      return res.status(409).send('transaction mismatch');
    }

    if (status === '2') {
      if (!existing) {
        // A reversal can arrive before the original credit: tombstone prevents late credit.
        await client.query(
          `INSERT INTO offerwall_reward_events(transaction_id, user_id, reward_points, credited_to_wallet, status, reversed_at)
           VALUES ($1,$2,$3,0,'reversed',NOW())`, [txid, uid, points]
        );
      } else if (existing.status !== 'reversed') {
        const deducted = Math.min(balance, points);
        const unpaid = points - deducted;
        if (deducted > 0) {
          await client.query('UPDATE wallets SET balance = balance - $1, updated_at=NOW() WHERE user_id=$2', [deducted, uid]);
          await client.query(
            `INSERT INTO point_ledger(user_id,amount,reason,idempotency_key)
             VALUES($1,$2,'ad_reward',$3) ON CONFLICT(idempotency_key) DO NOTHING`,
            [uid, -deducted, `offerwall:${txid}:reverse`]
          );
        }
        await client.query(
          `UPDATE offerwall_reward_events SET status='reversed', reversed_at=NOW(), outstanding_reversal_points=$2
           WHERE transaction_id=$1`, [txid, unpaid]
        );
      }
    } else if (!existing) {
      let remaining = points;
      // On a chargeback where the wallet was already spent, recover from future rewards first.
      const debts = await client.query(
        `SELECT transaction_id, outstanding_reversal_points FROM offerwall_reward_events
         WHERE user_id=$1 AND outstanding_reversal_points > 0
         ORDER BY created_at ASC FOR UPDATE`, [uid]
      );
      for (const debt of debts.rows) {
        if (remaining <= 0) break;
        const offset = Math.min(remaining, Number(debt.outstanding_reversal_points));
        remaining -= offset;
        await client.query(
          `UPDATE offerwall_reward_events SET outstanding_reversal_points=outstanding_reversal_points-$1
           WHERE transaction_id=$2`, [offset, debt.transaction_id]
        );
      }
      await client.query(
        `INSERT INTO offerwall_reward_events(transaction_id,user_id,reward_points,credited_to_wallet,status)
         VALUES($1,$2,$3,$4,'credited')`, [txid, uid, points, remaining]
      );
      if (remaining > 0) {
        await client.query('UPDATE wallets SET balance = balance + $1, updated_at=NOW() WHERE user_id=$2', [remaining, uid]);
        await client.query(
          `INSERT INTO point_ledger(user_id,amount,reason,idempotency_key)
           VALUES($1,$2,'ad_reward',$3) ON CONFLICT(idempotency_key) DO NOTHING`,
          [uid, remaining, `offerwall:${txid}:credit`]
        );
      }
    }
    await client.query('COMMIT');
    res.type('text/plain').send('ok');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignored */ }
    console.error('Offerwall postback failed:', error.message);
    res.status(500).type('text/plain').send('error');
  } finally { client.release(); }
});

module.exports = router;
