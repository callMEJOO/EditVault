'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_edit_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(120) NOT NULL,
        brief TEXT NOT NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'Custom edit',
        reference_url TEXT,
        deadline DATE,
        budget_points INTEGER CHECK (budget_points IS NULL OR budget_points >= 0),
        quote_points INTEGER CHECK (quote_points IS NULL OR quote_points > 0),
        creator_note TEXT,
        status VARCHAR(24) NOT NULL DEFAULT 'requested'
          CHECK (status IN ('requested', 'quoted', 'accepted', 'declined', 'in_progress', 'delivered', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (requester_id <> creator_id)
      );
      CREATE INDEX IF NOT EXISTS idx_custom_edit_requests_creator_updated
        ON custom_edit_requests (creator_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_custom_edit_requests_requester_updated
        ON custom_edit_requests (requester_id, updated_at DESC);
    `);
    console.log('Custom edit request tables/indexes are ready.');
  } catch (error) {
    console.error('Custom edit request migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}

main();
