'use strict';
/* EditVault v4 header installer. Safe, targeted replacement of <header> only. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const cssPath = path.join(root, 'client', 'src', 'editvault-header-v4.css');
const headerAsset = path.join(root, 'upgrade-files', 'evh-header.jsx.txt');
const cssAsset = path.join(root, 'upgrade-files', 'editvault-header-v4.css');

function fail(msg) { console.error('\n[EditVault header v4] ' + msg); process.exit(1); }
for (const p of [mainPath, headerAsset, cssAsset]) {
  if (!fs.existsSync(p)) fail('Missing file: ' + p + '\nExtract the complete ZIP into the project root (where client/ and server/ are).');
}
let source = fs.readFileSync(mainPath, 'utf8');
if (source.includes('evh-header')) {
  console.log('[EditVault header v4] Already installed. No changes were made.');
  process.exit(0);
}
const headerMark = '<header className="topbar">';
const pos = source.indexOf(headerMark);
if (pos < 0) fail('Could not find the expected <header className="topbar">. Nothing changed.');
const endMark = '</header>';
const endPos = source.indexOf(endMark, pos);
if (endPos < 0) fail('Could not find the end of the header. Nothing changed.');
const begin = source.lastIndexOf('\n', pos) + 1;
const end = endPos + endMark.length;
const originalHeader = source.slice(begin, end);
const required = ['#explore','#scene-packs','#editlab','#earn-points','#premium','#creators','#how','#requests','#library'];
const missing = required.filter((href) => !originalHeader.includes('href="' + href + '"'));
if (missing.length) fail('The existing menu has changed (missing: ' + missing.join(', ') + '). No files changed. Please send client/src/main.jsx for a tailored patch.');
if (!originalHeader.includes('className="mobile-menu"') || !originalHeader.includes('className="top-actions"')) {
  fail('Unexpected header structure. No changes made. Send client/src/main.jsx for a tailored patch.');
}
const lucideImport = /import\s*\{[\s\S]*?\}\s*from\s*['"]lucide-react['"]\s*;/m;
const match = source.match(lucideImport);
if (!match) fail('Cannot locate lucide-react import. No changes made.');
const cssImports = [...source.matchAll(/^import\s+['"]\.\/[^'"\n]+\.css['"];?\s*$/gm)];
if (!cssImports.length) fail('Cannot locate CSS imports. No changes made.');
const headerCode = fs.readFileSync(headerAsset, 'utf8').trimEnd();
source = source.slice(0, begin) + headerCode + source.slice(end);
if (!match[0].includes('ChevronDown')) {
  source = source.replace('  Settings2,', '  Settings2,\n  ChevronDown,');
  if (!source.match(/import\s*\{[\s\S]*?ChevronDown[\s\S]*?\}\s*from\s*['"]lucide-react['"]/m)) {
    fail('Could not add ChevronDown import. No changes made.');
  }
}
const lastCss = [...source.matchAll(/^import\s+['"]\.\/[^'"\n]+\.css['"];?\s*$/gm)].at(-1);
const afterCss = lastCss.index + lastCss[0].length;
source = source.slice(0, afterCss) + "\nimport './editvault-header-v4.css';" + source.slice(afterCss);
const suffix = new Date().toISOString().replace(/[:.]/g, '-');
const backup = mainPath + '.before-header-v4-' + suffix + '.bak';
fs.copyFileSync(mainPath, backup);
if (fs.existsSync(cssPath)) fs.copyFileSync(cssPath, cssPath + '.before-header-v4-' + suffix + '.bak');
try {
  fs.writeFileSync(mainPath, source, 'utf8');
  fs.copyFileSync(cssAsset, cssPath);
} catch (err) {
  fs.copyFileSync(backup, mainPath);
  fail('Write failed; main.jsx was restored: ' + err.message);
}
console.log('\n[EditVault] Header v4 successfully installed!');
console.log('  Desktop: five primary links + More dropdown + account menu.');
console.log('  Mobile: logo, points, hamburger; full navigation in accessible drawer.');
console.log('  CSS: ' + cssPath);
console.log('  Backup: ' + backup);
console.log('  Restart client dev server, then Ctrl+Shift+R in browser.');
