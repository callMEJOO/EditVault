require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./pool');

async function main() {
  try {
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data_url TEXT;');
    console.log('Profile photo migration applied.');
  } catch (error) {
    console.error('Profile photo migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
