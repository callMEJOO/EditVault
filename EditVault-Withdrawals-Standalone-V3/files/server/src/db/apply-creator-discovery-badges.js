// Idempotent EditVault community badge migration. Run: node src/db/apply-creator-discovery-badges.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('./pool');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from server/.env');
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '20261104_creator_discovery_badges.sql'), 'utf8');
  await pool.query(sql);
  console.log('EditVault creator discovery badges migration: OK');
})().catch((error) => {
  console.error('EditVault migration failed:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
