require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    await client.query(`
      -- Community scene packs need a stored cover file, not just an optional external image URL.
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS cover_file_path TEXT;
      ALTER TABLE scene_packs ADD COLUMN IF NOT EXISTS cover_original_name TEXT;

      -- Each line entered by the administrator becomes one saleable item. The route stores AES-GCM ciphertext here.
      CREATE TABLE IF NOT EXISTS premium_account_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES premium_accounts(id) ON DELETE CASCADE,
        credential_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),
        sold_to UUID REFERENCES users(id),
        sold_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK ((status = 'available' AND sold_to IS NULL AND sold_at IS NULL) OR
               (status = 'sold' AND sold_to IS NOT NULL AND sold_at IS NOT NULL))
      );
      ALTER TABLE premium_account_orders ADD COLUMN IF NOT EXISTS inventory_id UUID;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'premium_account_orders_inventory_id_fkey'
        ) THEN
          ALTER TABLE premium_account_orders
            ADD CONSTRAINT premium_account_orders_inventory_id_fkey
            FOREIGN KEY (inventory_id) REFERENCES premium_account_inventory(id) ON DELETE SET NULL;
        END IF;
      END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_orders_unique_inventory
        ON premium_account_orders(inventory_id) WHERE inventory_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_premium_inventory_available
        ON premium_account_inventory(account_id, created_at, id) WHERE status = 'available';
      CREATE INDEX IF NOT EXISTS idx_premium_inventory_sold_to
        ON premium_account_inventory(sold_to, sold_at DESC) WHERE status = 'sold';
    `);
    await client.query('COMMIT');
    console.log('V4 ready: scene-pack cover storage and secure premium-account inventory are configured.');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('V4 database upgrade failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await db.end().catch(() => {});
  }
}
main();
