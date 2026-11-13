'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql = fs.readFileSync(path.join(__dirname, 'offerwall-ads.sql'), 'utf8');
  await pool.query(sql);
  console.log('Offerwall rewards database migration applied.');
})().catch((error) => {
  console.error('Offerwall migration failed:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
