require('dotenv').config();
const db = require('./src/db/pool');

async function main() {
  try {
    await db.query(`
      ALTER TABLE edits
      ADD COLUMN IF NOT EXISTS editing_software
      VARCHAR(80) NOT NULL DEFAULT 'Other'
    `);

    console.log('SUCCESS: editing_software column is ready.');
  } catch (error) {
    console.error('MIGRATION ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
