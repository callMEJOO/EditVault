'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = [
  path.join(root, 'server', 'src', 'db', 'backfill-preview-watermarks.js'),
  path.join(root, 'server', 'src', 'routes', 'edits.js'),
  path.join(root, 'server', 'src', 'routes', 'studio.js'),
];
const needle = "drawtext=text='EDITVAULT':";
// The two backslashes are intentional in the JS source written to the project:
// FFmpeg receives C\:/..., which escapes the Windows drive-letter colon.
const replacement = "drawtext=fontfile='C\\\\:/Windows/Fonts/arial.ttf':text='EDITVAULT':";
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function stop(message) {
  console.error(`Watermark font fix stopped: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(root, 'server', 'src', 'db', 'backfill-preview-watermarks.js'))) {
  stop('Run this script from the EditVault project root (the folder containing client and server).');
}

// Preflight all files before writing any of them, so mismatched projects stay untouched.
const prepared = [];
for (const file of targets) {
  if (!fs.existsSync(file)) {
    if (file.endsWith(path.join('routes', 'studio.js'))) continue;
    stop(`Required file not found: ${path.relative(root, file)}`);
  }
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(needle)) {
    prepared.push({ file, content, count: content.split(needle).length - 1 });
  } else if (content.includes("drawtext=fontfile='C\\\\:/Windows/Fonts/arial.ttf':text='EDITVAULT':") || content.includes("drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='EDITVAULT':")) {
    prepared.push({ file, content, count: 0 });
  } else if (file.endsWith(path.join('routes', 'studio.js'))) {
    console.log(`Skipped ${path.relative(root, file)} (no EditVault drawtext watermark found).`);
  } else {
    stop(`Could not identify the watermark filter in ${path.relative(root, file)}. No project source files were changed.`);
  }
}

let changed = 0;
for (const item of prepared) {
  if (!item.count) {
    console.log(`Already fixed: ${path.relative(root, item.file)}`);
    continue;
  }
  const backup = `${item.file}.pre-watermark-font-${timestamp}.bak`;
  fs.copyFileSync(item.file, backup);
  const updated = item.content.replaceAll(needle, replacement);
  fs.writeFileSync(item.file, updated, 'utf8');
  changed++;
  console.log(`Fixed ${path.relative(root, item.file)} (${item.count} watermark font reference(s); backup: ${path.basename(backup)})`);
}

if (!changed) {
  console.log('Watermark font path is already configured; no source files changed.');
} else {
  console.log('Windows watermark font fix applied. FFmpeg drawtext will use C:/Windows/Fonts/arial.ttf instead of requiring Fontconfig discovery.');
  console.log('Next: verify the font file exists and run the 3-second FFmpeg test before retrying the full backfill.');
}
