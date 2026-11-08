require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS creator_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT NOT NULL CHECK (char_length(review_text) BETWEEN 8 AND 1000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT creator_reviews_unique_reviewer UNIQUE (creator_id, reviewer_id),
        CONSTRAINT creator_reviews_not_self CHECK (creator_id <> reviewer_id)
      );
      CREATE INDEX IF NOT EXISTS idx_creator_reviews_creator_created
        ON creator_reviews (creator_id, created_at DESC);
    `);
    console.log('Creator reviews migration applied.');
  } catch (error) {
    console.error('Creator reviews migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
