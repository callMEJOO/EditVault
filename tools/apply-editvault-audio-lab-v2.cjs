'use strict';
/* Safe EditVault Audio Lab V2 installer. Requires Creative Studio V1. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const payload = path.join(__dirname, 'audio-lab-v2-files');
const targets = [
  ['client/src/EditLabRewards.jsx', 'ec5f9c1ecf408dc76858dc68f70ba5d2a837a18caab51fffdbb475f2c0f06982'],
  ['client/src/CreativeStudio.jsx', '73d3234a13a778675ef78a0d53b93f0b1f183351d64ef82210e68cc6ab614adf'],
  ['client/src/creative-studio.css', '7ca72c5a0d6a761cfce98a0e23d0aeea22d734757a95c79dc61a5cb71692d307'],
  ['client/src/AudioLab.jsx', null],
  ['client/src/audio-lab.css', null],
  ['server/src/routes/editlab.js', '5425df7bd84854d2315209477400347b50d016a2e5f609b4e71279ae5c364d66'],
  ['server/src/routes/editlab-audio.js', null],
];
const expected = {
  'client/src/EditLabRewards.jsx': '1e7b095db833fa9ddd45cc0393c4ece17654a73cbe1202671202c918bb2c93be',
  'client/src/CreativeStudio.jsx': '473c40a1be532b7709d52d43a188f798c04e2d18e8a22914f2d60b07e0971292',
  'client/src/creative-studio.css': 'c93323be17a54b17453a13802df636421b0f49754170c0007d5a5d1e4eb8fb35',
  'client/src/AudioLab.jsx': 'c49ac9104d5c47036c99f82e95a3fe7dc12c0efc91b2cec522bfbf6ac644ab5b',
  'client/src/audio-lab.css': '85ed2d5148953ea67447ea81a076860b456e839967978f2b1506eed684552f8b',
  'server/src/routes/editlab.js': '4f38ccdcb2ac0248b3431721fe5bdd9fae48ba15005786dddb99ddf9b84c098f',
  'server/src/routes/editlab-audio.js': '5701d3240373f4e2ff67cb384702cf0a1dd7664f82c97dff87bebc95148e7d7d',
};
const norm = pathFromRoot => path.join(root, ...pathFromRoot.split('/'));
const payloadPath = pathFromRoot => path.join(payload, ...pathFromRoot.split('/'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fail = message => { console.error('\n[Audio Lab V2] ' + message); process.exit(1); };
// Preflight everything before writing to the user's project.
let alreadyInstalled = true;
for (const [relative, beforeHash] of targets) {
  const candidate = payloadPath(relative);
  if (!fs.existsSync(candidate) || sha(candidate) !== expected[relative]) fail('Update payload missing or corrupted: ' + relative);
  const current = norm(relative);
  if (!fs.existsSync(current)) {
    if (beforeHash) fail('Missing ' + relative + '. Install Creative Studio V1 first. Nothing has changed.');
    alreadyInstalled = false;
    continue;
  }
  const digest = sha(current);
  if (digest !== expected[relative]) alreadyInstalled = false;
  if (digest !== expected[relative] && digest !== beforeHash) {
    fail('Your ' + relative + ' has changed since the project ZIP. Nothing has changed. Please send the updated source file for a safe merge.');
  }
}
if (alreadyInstalled) { console.log('Audio Lab V2 is already installed. No changes needed.'); process.exit(0); }
const backupDir = path.join(root, 'backups', 'before-audio-lab-v2-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(backupDir, { recursive: true });
const copied = [];
try {
  for (const [relative] of targets) {
    const dest = norm(relative);
    if (fs.existsSync(dest)) {
      const backup = path.join(backupDir, ...relative.split('/'));
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(dest, backup);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(payloadPath(relative), dest);
    copied.push(relative);
    console.log('Installed:', relative);
  }
} catch (error) {
  console.error('Install error — reverting modified files:', error.message);
  for (const relative of copied.reverse()) {
    const dest = norm(relative);
    const backup = path.join(backupDir, ...relative.split('/'));
    if (fs.existsSync(backup)) fs.copyFileSync(backup, dest);
    else fs.rmSync(dest, { force: true });
  }
  process.exit(1);
}
console.log('\nSUCCESS — Audio Lab V2 installed.');
console.log('Backup:', backupDir);
console.log('Restart server AND client, then open http://localhost:5173/editlab');
console.log('No database migration or API key is needed. FFmpeg is provided by existing server dependency ffmpeg-static.');
