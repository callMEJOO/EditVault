'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
if (!fs.existsSync(mainPath)) {
  console.error('Fix stopped: client/src/main.jsx was not found. Run this from the EditVault project root.');
  process.exit(1);
}
let main = fs.readFileSync(mainPath, 'utf8').replace(/\r\n/g, '\n');
const marker = "  const tx = (en, ar) => language === 'ar' ? ar : en;";
if (!main.includes(marker)) {
  console.error('Fix stopped: the Arabic UI helper was not found. No files were changed.');
  process.exit(1);
}
if (!/const \[language,\s*setLanguage\] = useState/.test(main)) {
  console.error('Fix stopped: language state was not found. No files were changed.');
  process.exit(1);
}

// Match only the page-title effect inserted by the consumer Arabic UI update.
const effectRegex = /\n?  useEffect\(\(\) => \{\n    scrollEditVaultToTop\(\);\n    const pageLabels = language === 'ar' \? \{[\s\S]*?\n    document\.title = `EditVault · \$\{pageLabels\[activePage\] \|\| pageLabels\.home \|\| 'Home'\}`;\n  \}, \[activePage, language\]\);\n?/g;
const matches = [...main.matchAll(effectRegex)];
if (matches.length === 0) {
  if (main.includes('const pageLabels = language === \'ar\'') && main.indexOf('const pageLabels = language === \'ar\'') > main.indexOf(marker)) {
    console.log('Black-screen fix: page-title effect is already after language initialization. No files changed.');
    process.exit(0);
  }
  console.error('Fix stopped: could not safely identify the page-title effect. No files were changed.');
  process.exit(1);
}
if (matches.length !== 1) {
  console.error(`Fix stopped: found ${matches.length} candidate page-title effects; no files were changed.`);
  process.exit(1);
}
const match = matches[0];
const effect = match[0].trim();
let next = main.slice(0, match.index) + '\n' + main.slice(match.index + match[0].length);
const insertAt = next.indexOf(marker) + marker.length;
if (insertAt < marker.length) {
  console.error('Fix stopped: could not find safe insertion point. No files were changed.');
  process.exit(1);
}
next = next.slice(0, insertAt) + '\n\n' + effect + next.slice(insertAt);

// Verify the effect no longer references language before its state initialization.
const langPos = next.indexOf('const [language, setLanguage]');
const effectPos = next.indexOf('const pageLabels = language === \'ar\'');
if (effectPos < langPos) {
  console.error('Fix stopped: validation failed. No files were changed.');
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `${mainPath}.pre-black-screen-fix-${stamp}.bak`;
fs.copyFileSync(mainPath, backupPath);
fs.writeFileSync(mainPath, next, 'utf8');
console.log('EditVault black-screen fix applied.');
console.log(`Backup created: ${path.basename(backupPath)}`);
console.log('Moved the page-title effect below language initialization. No database or server changes were made.');
