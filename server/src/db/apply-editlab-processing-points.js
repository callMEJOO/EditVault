'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    await client.query('ALTER TABLE point_ledger DROP CONSTRAINT IF EXISTS point_ledger_reason_check');
    await client.query(`ALTER TABLE point_ledger ADD CONSTRAINT point_ledger_reason_check
      CHECK (reason IN ('purchase','sale','ad_reward','admin_adjustment','refund','referral_reward','editlab_processing'))`);
    await client.query('COMMIT');
    console.log('EditLab 10-point processing ledger migration applied.');
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* no open transaction */ }
    }
    console.error('EditLab processing points migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await db.end();
  }
}

main();
