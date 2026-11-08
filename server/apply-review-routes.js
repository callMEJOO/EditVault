const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'src', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.error('Could not find server/src/index.js. Run this script from the supplied server folder inside your project.');
  process.exit(1);
}
let source = fs.readFileSync(indexPath, 'utf8');
const original = source;
const requireLines = [
  "const creatorReviewsRoutes = require('./routes/creator-reviews');",
  "const adminCreatorsRoutes = require('./routes/admin-creators');",
];
for (const line of requireLines) {
  if (source.includes(line)) continue;
  const studioRequire = "const studioRoutes = require('./routes/studio');";
  if (source.includes(studioRequire)) {
    source = source.replace(studioRequire, `${studioRequire}\n${line}`);
    continue;
  }
  const appLine = 'const app = express();';
  if (source.includes(appLine)) {
    source = source.replace(appLine, `${line}\n${appLine}`);
    continue;
  }
  console.error(`Could not safely find an insertion point for: ${line}`);
  process.exit(1);
}
const mounts = [
  "app.use('/api/creator-reviews', creatorReviewsRoutes);",
  "app.use('/api/admin/creators', adminCreatorsRoutes);",
];
for (const line of mounts) {
  if (source.includes(line)) continue;
  const errorMiddleware = "app.use((err, _req, res, _next) => {";
  if (source.includes(errorMiddleware)) {
    source = source.replace(errorMiddleware, `${line}\n${errorMiddleware}`);
    continue;
  }
  const listenLine = /app\.listen\(port,/;
  if (listenLine.test(source)) {
    source = source.replace(listenLine, `${line}\napp.listen(port,`);
    continue;
  }
  console.error(`Could not safely find a mount point for: ${line}`);
  process.exit(1);
}
if (source === original) {
  console.log('Review and admin routes are already mounted; index.js was not changed.');
  process.exit(0);
}
const backupPath = `${indexPath}.backup-before-review-routes`;
if (!fs.existsSync(backupPath)) fs.copyFileSync(indexPath, backupPath);
fs.writeFileSync(indexPath, source, 'utf8');
console.log('Review and admin creator routes mounted in server/src/index.js.');
console.log(`Backup: ${backupPath}`);
