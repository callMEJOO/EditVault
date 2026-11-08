require('dotenv').config();
const db = require('./src/db/pool');

async function main() {
  try {
    const result = await db.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('edits', 'users')
      ORDER BY table_name, ordinal_position
    `);

    console.table(result.rows);
  } catch (error) {
    console.error('DB ERROR:', error.message);
    console.error('ERROR CODE:', error.code);
  } finally {
    await db.end();
  }
}

main();
