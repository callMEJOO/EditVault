require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./pool');
(async () => {
  try {
    const file = path.join(__dirname, 'admin-bulk-points.sql');
    await db.query(fs.readFileSync(file, 'utf8'));
    console.log('EditVault bulk grant schema installed.');
  } catch (error) {
    console.error('Bulk grant schema failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
