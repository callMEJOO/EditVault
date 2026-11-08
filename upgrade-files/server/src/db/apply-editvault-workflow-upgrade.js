'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tiktok_url TEXT NOT NULL,
        applicant_note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected')),
        admin_note TEXT,
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_creator_applications_status_created
        ON creator_applications(status, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_creator_applications_user_created
        ON creator_applications(user_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_applications_one_pending_per_user
        ON creator_applications(user_id) WHERE status = 'pending';

      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT '1080p';
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS asset_path TEXT;
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS asset_filename TEXT;
      ALTER TABLE scene_packs ALTER COLUMN asset_url DROP NOT NULL;
    `);

    // Preserve legacy pending requests that were previously coupled to the public profile URL.
    await client.query(`
      INSERT INTO creator_applications (user_id, tiktok_url, applicant_note, status, created_at)
      SELECT u.id, u.tiktok_url, 'Migrated from the previous creator access request flow.', 'pending', u.created_at
      FROM users u
      WHERE u.role <> 'admin'
        AND u.verification_status = 'pending'
        AND NULLIF(BTRIM(u.tiktok_url), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM creator_applications a
          WHERE a.user_id = u.id AND a.status = 'pending'
        )
    `);

    // Creator application state now lives in creator_applications, not public profile settings.
    await client.query(`
      UPDATE users u SET verification_status = 'not_requested'
      WHERE u.role <> 'admin' AND u.verification_status = 'pending'
    `);
    await client.query('COMMIT');
    console.log('EditVault workflow upgrade applied: separate creator applications and scene-pack uploads enabled.');
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    }
    console.error('EditVault workflow upgrade failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await db.end().catch(() => {});
  }
}

main();
