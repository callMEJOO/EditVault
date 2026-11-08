'use strict';
// Targeted Audio Lab V2 duration / upload-size update (no DB changes).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const jobs = [
  {
    file: 'client/src/AudioLab.jsx',
    changes: [
      ['const MAX_BYTES = 80 * 1024 * 1024;', 'const MAX_BYTES = 150 * 1024 * 1024;\nconst MAX_SECONDS = 600;'],
      ["'Maximum file size is 80 MB.'", "'Maximum file size is 150 MB.'"],
      ["'الحد الأقصى لحجم الملف 80 ميجابايت.'", "'الحد الأقصى لحجم الملف 150 ميجابايت.'"],
      ['b - a > 180', 'b - a > MAX_SECONDS'],
      ["'Max 3 minutes'", "'Max 10 minutes'"],
      ["'حد أقصى ٣ دقائق'", "'حد أقصى ١٠ دقائق'"],
      ["'80 MB max · 3 minutes max'", "'150 MB max · 10 minutes max'"],
      ["'حتى ٨٠ ميجابايت · ٣ دقائق'", "'حتى ١٥٠ ميجابايت · ١٠ دقائق'"],
      ['Math.min(d, 180)', 'Math.min(d, MAX_SECONDS)'],
      ['max="180"', 'max="600"'],
    ],
    extra: (src) => {
      const line = "    if (selected.id === 'extract' && !isVideo) { setError(tx('Choose a video file to extract its audio.', 'لاستخراج الصوت، اختار ملف فيديو.')); return; }";
      if (!src.includes(line)) throw new Error('AudioLab process guard changed; need current source.');
      src = src.replace(line, line + "\n    if (duration && duration > MAX_SECONDS + 0.1) { setError(tx('Choose a file up to 10 minutes long.', 'اختار ملف مدته ١٠ دقائق أو أقل.')); return; }");
      const errorLine = "        throw new Error(data.error || tx('Audio processing failed.', 'تعذّرت معالجة الصوت.'));";
      if (!src.includes(errorLine)) throw new Error('AudioLab API error rendering changed; need current source.');
      src = src.replace(errorLine, "        if (data.error === 'Choose a file up to 10 minutes long.') throw new Error(tx(data.error, 'اختار ملف مدته ١٠ دقائق أو أقل.'));\n" + errorLine);
      return src;
    }
  },
  {
    file: 'server/src/routes/editlab-audio.js',
    changes: [
      ['const MAX_BYTES = 80 * 1024 * 1024;', 'const MAX_BYTES = 150 * 1024 * 1024;'],
      ['const MAX_SECONDS = 180;', 'const MAX_SECONDS = 600;'],
      ['timeoutMs = 100_000', 'timeoutMs = 480_000'],
      ["'File exceeds the 80 MB audio limit.'", "'File exceeds the 150 MB audio limit.'"],
      ["'Enter a valid start/end time. Maximum clip length: 180 seconds.'", "'Enter a valid start/end time. Maximum clip length: 600 seconds.'"],
      ["'Choose a file up to 3 minutes long.'", "'Choose a file up to 10 minutes long.'"],
    ]
  }
];
const plan = [];
for (const job of jobs) {
  const p = path.join(root, ...job.file.split('/'));
  if (!fs.existsSync(p)) { console.error('Missing:', job.file, '\nInstall Audio Lab V2 first.'); process.exit(1); }
  let src = fs.readFileSync(p, 'utf8');
  const already = job.file.includes('AudioLab.jsx') ? src.includes('const MAX_SECONDS = 600;') : src.includes('const MAX_SECONDS = 600;');
  if (already) { console.error('This file already has the 10-minute setting. No changes made.'); process.exit(1); }
  for (const [from, to] of job.changes) {
    const matches = src.split(from).length - 1;
    // Math.min and max fields appear twice (video & audio, start & end).
    const expected = from === 'Math.min(d, 180)' || from === 'max="180"' ? 2 : 1;
    if (matches !== expected) {
      console.error(`Cannot safely patch ${job.file}: expected ${expected} occurrences of ${from}, found ${matches}. No changes made.`);
      process.exit(1);
    }
    src = src.split(from).join(to);
  }
  try { if (job.extra) src = job.extra(src); } catch (e) { console.error(e.message, 'No changes made.'); process.exit(1); }
  plan.push({ p, src, file: job.file });
}
const backup = path.join(root, 'backups', 'before-audio-duration-v2-1-' + new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup, { recursive: true });
for (const job of plan) {
  const backupFile = path.join(backup, ...job.file.split('/'));
  fs.mkdirSync(path.dirname(backupFile), { recursive: true });
  fs.copyFileSync(job.p, backupFile);
}
let modified = [];
try {
  for (const job of plan) { fs.writeFileSync(job.p, job.src, 'utf8'); modified.push(job); console.log('Updated:', job.file); }
} catch (e) {
  for (const job of modified) fs.copyFileSync(path.join(backup, ...job.file.split('/')), job.p);
  console.error('Update failed and prior files restored:', e.message); process.exit(1);
}
console.log('\nSUCCESS — Audio Lab now allows up to 10 minutes and 150 MB.');
console.log('Backup:', backup);
console.log('Restart BOTH server and client before testing.');
console.log('Note: long processing may still time out on hosting platforms with HTTP request limits.');
