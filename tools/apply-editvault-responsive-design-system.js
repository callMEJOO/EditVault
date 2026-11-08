'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const existingStylesPath = path.join(root, 'client', 'src', 'styles.css');
const targetCssPath = path.join(root, 'client', 'src', 'responsive-design-system.css');
const packageCssPath = path.join(__dirname, '..', 'upgrade', 'client', 'src', 'responsive-design-system.css');
const importLine = "import './responsive-design-system.css';";

for (const file of [mainPath, existingStylesPath, packageCssPath]) {
  if (!fs.existsSync(file)) {
    console.error(`Required file not found: ${path.relative(root, file)}. Run this from the EditVault project root. No project files were changed.`);
    process.exit(1);
  }
}

let main = fs.readFileSync(mainPath, 'utf8');
const css = fs.readFileSync(packageCssPath, 'utf8');
const existingCss = fs.existsSync(targetCssPath) ? fs.readFileSync(targetCssPath, 'utf8') : '';
const alreadyImported = main.includes(importLine) || main.includes('"./responsive-design-system.css"');
const alreadyInstalled = alreadyImported && existingCss.includes('EditVault Responsive Design System');
if (alreadyInstalled) {
  console.log('EditVault responsive design system is already installed. No changes needed.');
  process.exit(0);
}

// Verify the main app imports its existing main stylesheet before changing anything.
const stylesImportPattern = /import\s+(['"])\.\/styles\.css\1\s*;?/;
const stylesImport = main.match(stylesImportPattern);
if (!alreadyImported && !stylesImport) {
  console.error('Could not locate the existing import of ./styles.css in client/src/main.jsx. No project files were changed.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = (file) => {
  if (fs.existsSync(file)) {
    const backupPath = `${file}.pre-responsive-design-${stamp}.bak`;
    fs.copyFileSync(file, backupPath);
    console.log(`Backup: ${path.relative(root, backupPath)}`);
  }
};

backup(mainPath);
backup(targetCssPath);

if (!alreadyImported) {
  main = main.replace(stylesImportPattern, (match) => `${match}\n${importLine}`);
  fs.writeFileSync(mainPath, main, 'utf8');
}
fs.writeFileSync(targetCssPath, css, 'utf8');

console.log('EditVault responsive design system installed.');
console.log('Added a unified responsive CSS layer for desktop, tablet and narrow phones.');
console.log('Existing page components, API routes and database were not changed.');
console.log('Next: refresh the app with Ctrl+Shift+R and inspect desktop/tablet/mobile widths.');
