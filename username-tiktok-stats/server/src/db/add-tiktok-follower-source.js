require('dotenv').config();
const db = require('./pool');

(async () => {
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_follower_source TEXT NOT NULL DEFAULT 'creator_reported'`);
    await client.query(`UPDATE users SET tiktok_follower_source = 'creator_reported' WHERE tiktok_follower_source IS NULL OR tiktok_follower_source = ''`);
    await client.query('COMMIT');
    console.log('TikTok follower source column is ready. Existing values remain marked as creator-reported until refreshed.');
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* no active transaction */ }
    }
    console.error('Could not add TikTok follower source column:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await db.end();
  }
})();
