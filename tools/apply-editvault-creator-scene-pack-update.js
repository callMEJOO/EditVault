'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const payloadRoot = path.join(projectRoot, 'upgrade-files');
const expectedBaselineHashes = {
  'client/src/main.jsx': 'a50644f3ff76d6c3e86eafee214569e6ed7c5f03c295484b4cb6953040481a63',
  'client/src/ProfileSettings.jsx': 'cd6abce9944ffa83443566adef875374e5d2a63c630ce63cf5c6119efe0dfc3a',
  'client/src/PublicCreatorProfile.jsx': '8c51a7716db561c2c0c6b4ddae608b868bc32db092ea47c7bab3d8db4bf72a04',
  'client/src/MarketplaceSections.jsx': '15442dc7486dbc8d1442e7a821a29934e9958dc40e3fb719a5732c1b63963458',
  'client/src/CreatorRequests.jsx': '5c1c823642339a15b55dd0158fb937fac3f6edac602dd2fd0471b40661b0839c',
  'server/src/routes/creators.js': 'd16a8c32c057d1771a3a8a488e50d6b014e5408552ddc2769a68e4f67fc7da42',
  'server/src/routes/marketplace.js': 'c969e50d26fcc8b36c8c98efcdb345899568ea04ba40cd5b897e57e5e6ea12f5',
  'server/src/routes/custom-requests.js': 'd8100382b0263fbb754fdba776cbaf03f59b0282d1f32cc71b458dbe504313f9',
  'server/src/index.js': 'c1e232741502dc19a614ab3fcb266add142c4cdf9aa893446d4e69ff00d82355',
};
const addedTargets = [
  'client/src/CreatorApplication.jsx',
  'client/src/creator-application.css',
  'client/src/scene-pack-upload.css',
  'server/src/db/apply-editvault-workflow-upgrade.js',
];
const targets = [...Object.keys(expectedBaselineHashes), ...addedTargets];

function normalizedHash(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(Buffer.from(source, 'utf8')).digest('hex');
}

function ensureSafeRelativePath(relativePath) {
  const absolute = path.resolve(projectRoot, relativePath);
  if (!absolute.startsWith(projectRoot + path.sep)) throw new Error(`Unsafe target path: ${relativePath}`);
  return absolute;
}

function run() {
  const missingPayload = targets.filter((relativePath) => {
    const file = ensureSafeRelativePath(path.join('upgrade-files', relativePath));
    return !fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0;
  });
  if (missingPayload.length) {
    throw new Error(`Update package is incomplete. Missing files: ${missingPayload.join(', ')}. No project files were changed.`);
  }

  // Fail closed if any active file differs from the source snapshot this patch was built for.
  const mismatch = [];
  for (const [relativePath, expected] of Object.entries(expectedBaselineHashes)) {
    const target = ensureSafeRelativePath(relativePath);
    if (!fs.existsSync(target)) {
      mismatch.push(`${relativePath} (missing)`);
      continue;
    }
    const actual = normalizedHash(target);
    if (actual !== expected) mismatch.push(`${relativePath} (different version)`);
  }
  if (mismatch.length) {
    throw new Error(
      'The project files do not match the uploaded source snapshot:\n - ' + mismatch.join('\n - ') +
      '\nNo project files were changed. Keep this output and send it before retrying; do not run the database migration yet.'
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(projectRoot, 'backups', `editvault-creator-scene-pack-${stamp}`);
  const existingTargets = targets.filter((relativePath) => fs.existsSync(ensureSafeRelativePath(relativePath)));

  // Make all backups before writing any update files.
  for (const relativePath of existingTargets) {
    const original = ensureSafeRelativePath(relativePath);
    const backup = path.join(backupRoot, relativePath);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(original, backup);
  }

  for (const relativePath of targets) {
    const source = ensureSafeRelativePath(path.join('upgrade-files', relativePath));
    const target = ensureSafeRelativePath(relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }

  console.log('EditVault creator application, request privacy, and scene-pack update installed.');
  console.log(`Updated ${Object.keys(expectedBaselineHashes).length} files and added ${addedTargets.length} files.`);
  console.log(`Backup: ${path.relative(projectRoot, backupRoot)}`);
  console.log('Next: run the database migration shown in README-EDITVAULT-CREATOR-SCENEPACK.txt.');
}

try {
  run();
} catch (error) {
  console.error(`Update stopped: ${error.message}`);
  process.exitCode = 1;
}
