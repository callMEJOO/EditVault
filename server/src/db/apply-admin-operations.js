require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./pool');
(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'admin-operations.sql'), 'utf8');
    await db.query(sql);
    console.log('EditVault admin operations migration applied successfully.');
  } catch (error) {
    console.error('Admin operations migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
