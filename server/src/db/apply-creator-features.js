require('dotenv').config();
const db = require('./pool');

(async () => {
  try {
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_followers BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_followers_updated_at TIMESTAMPTZ;
      ALTER TABLE edits ADD COLUMN IF NOT EXISTS editing_software TEXT NOT NULL DEFAULT '';
      ALTER TABLE edits ADD COLUMN IF NOT EXISTS preview_start_seconds NUMERIC(10,2);
      ALTER TABLE edits ADD COLUMN IF NOT EXISTS preview_end_seconds NUMERIC(10,2);
    `);
    console.log('Creator profile and preview-trimming database fields are ready.');
  } catch (error) {
    console.error('Could not apply creator feature database changes:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
