#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXPECTED_ORIGINAL = {
  "client/src/main.jsx": "a50644f3ff76d6c3e86eafee214569e6ed7c5f03c295484b4cb6953040481a63",
  "client/src/ProfileSettings.jsx": "939f7addb70007e5d129c5cc292f2e8d8df7d2b6ccf31515aef723ea586244e3",
  "client/src/CreatorStudio.jsx": "d11a55e92eb0a21820b0968b3779f735a9c4bf6344489e0beea55b08a97a5cb9",
  "client/src/CreatorRequests.jsx": "41021678d8e09aa3c695a9d08eb941e59e3c02757a400ca6cd187133d07788bb",
  "client/src/MarketplaceSections.jsx": "15442dc7486dbc8d1442e7a821a29934e9958dc40e3fb719a5732c1b63963458",
  "server/src/routes/creators.js": "502045a705a9d5ee44af7785759b382d90828d866f6d41e8d4da9d9e0e0c7fc8",
  "server/src/routes/custom-requests.js": "fe151e73edeb0c7b2f8c2b91a5bd2e321392e889fa447e55ecfcf8f10501c4e8",
  "server/src/routes/marketplace.js": "c969e50d26fcc8b36c8c98efcdb345899568ea04ba40cd5b897e57e5e6ea12f5",
  "server/src/routes/edits.js": "136a6e4d22379f8150eff7fdcdde037235d327d781262a7141211380680a1056",
  "server/src/routes/admin-creators.js": "0725cd1b961d45dbd13e8667b780e74fb4334e5b72669d8ba762b24203c64d2a",
  "server/src/index.js": "45583196b74d54fd0653de8bee5644f6e653cee6671968371c861b1b37a3394a"
};
const root = process.cwd();
const payloadRoot = path.resolve(__dirname, '..', 'editvault-creator-scene-pack-v2-payload');
const modifiedExisting = Object.keys(EXPECTED_ORIGINAL);
const addedFiles = [
  'server/src/db/apply-creator-application-scene-pack-upgrade.js',
  'client/src/CreatorApplication.jsx',
  'client/src/creator-application.css',
  'client/src/marketplace-workflow.css',
];
const allTargets = [...modifiedExisting, ...addedFiles];
function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function targetHash(rel) { return digest(path.join(payloadRoot, rel)); }
function fail(message) { console.error(`Update stopped: ${message}`); process.exit(1); }

if (!fs.existsSync(path.join(root, 'client', 'src', 'main.jsx')) ||
    !fs.existsSync(path.join(root, 'server', 'src', 'index.js')) ||
    !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this script from the EditVault project root (the folder containing client and server). No project files were changed.');
}
if (!fs.existsSync(payloadRoot)) fail('The update payload folder is missing. Extract the whole ZIP into the project root and try again.');
for (const rel of allTargets) {
  if (!fs.existsSync(path.join(payloadRoot, rel))) fail(`Update payload is missing ${rel}. No project files were changed.`);
}

const needsWrite = [];
const alreadyCorrect = [];
const mismatches = [];
for (const rel of modifiedExisting) {
  if (!exists(rel)) { mismatches.push(`${rel} (missing)`); continue; }
  const current = digest(path.join(root, rel));
  const desired = targetHash(rel);
  if (current === desired) alreadyCorrect.push(rel);
  else if (current === EXPECTED_ORIGINAL[rel]) needsWrite.push(rel);
  else mismatches.push(`${rel} (different version)`);
}
for (const rel of addedFiles) {
  if (!exists(rel)) needsWrite.push(rel);
  else if (digest(path.join(root, rel)) === targetHash(rel)) alreadyCorrect.push(rel);
  else mismatches.push(`${rel} (destination already exists with different contents)`);
}
if (mismatches.length) {
  console.error('Update stopped: the project does not match the source archive used to prepare this update:');
  for (const item of mismatches) console.error(` - ${item}`);
  console.error('No project files were changed. Send this output before retrying; do not run the database migration.');
  process.exit(1);
}
if (!needsWrite.length) {
  console.log('EditVault creator applications and scene-pack update is already installed. No files changed.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(root, `editvault-creator-scene-pack-backup-${stamp}`);
const existingToBackup = needsWrite.filter(rel => exists(rel));
try {
  for (const rel of existingToBackup) {
    const dest = path.join(backupRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
  }
  for (const rel of needsWrite) {
    const source = path.join(payloadRoot, rel);
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
  }
} catch (error) {
  // Best-effort rollback if a file copy fails partway through.
  for (const rel of needsWrite) {
    const dest = path.join(root, rel);
    const backup = path.join(backupRoot, rel);
    try {
      if (fs.existsSync(backup)) fs.copyFileSync(backup, dest);
      else if (!modifiedExisting.includes(rel) && fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch { /* preserve the original failure; backup directory remains for recovery */ }
  }
  fail(`Could not finish applying the update (${error.message}). Existing files were restored where possible. Backup: ${backupRoot}`);
}

console.log('EditVault creator applications and scene-pack update installed successfully.');
console.log(`Backup created: ${backupRoot}`);
console.log('Next, run the database upgrade from the project root:');
console.log('  "C:\\Program Files\\nodejs\\node.exe" ".\\server\\src\\db\\apply-creator-application-scene-pack-upgrade.js"');
console.log('Only run the database upgrade because the source patch completed successfully.');
