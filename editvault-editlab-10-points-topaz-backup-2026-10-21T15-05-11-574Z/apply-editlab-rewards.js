require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        qualified_at TIMESTAMPTZ,
        CHECK (referrer_id <> referred_id)
      );
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created ON referrals(referrer_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_referrals_pending ON referrals(status, created_at) WHERE status = 'pending';
    `);
    await client.query('ALTER TABLE point_ledger DROP CONSTRAINT IF EXISTS point_ledger_reason_check');
    await client.query(`ALTER TABLE point_ledger ADD CONSTRAINT point_ledger_reason_check
      CHECK (reason IN ('purchase','sale','ad_reward','admin_adjustment','refund','referral_reward','editlab_processing'))`);
    await client.query('COMMIT');
    console.log('EditLab and referral rewards migration applied.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* no open transaction */ }
    console.error('EditLab/rewards migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}
main();
