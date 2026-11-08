'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const projectRoot = process.cwd();
const upgradeRoot = path.join(__dirname, 'editvault-request-privacy-upgrade');
const files = [
  {
    rel: 'client/src/ProfileSettings.jsx',
    before: 'cd6abce9944ffa83443566adef875374e5d2a63c630ce63cf5c6119efe0dfc3a',
    after: '939f7addb70007e5d129c5cc292f2e8d8df7d2b6ccf31515aef723ea586244e3',
  },
  {
    rel: 'client/src/PublicCreatorProfile.jsx',
    before: '8c51a7716db561c2c0c6b4ddae608b868bc32db092ea47c7bab3d8db4bf72a04',
    after: '5a4cc2a3dd48f5b0539a7deb539a6cbb1b7fe21ded9c6338ea8254c873ba2f47',
  },
  {
    rel: 'client/src/CreatorRequests.jsx',
    before: '5c1c823642339a15b55dd0158fb937fac3f6edac602dd2fd0471b40661b0839c',
    after: '41021678d8e09aa3c695a9d08eb941e59e3c02757a400ca6cd187133d07788bb',
  },
  {
    rel: 'client/src/creator-requests.css',
    before: '14362201be2a427f2c0f220afc2b205a35129b22e8561255bc1c7a930d4029ef',
    after: '09de5f1e357e9605f7e8cf458c10ba423e69ba701e5707880025725404f7d889',
  },
  {
    rel: 'server/src/routes/creators.js',
    before: 'd16a8c32c057d1771a3a8a488e50d6b014e5408552ddc2769a68e4f67fc7da42',
    after: '502045a705a9d5ee44af7785759b382d90828d866f6d41e8d4da9d9e0e0c7fc8',
  },
  {
    rel: 'server/src/routes/custom-requests.js',
    before: 'd8100382b0263fbb754fdba776cbaf03f59b0282d1f32cc71b458dbe504313f9',
    after: 'fe151e73edeb0c7b2f8c2b91a5bd2e321392e889fa447e55ecfcf8f10501c4e8',
  },
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(projectRoot, 'client', 'src', 'main.jsx')) ||
    !fs.existsSync(path.join(projectRoot, 'server', 'src', 'index.js'))) {
  fail('Run this command from the EditVault project root (the folder containing client and server). No files were changed.');
}

const plan = [];
for (const item of files) {
  const target = path.join(projectRoot, item.rel);
  const source = path.join(upgradeRoot, item.rel);
  if (!fs.existsSync(target)) fail(`Required project file not found: ${item.rel}. No files were changed.`);
  if (!fs.existsSync(source)) fail(`Upgrade file is missing from this patch: ${item.rel}. No files were changed.`);
  const currentHash = sha256(fs.readFileSync(target));
  const updatedHash = sha256(fs.readFileSync(source));
  if (updatedHash !== item.after) fail(`The patch bundle file failed its integrity check: ${item.rel}. No files were changed.`);
  if (currentHash === item.after) {
    plan.push({ ...item, target, source, action: 'skip' });
  } else if (currentHash === item.before) {
    plan.push({ ...item, target, source, action: 'replace' });
  } else {
    fail(`${item.rel} differs from the source version this patch was built for. No files were changed; send the latest source ZIP so it can be reconciled safely.`);
  }
}

const toReplace = plan.filter((item) => item.action === 'replace');
if (toReplace.length === 0) {
  console.log('EditVault request privacy patch is already installed. No files changed.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(projectRoot, 'backups', `editvault-request-privacy-${stamp}`);
try {
  for (const item of toReplace) {
    const backup = path.join(backupRoot, item.rel);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(item.target, backup);
  }
  for (const item of toReplace) {
    fs.copyFileSync(item.source, item.target);
  }

  for (const rel of ['server/src/routes/creators.js', 'server/src/routes/custom-requests.js']) {
    const check = spawnSync(process.execPath, ['--check', path.join(projectRoot, rel)], { encoding: 'utf8' });
    if (check.status !== 0) {
      throw new Error(`Node syntax check failed for ${rel}:\n${check.stderr || check.stdout}`);
    }
  }
} catch (error) {
  for (const item of toReplace) {
    const backup = path.join(backupRoot, item.rel);
    if (fs.existsSync(backup)) fs.copyFileSync(backup, item.target);
  }
  fail(`${error.message}\nThe original files have been restored from the backup.`);
}

console.log('EditVault request privacy / simpler video request patch applied.');
console.log(`Files updated: ${toReplace.length}`);
for (const item of toReplace) console.log(`  - ${item.rel}`);
console.log(`Backup: ${backupRoot}`);
console.log('\nRestart the backend (server) once. Vite should hot-reload the frontend; if needed, hard-refresh the browser.');
