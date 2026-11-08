'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const cssPath = path.join(root, 'client', 'src', 'styles.css');

function requireFile(filePath, relativeName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${relativeName}. Run this script from the EditVault project root.`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function backup(filePath, contents) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.pre-profile-click-fix-${stamp}.bak`;
  fs.writeFileSync(backupPath, contents, 'utf8');
  return path.relative(root, backupPath);
}

try {
  let main = requireFile(mainPath, 'client/src/main.jsx');
  let css = requireFile(cssPath, 'client/src/styles.css');

  if (!main.includes('const [publicCreatorId, setPublicCreatorId] = useState(null);')) {
    throw new Error('Could not find publicCreatorId state in main.jsx. No files were changed.');
  }
  if (!main.includes('<PublicCreatorProfile creatorId={publicCreatorId}')) {
    throw new Error('Could not find PublicCreatorProfile render in main.jsx. No files were changed.');
  }

  const marker = '<button type="button" className="creator-name creator-profile-link"';
  const buttonStart = main.indexOf(marker);
  if (buttonStart < 0 || main.indexOf(marker, buttonStart + marker.length) >= 0) {
    throw new Error('Could not uniquely locate the creator profile button in main.jsx. No files were changed.');
  }
  const buttonEnd = main.indexOf('</button>', buttonStart);
  if (buttonEnd < 0) throw new Error('Could not find the end of the creator profile button. No files were changed.');
  const oldButton = main.slice(buttonStart, buttonEnd + '</button>'.length);
  if (!oldButton.includes('setPublicCreatorId(edit.creator_id)')) {
    throw new Error('The creator profile button does not match the expected handler. No files were changed.');
  }

  const newButton = `<button type="button" className="creator-name creator-profile-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (edit.creator_id) { setPreviewEdit(null); setPublicCreatorId(edit.creator_id); } else { setNotice(tx('Creator profile is not available.', 'صفحة المبدع غير متاحة حاليًا.')); } }}>@{edit.creator}</button>`;

  const zIndexPattern = /(\.public-creator-backdrop\s*\{[^}]*?\bz-index\s*:\s*)\d+(?:\s*!important)?(\s*;)/;
  if (!zIndexPattern.test(css)) {
    throw new Error('Could not find the public creator backdrop z-index in styles.css. No files were changed.');
  }

  // All validation is complete. Back up both source files before modifying either one.
  const mainBackup = backup(mainPath, main);
  const cssBackup = backup(cssPath, css);
  main = main.slice(0, buttonStart) + newButton + main.slice(buttonEnd + '</button>'.length);
  css = css.replace(zIndexPattern, '$1 99999 !important$2');

  fs.writeFileSync(mainPath, main, 'utf8');
  fs.writeFileSync(cssPath, css, 'utf8');

  console.log('Public creator profile click fix applied.');
  console.log('- Prevents click bubbling from opening/keeping another overlay above the profile.');
  console.log('- Closes any edit preview before opening the selected creator profile.');
  console.log('- Raises the creator profile overlay above other interface layers.');
  console.log(`Backups created: ${mainBackup}; ${cssBackup}`);
  console.log('No database changes were made. Refresh the browser with Ctrl+F5.');
} catch (error) {
  console.error(`Profile click fix failed: ${error.message}`);
  process.exitCode = 1;
}
