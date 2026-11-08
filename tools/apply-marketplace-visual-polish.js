'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const cssPath = path.join(projectRoot, 'client', 'src', 'styles.css');
const polishPath = path.join(__dirname, 'marketplace-visual-polish.css');
const marker = 'EDITVAULT MARKETPLACE VISUAL POLISH v1';

function fail(message) {
  console.error(`Visual polish was not applied: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(cssPath)) {
  fail(`Could not find ${path.relative(projectRoot, cssPath)}. Run this script from the EditVault project root, with client/src/styles.css present.`);
} else if (!fs.existsSync(polishPath)) {
  fail(`Missing ${path.relative(projectRoot, polishPath)}. Re-extract the entire update ZIP before running the script.`);
} else {
  const currentCss = fs.readFileSync(cssPath, 'utf8');
  const polishCss = fs.readFileSync(polishPath, 'utf8');

  if (currentCss.includes(marker)) {
    console.log('Marketplace visual polish is already installed. No files were changed.');
  } else if (!currentCss.includes('.creator-studio') || !currentCss.includes('.premium-section') || !currentCss.includes('.evx-pack-card')) {
    fail('The stylesheet does not match the expected EditVault build. No files were changed; keep your backup and check the current project version.');
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${cssPath}.pre-marketplace-polish-${timestamp}.bak`;
    try {
      fs.copyFileSync(cssPath, backupPath, fs.constants.COPYFILE_EXCL);
      const separator = currentCss.endsWith('\n') ? '\n' : '\n\n';
      fs.writeFileSync(cssPath, `${currentCss}${separator}${polishCss.trim()}\n`, 'utf8');
      console.log('EditVault marketplace visual polish applied successfully.');
      console.log(`Backup created: ${path.relative(projectRoot, backupPath)}`);
      console.log('Next: restart the Vite client and hard-refresh the browser (Ctrl+Shift+R).');
    } catch (error) {
      try {
        if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, cssPath);
      } catch (_) {}
      fail(error.message || 'File write failed. The original stylesheet was restored from its backup if possible.');
    }
  }
}
