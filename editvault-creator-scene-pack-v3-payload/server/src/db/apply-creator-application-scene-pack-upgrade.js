require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS creator_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tiktok_url TEXT NOT NULL,
        portfolio_url TEXT,
        message TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        admin_note TEXT NOT NULL DEFAULT '',
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_applications_one_pending_per_user
        ON creator_applications(user_id) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_creator_applications_queue
        ON creator_applications(status, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_creator_applications_user_created
        ON creator_applications(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS scene_packs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Scene Pack',
        quality TEXT NOT NULL DEFAULT '1080p',
        price_points INTEGER NOT NULL CHECK (price_points > 0),
        cover_url TEXT,
        asset_url TEXT,
        asset_file_path TEXT,
        asset_original_name TEXT,
        cover_file_path TEXT,
        cover_original_name TEXT,
        status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','hidden')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT '1080p';
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS asset_file_path TEXT;
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS asset_original_name TEXT;
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS cover_file_path TEXT;
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS cover_original_name TEXT;
      ALTER TABLE scene_packs ALTER COLUMN asset_url DROP NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_scene_packs_status_created ON scene_packs(status, created_at DESC);

      -- Digital account inventory is private: only admins write stock; each purchase consumes one row.
      CREATE TABLE IF NOT EXISTS premium_account_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES premium_accounts(id) ON DELETE CASCADE,
        delivery_payload TEXT NOT NULL CHECK (char_length(trim(delivery_payload)) BETWEEN 1 AND 5000),
        status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),
        buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        order_id UUID REFERENCES premium_account_orders(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sold_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_premium_inventory_stock
        ON premium_account_inventory(account_id, status, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_premium_inventory_buyer
        ON premium_account_inventory(buyer_id, sold_at DESC) WHERE status = 'sold';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_inventory_one_item_per_order
        ON premium_account_inventory(order_id) WHERE order_id IS NOT NULL;

      -- Preserve applications submitted by the previous version, which stored them on users.verification_status.
      INSERT INTO creator_applications (user_id, tiktok_url, portfolio_url, message, status)
      SELECT u.id, u.tiktok_url, NULL, '', 'pending'
      FROM users u
      WHERE u.role <> 'admin'
        AND u.verification_status = 'pending'
        AND COALESCE(TRIM(u.tiktok_url), '') <> ''
        AND NOT EXISTS (
          SELECT 1 FROM creator_applications a
          WHERE a.user_id = u.id AND a.status = 'pending'
        )
      ON CONFLICT DO NOTHING;

      UPDATE users u
      SET verification_status = 'not_requested', verification_note = NULL
      WHERE u.role <> 'admin'
        AND u.verification_status = 'pending'
        AND EXISTS (
          SELECT 1 FROM creator_applications a
          WHERE a.user_id = u.id AND a.status = 'pending'
        );
    `);
    console.log('Creator applications, scene-pack covers, and private instant-delivery account inventory are ready.');
  } catch (error) {
    console.error('Creator application / scene pack / account inventory upgrade failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}
main();
