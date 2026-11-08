require('dotenv').config();
const db = require('./pool');
(async () => {
  try {
    await db.query(`
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_name TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_style TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_mode TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_fee_points INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS manual_watermark_status TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS manual_watermark_note TEXT;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS manual_watermark_path TEXT;
      CREATE INDEX IF NOT EXISTS idx_purchases_watermark_free ON purchases (buyer_id) WHERE watermark_name IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_purchases_manual_watermark ON purchases (manual_watermark_status, created_at DESC) WHERE watermark_mode = 'manual';
    `);
    console.log('EditVault watermark pricing v2 migration applied successfully.');
  } catch (error) { console.error('Watermark v2 migration failed:', error); process.exitCode = 1; }
  finally { await db.end(); }
})();
