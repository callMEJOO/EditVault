require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./pool');
(async () => {
  try { await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); console.log('Database schema applied.'); }
  catch (e) { console.error('Failed to apply schema:', e.message); process.exitCode = 1; }
  finally { await db.end(); }
})();
