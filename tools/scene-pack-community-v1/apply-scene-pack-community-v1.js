/** EditVault Scene Pack Community V1 — safe, repeatable migration. */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');
(async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE scene_packs DROP CONSTRAINT IF EXISTS scene_packs_status_check;
      ALTER TABLE scene_packs ADD CONSTRAINT scene_packs_status_check
        CHECK (status IN ('available','hidden','pending','rejected'));
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS asset_sha256 TEXT;
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'legacy';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_packs_unique_asset_sha256
        ON scene_packs(asset_sha256) WHERE asset_sha256 IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_scene_packs_submissions_created
        ON scene_packs(created_by, created_at DESC) WHERE submission_kind = 'community';
      CREATE TABLE IF NOT EXISTS scene_pack_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_pack_id UUID NOT NULL UNIQUE REFERENCES scene_packs(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points INTEGER NOT NULL CHECK(points > 0),
        awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_scene_pack_rewards_user_date
        ON scene_pack_rewards(user_id, awarded_at DESC);
    `);
    await client.query('COMMIT');
    console.log('SUCCESS: Scene Pack Community V1 schema is ready. Existing packs were preserved.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Scene Pack Community migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
})();
