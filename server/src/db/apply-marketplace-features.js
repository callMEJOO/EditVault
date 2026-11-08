require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS scene_packs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Scene Pack',
        price_points INTEGER NOT NULL CHECK (price_points > 0),
        cover_url TEXT,
        asset_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','hidden')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_scene_packs_status_created ON scene_packs(status, created_at DESC);

      CREATE TABLE IF NOT EXISTS scene_pack_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scene_pack_id UUID NOT NULL REFERENCES scene_packs(id) ON DELETE CASCADE,
        price_points INTEGER NOT NULL CHECK (price_points > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (buyer_id, scene_pack_id)
      );
      CREATE INDEX IF NOT EXISTS idx_scene_pack_purchases_buyer ON scene_pack_purchases(buyer_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS clip_assembly_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
        style TEXT NOT NULL DEFAULT '',
        target_duration TEXT NOT NULL DEFAULT '',
        source_links TEXT NOT NULL DEFAULT '',
        budget_points INTEGER CHECK (budget_points IS NULL OR budget_points BETWEEN 0 AND 100000),
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','quoted','in_progress','completed','cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_clip_assembly_requests_user_created ON clip_assembly_requests(requester_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clip_assembly_requests_status_created ON clip_assembly_requests(status, created_at DESC);
    `);
    console.log('Marketplace features migration applied.');
  } catch (error) {
    console.error('Marketplace features migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
main();
