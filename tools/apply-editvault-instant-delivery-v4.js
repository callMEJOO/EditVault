const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const payloadRoot = path.resolve(__dirname, '..', 'upgrade-files');
const replacementFiles = {
  'client/src/main.jsx': '6a8c1b577ed9c1902c1d9c6fab9b7bbb4aa0a914f4add0abbc22ed4a88e01671',
  'client/src/MarketplaceSections.jsx': '25d79ad1d09c9a9d7622d823fd7135c4588757764361e49369c5a288f3f9a353',
  'client/src/styles.css': '599b08f1a3854a7c4b1b5af8cd58dcbe19f1989f1b834124cf7779dcc062f59e',
  'client/src/marketplace-workflow.css': 'da4e53119b14b275102db142a5d19376d4f437476317934cbeaee0d055056c58',
  'server/src/routes/marketplace.js': '9fbfcec1c680427dff4a943b41473cf0128763aa843d1e5649ac8c454dd543a6',
  'server/src/routes/premium.js': 'e14e46bb7f04fd60c5985d1df56a3f25ac0ebdbedee83f876680feca9c8b21e7',
  'server/src/index.js': '7fcebe5b1a0c5ca5bed1b93e65f486a586f138a95d615e414f64623aaa85e63b',
};
const compatibilityFiles = {
  'server/src/db/schema.sql': '5195e03cd93ad6e43ce85881cfbf9d78c4e9b50726c2c16518b3df8b8f831b53',
  'server/src/db/apply-marketplace-features.js': 'd1fe2afc8fa91b4e168ce202fc7fffbd3a6d3f063f45c1057aaaf429ae40ae53',
  'server/src/db/apply-creator-application-scene-pack-upgrade.js': 'f6249fb05254ca4c76c5189b3fcde9a51d1dab7d4ba9cccb24a25ae934f444f0',
  'server/src/db/pool.js': 'dbcd9f4f8cdc069c8641f28b6f7e3600df87fae9ce6fb9f9f74a25c6a4200207',
};
const requiredPaths = [
  'client/package.json', 'server/package.json', 'server/src/middleware/auth.js',
  'server/src/routes/auth.js', 'server/src/db/pool.js',
];
const migrationPath = 'server/src/db/apply-v4-premium-inventory-scene-covers.js';

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function projectPath(relativePath) { return path.join(root, ...relativePath.split('/')); }
function payloadPath(relativePath) { return path.join(payloadRoot, ...relativePath.split('/')); }

if (!fs.existsSync(projectPath('client/src/main.jsx')) || !fs.existsSync(projectPath('server/package.json'))) {
  console.error('Run this installer from the EditVault project root (the folder containing client and server).');
  process.exit(1);
}

const errors = [];
for (const relativePath of requiredPaths) {
  if (!fs.existsSync(projectPath(relativePath))) errors.push(`${relativePath} (required file is missing)`);
}
for (const [relativePath, expectedHash] of Object.entries(replacementFiles)) {
  const target = projectPath(relativePath);
  const source = payloadPath(relativePath);
  if (!fs.existsSync(target)) errors.push(`${relativePath} (project file is missing)`);
  else if (hashFile(target) !== expectedHash) errors.push(`${relativePath} (different source version)`);
  if (!fs.existsSync(source)) errors.push(`update package: ${relativePath} (payload file is missing)`);
}
for (const [relativePath, expectedHash] of Object.entries(compatibilityFiles)) {
  const target = projectPath(relativePath);
  if (!fs.existsSync(target)) errors.push(`${relativePath} (required database baseline is missing)`);
  else if (hashFile(target) !== expectedHash) errors.push(`${relativePath} (database schema baseline differs)`);
}
const migrationSource = payloadPath(migrationPath);
if (!fs.existsSync(migrationSource)) errors.push(`update package: ${migrationPath} (payload file is missing)`);
else if (fs.existsSync(projectPath(migrationPath)) && hashFile(projectPath(migrationPath)) !== hashFile(migrationSource)) {
  errors.push(`${migrationPath} (a different migration already exists)`);
}

if (errors.length) {
  console.error('Update stopped safely. No project files were changed:');
  for (const error of errors) console.error(` - ${error}`);
  console.error('Keep this output and send it before retrying. Do not run the database migration.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(root, '.editvault-backups', `instant-delivery-v4-${stamp}`);
try {
  fs.mkdirSync(backupRoot, { recursive: true });
  for (const relativePath of Object.keys(replacementFiles)) {
    const source = projectPath(relativePath);
    const backup = path.join(backupRoot, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(source, backup);
  }
  for (const relativePath of Object.keys(replacementFiles)) {
    const source = payloadPath(relativePath);
    const target = projectPath(relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  fs.mkdirSync(path.dirname(projectPath(migrationPath)), { recursive: true });
  fs.copyFileSync(migrationSource, projectPath(migrationPath));
  console.log('EditVault V4 source update applied successfully.');
  console.log(`Backup: ${backupRoot}`);
  console.log('Next: run the V4 database migration only now that source installation has succeeded.');
} catch (error) {
  console.error(`Installer failed: ${error.message}`);
  console.error(`Backups of original source files are at: ${backupRoot}`);
  console.error('Do not run the database migration until the source update is repaired.');
  process.exit(1);
}
