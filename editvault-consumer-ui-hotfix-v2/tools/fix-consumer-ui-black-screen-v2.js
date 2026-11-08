'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const fail = (message) => {
  console.error(`EditVault hotfix stopped: ${message}`);
  console.error('No files were changed.');
  process.exit(1);
};
if (!fs.existsSync(mainPath)) fail('client/src/main.jsx was not found. Run this from the project root.');

let main = fs.readFileSync(mainPath, 'utf8').replace(/\r\n/g, '\n');
const langState = main.match(/^[\t ]*const \[language,\s*setLanguage\]\s*=\s*useState\(/m);
if (!langState) fail('Could not identify the language state in main.jsx.');
const langPos = langState.index;
const labelsMarker = "const pageLabels = language === 'ar' ? {";
const labelsPos = main.indexOf(labelsMarker);
if (labelsPos === -1) {
  console.log('No page-title effect using language was found. The hotfix did not change any files.');
  console.log('Please send the first red error from the browser DevTools Console (F12 → Console).');
  process.exit(0);
}

const effectStart = main.lastIndexOf('  useEffect(() => {', labelsPos);
if (effectStart === -1) fail('Found the localized page title, but could not locate its useEffect safely.');
const tail = main.slice(labelsPos);
const endRegex = /^\s*\},\s*\[activePage,\s*language\]\s*\);/m;
const endMatch = endRegex.exec(tail);
if (!endMatch) fail('Found the localized page title, but could not locate the end of its useEffect safely.');
const effectEnd = labelsPos + endMatch.index + endMatch[0].length;
const effectBlock = main.slice(effectStart, effectEnd).trim();
if (!effectBlock.includes('document.title') || !effectBlock.includes('pageLabels[activePage]')) {
  fail('The candidate block did not match the expected page-title effect.');
}

// The dependency array evaluates `language` during render. If that effect appears
// before the language state declaration, it can throw a temporal-dead-zone error.
if (effectStart >= langPos) {
  console.log('The page-title effect is already after language initialization. No files were changed.');
  console.log('If the screen is still black, send the first red error from DevTools Console (F12 → Console).');
  process.exit(0);
}

let next = main.slice(0, effectStart) + main.slice(effectEnd);
// Place the effect before the language-persistence effect, which is after the component's state declarations.
const insertionMarker = "  useEffect(() => {\n    localStorage.setItem('editvault_language', language);";
let insertAt = next.indexOf(insertionMarker);
if (insertAt === -1) {
  // Fallback: place immediately after the language text helper, once language is initialized.
  const helperLine = "  const tx = (en, ar) => language === 'ar' ? ar : en;";
  const helperAt = next.indexOf(helperLine);
  if (helperAt === -1 || helperAt < langPos) fail('No safe insertion point was found after language initialization.');
  insertAt = helperAt + helperLine.length;
} else if (insertAt < langPos) {
  fail('The selected insertion point appears before language initialization.');
}
next = next.slice(0, insertAt) + '\n\n' + effectBlock + '\n\n' + next.slice(insertAt);

// Final safety checks before writing anything.
const newLangPos = next.indexOf('const [language, setLanguage]');
const newEffectPos = next.indexOf("const pageLabels = language === 'ar' ? {");
if (newLangPos === -1 || newEffectPos === -1 || newEffectPos < newLangPos) fail('Post-fix validation failed.');
if ((next.match(/const pageLabels = language === 'ar' \? \{/g) || []).length !== 1) fail('Expected exactly one localized page-title object.');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `${mainPath}.pre-black-screen-v2-${stamp}.bak`;
fs.copyFileSync(mainPath, backupPath);
fs.writeFileSync(mainPath, next, 'utf8');
console.log('EditVault black-screen hotfix v2 applied successfully.');
console.log(`Backup created: ${path.basename(backupPath)}`);
console.log('Moved the localized page-title effect below language initialization. No server or database files were changed.');
