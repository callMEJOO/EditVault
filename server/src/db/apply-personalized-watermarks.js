require('dotenv').config();
const db = require('./pool');
(async () => {
  try {
    await db.query(`
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_name TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_style TEXT;
    `);
    console.log('EditVault personalized watermark migration applied successfully.');
  } catch (error) {
    console.error('Personalized watermark migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
