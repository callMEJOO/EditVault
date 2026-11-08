require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const db = require('./src/db/pool');

async function main() {
  const result = await db.query(`
    SELECT id, title, status, created_at
    FROM edits
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.table(result.rows);
}

main()
  .catch(error => {
    console.error('Database check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());