const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, 'src', 'index.js');
if (!fs.existsSync(indexPath)) { console.error('Could not find server/src/index.js.'); process.exit(1); }
let source = fs.readFileSync(indexPath, 'utf8');
const original = source;
const imports = [
  "const creatorReviewsRoutes = require('./routes/creator-reviews');",
  "const profileMediaRoutes = require('./routes/profile-media');",
  "const adminCreatorsRoutes = require('./routes/admin-creators');",
  "const marketplaceRoutes = require('./routes/marketplace');",
  "const accountSettingsRoutes = require('./routes/account-settings');",
];
for (const line of imports) {
  if (source.includes(line)) continue;
  const preferred = "const premiumRoutes = require('./routes/premium');";
  if (source.includes(preferred)) source = source.replace(preferred, `${preferred}\n${line}`);
  else {
    const appLine = 'const app = express();';
    if (!source.includes(appLine)) { console.error(`Could not safely insert ${line}`); process.exit(1); }
    source = source.replace(appLine, `${line}\n${appLine}`);
  }
}
const mounts = [
  "app.use('/api/profile', profileMediaRoutes);",
  "app.use('/api/creator-reviews', creatorReviewsRoutes);",
  "app.use('/api/admin/creators', adminCreatorsRoutes);",
  "app.use('/api/marketplace', marketplaceRoutes);",
  "app.use('/api/account-settings', accountSettingsRoutes);",
];
for (const line of mounts) {
  if (source.includes(line)) continue;
  const errorMiddleware = "app.use((err, _req, res, _next) => {";
  if (!source.includes(errorMiddleware)) { console.error(`Could not safely find error middleware to insert ${line}`); process.exit(1); }
  source = source.replace(errorMiddleware, `${line}\n${errorMiddleware}`);
}
if (source === original) { console.log('All marketplace, review, and account settings routes are already mounted. No changes made.'); process.exit(0); }
const backupPath = `${indexPath}.backup-before-platform-features`;
if (!fs.existsSync(backupPath)) fs.copyFileSync(indexPath, backupPath);
fs.writeFileSync(indexPath, source, 'utf8');
console.log('Platform, creator review, and account settings routes mounted successfully.');
console.log(`Backup created at: ${backupPath}`);
