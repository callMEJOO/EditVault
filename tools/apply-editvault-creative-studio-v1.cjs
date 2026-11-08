/* EditVault Creative Studio V1 — safe installer; no database or server changes. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const payload = path.join(__dirname, 'creative-studio-v1-files', 'client', 'src');
const sourceDir = path.join(root, 'client', 'src');
const originals = {
  "main.jsx": "5a9de1bb86c82604701f379c3c5e82cc5e84c683314b6972cdf71c7c0dca5052",
  "EditLabRewards.jsx": "70b5737c146a4cf2e0b077b79608bf8ad2b74821e8955632430446f5cac22ed4"
};
const targets = ["main.jsx", "EditLabRewards.jsx", "CreativeStudio.jsx", "creative-studio.css"];
const expected = {
  "main.jsx": "0cc1ddb4298e5d4182b784aa2d8472d409bf813cefa6b36476249d7c9eed0b20",
  "EditLabRewards.jsx": "ec5f9c1ecf408dc76858dc68f70ba5d2a837a18caab51fffdbb475f2c0f06982",
  "CreativeStudio.jsx": "73d3234a13a778675ef78a0d53b93f0b1f183351d64ef82210e68cc6ab614adf",
  "creative-studio.css": "7ca72c5a0d6a761cfce98a0e23d0aeea22d734757a95c79dc61a5cb71692d307"
};
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fail(message) { console.error('\n[Creative Studio V1] ' + message); process.exit(1); }
if (!fs.existsSync(path.join(sourceDir, 'main.jsx')) || !fs.existsSync(path.join(sourceDir, 'EditLabRewards.jsx'))) {
  fail('Could not find client/src/main.jsx and EditLabRewards.jsx. Extract the ZIP into your project root.');
}
// Check all files before touching anything: fail safely if the live project has changed.
for (const name of targets) {
  const patchFile = path.join(payload, name);
  if (!fs.existsSync(patchFile) || sha(patchFile) !== expected[name]) fail('Missing or damaged update file: ' + name);
  const liveFile = path.join(sourceDir, name);
  if (!fs.existsSync(liveFile)) {
    if (originals[name]) fail('Expected original file is missing: ' + name);
    continue;
  }
  const liveHash = sha(liveFile);
  if (liveHash !== expected[name] && liveHash !== originals[name]) {
    fail(name + ' does not match the uploaded project snapshot. No files were changed. Send your updated file for a safe merge.');
  }
}
const alreadyInstalled = targets.every(name => fs.existsSync(path.join(sourceDir,name)) && sha(path.join(sourceDir,name)) === expected[name]);
if (alreadyInstalled) { console.log('Creative Studio V1 is already installed. Nothing changed.'); process.exit(0); }
const backupDir = path.join(root, 'backups', 'before-creative-studio-v1-' + new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backupDir, { recursive: true });
for (const name of targets) {
  const liveFile = path.join(sourceDir, name);
  if (fs.existsSync(liveFile) && sha(liveFile) !== expected[name]) fs.copyFileSync(liveFile, path.join(backupDir, name));
  fs.copyFileSync(path.join(payload, name), liveFile);
  console.log('Installed:', 'client/src/' + name);
}
console.log('\nSUCCESS — EditVault Creative Studio V1 installed.');
console.log('Backup:', backupDir);
console.log('Restart client with: cd client && npm run dev');
console.log('Visit: http://localhost:5173/editlab');
