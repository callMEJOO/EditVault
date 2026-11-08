'use strict';
/**
 * EditVault Scene Pack Community V1.
 * Applies tightly scoped, self-validating changes without replacing unrelated project edits.
 * No database changes are made by this installer; run the migration separately.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const base = path.join(__dirname, 'scene-pack-community-v1');
const patches = JSON.parse(fs.readFileSync(path.join(base, 'patches.json'), 'utf8'));
const additions = [
  ['client/src/scene-pack-community-v1.css', 'scene-pack-community-v1.css'],
  ['server/src/db/apply-scene-pack-community-v1.js', 'apply-scene-pack-community-v1.js'],
];
const planned = new Map();
const changed = new Set();
function read(relative) {
  if (planned.has(relative)) return planned.get(relative);
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`${relative} not found. Use the original EditVault project directory.`);
  const data = fs.readFileSync(target, 'utf8');
  planned.set(relative, data);
  return data;
}
try {
  if (!fs.existsSync(path.join(root, 'server/src/routes/marketplace.js')) || !fs.existsSync(path.join(root, 'client/src/MarketplaceSections.jsx')))
    throw new Error('Missing EditVault client or server folders. Extract this ZIP at the project root.');
  for (const patch of patches) {
    let current = read(patch.path);
    if (current.includes(patch.new)) continue; // Already patched. Safe to run twice.
    if (!current.includes(patch.old)) {
      throw new Error(`File changed since the supplied EditVault ZIP: ${patch.path}. No files modified. Send the latest project ZIP to apply safely.`);
    }
    const next = current.replace(patch.old, patch.new);
    planned.set(patch.path, next);
    changed.add(patch.path);
  }
  for (const [relative, sourceName] of additions) {
    const contents = fs.readFileSync(path.join(base, sourceName), 'utf8');
    const target = path.join(root, relative);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== contents)
      throw new Error(`Existing custom file differs: ${relative}. No changes made.`);
    if (!fs.existsSync(target)) { planned.set(relative, contents); changed.add(relative); }
  }
  if (!changed.size) { console.log('SUCCESS: Scene Pack Community V1 is already installed.'); process.exit(0); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(root, 'backups', 'before-scene-pack-community-' + stamp);
  for (const relative of changed) {
    const target = path.join(root, relative);
    if (fs.existsSync(target)) {
      const dest = path.join(backup, relative);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(target, dest);
    }
  }
  // All patches are checked before writing. Existing files were snapshotted above.
  for (const relative of changed) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, planned.get(relative), 'utf8');
    console.log('Updated:', relative);
  }
  console.log('SUCCESS: Scene Pack Community V1 installed.');
  console.log('Backups:', backup);
  console.log('NEXT: cd server && node src\\db\\apply-scene-pack-community-v1.js');
} catch (error) {
  console.error('INSTALL STOPPED:', error.message);
  process.exitCode = 1;
}
