'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = path.join(root, 'upgrade', 'client', 'src');
const patchComponent = path.join(patchRoot, 'EditLabRewards.jsx');
const patchStyles = path.join(patchRoot, 'editlab-rewards.css');
const targetComponent = path.join(root, 'client', 'src', 'EditLabRewards.jsx');
const targetStyles = path.join(root, 'client', 'src', 'editlab-rewards.css');

for (const file of [patchComponent, patchStyles, targetComponent, targetStyles]) {
  if (!fs.existsSync(file)) {
    console.error(`Required file not found: ${path.relative(root, file)}. Extract the complete update into the EditVault root and rerun this command.`);
    process.exit(1);
  }
}

const currentComponent = fs.readFileSync(targetComponent, 'utf8');
const currentStyles = fs.readFileSync(targetStyles, 'utf8');
const nextComponent = fs.readFileSync(patchComponent, 'utf8');
const nextStyles = fs.readFileSync(patchStyles, 'utf8');

// Validate the active EditLab version before replacing it, to avoid overwriting unrelated files.
const expectedMarkers = [
  'export default function EditLabRewards',
  '/api/editlab/compress',
  '/api/rewards/summary',
  '/api/rewards/refresh',
  'evlr-editlab',
  'evlr-rewards',
];
for (const marker of expectedMarkers) {
  if (!currentComponent.includes(marker)) {
    console.error(`The current EditLab component is missing expected marker: ${marker}. No files were changed.`);
    process.exit(1);
  }
}
if (!currentStyles.includes('.evlr-root')) {
  console.error('The current EditLab stylesheet does not look like the expected component stylesheet. No files were changed.');
  process.exit(1);
}
if (!nextComponent.includes("import './editlab-rewards.css'")) {
  console.error('The new component stylesheet import is missing. No files were changed.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(targetComponent, `${targetComponent}.pre-ui-refresh-${stamp}.bak`);
fs.copyFileSync(targetStyles, `${targetStyles}.pre-ui-refresh-${stamp}.bak`);
fs.writeFileSync(targetComponent, nextComponent, 'utf8');
fs.writeFileSync(targetStyles, nextStyles, 'utf8');

console.log('EditLab UI refreshed successfully.');
console.log('Created component and stylesheet backups ending in .pre-ui-refresh-*.bak.');
console.log('New features: tool tabs, before/after CC comparison, Arabic RTL copy, and mobile-responsive layouts.');
console.log('No database migration is required for this UI-only update. Restart the Vite client to see the changes.');
