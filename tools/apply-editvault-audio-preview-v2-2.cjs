"use strict";
// EditVault Audio Lab V2.2: listen to the processed audio before downloading.
// This targeted patch deliberately keeps existing 10-minute/150 MB adjustments.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const jsxRel = 'client/src/AudioLab.jsx';
const cssRel = 'client/src/audio-lab.css';
const jsxPath = path.join(root, jsxRel);
const cssPath = path.join(root, cssRel);
const marker = 'EditVault Audio Preview V2.2';

if (!fs.existsSync(jsxPath) || !fs.existsSync(cssPath)) {
  console.error('ERROR: Audio Lab V2 is not installed. Missing client/src/AudioLab.jsx or audio-lab.css');
  process.exit(1);
}
let jsx = fs.readFileSync(jsxPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
if (jsx.includes(marker) || css.includes(marker)) {
  console.log('Audio Preview V2.2 is already installed. No changes made.');
  process.exit(0);
}
const changes = [
  {
    label: 'remove immediate auto-download',
    from: `      const link = document.createElement('a');
      link.href = url; link.download = name;
      document.body.appendChild(link); link.click(); link.remove();`,
    to: `      // Audio Preview V2.2: keep the generated file in memory for playback.
      // Download starts only when the user clicks the download link below.`,
  },
  {
    label: 'notice of playable preview',
    from: `onNotice?.(tx('Your audio is ready.', 'الصوت جاهز للتنزيل.'));`,
    to: `onNotice?.(tx('Your audio is ready to preview. Listen before downloading.', 'الصوت جاهز للمعاينة. اسمع النتيجة قبل التنزيل.'));`,
  },
  {
    label: 'process button prevents duplicate charging',
    from: `<button type="button" disabled={busy || !file} className="eval-export" onClick={process}>{busy ? <><LoaderCircle size={18} className="eval-spin"/>{tx('Processing audio...', 'جارٍ معالجة الصوت...')}</> : <><ArrowDownToLine size={19}/>{user ? tx('Process & download MP3', 'معالجة وتنزيل MP3') : tx('Sign in to process', 'سجّل دخولك للمعالجة')}</>}</button>`,
    to: `<button type="button" disabled={busy || !file || !!result} className="eval-export" onClick={process}>{busy ? <><LoaderCircle size={18} className="eval-spin"/>{tx('Processing audio...', 'جارٍ معالجة الصوت...')}</> : result ? <><CheckCircle2 size={19}/>{tx('Preview ready below', 'المعاينة جاهزة بالأسفل')}</> : <><Headphones size={19}/>{user ? tx('Process & preview audio', 'معالجة الصوت ومعاينة النتيجة') : tx('Sign in to process', 'سجّل دخولك للمعالجة')}</>}</button>`,
  },
  {
    label: 'charge information',
    from: `{tx('Points are charged on successful processing. Failed jobs are refunded. Files are deleted from the server after download.', 'النقاط تُحجز وقت المعالجة، وبترجع لو العملية فشلت. الملفات المؤقتة بتتمسح بعد إرسال النتيجة.')}`,
    to: `{tx('Processing costs the points shown above. Listening and downloading the finished result cost no additional points. Failed jobs are refunded.', 'المعالجة بتكلف النقاط الموضحة فوق. سماع النتيجة وتنزيلها بعد المعالجة من غير خصم إضافي. لو المعالجة فشلت بترجع النقاط.')}`,
  },
  {
    label: 'processed audio player and explicit download',
    from: `{result && <div className="eval-success"><CheckCircle2 size={19}/><div><strong>{tx('Your audio is ready!', 'الصوت جاهز!')}</strong><small>{result.name} · {formatBytes(result.size)}</small></div><a href={result.url} download={result.name}>{tx('Download again', 'تنزيل مرة تانية')}</a></div>}`,
    to: `{/* EditVault Audio Preview V2.2 */}
          {result && <section className="eval-preview-result" aria-label={tx('Processed audio preview', 'معاينة الصوت بعد التعديل')}>
            <div className="eval-preview-heading"><span className="eval-preview-icon"><CheckCircle2 size={20}/></span><div><strong>{tx('Listen before downloading', 'اسمع النتيجة قبل التنزيل')}</strong><small>{tx('Your processed audio is ready. Compare it with the original player above.', 'الصوت بعد التعديل جاهز. تقدر تقارنه بالملف الأصلي اللي فوق.')}</small></div></div>
            <div className="eval-preview-track"><div className="eval-preview-track-title"><Headphones size={17}/><span>{tx('Processed audio', 'الصوت بعد التعديل')}</span><span className="eval-preview-badge">MP3</span></div><audio key={result.url} src={result.url} controls preload="metadata" aria-label={tx('Play processed audio', 'تشغيل الصوت بعد التعديل')}/><small className="eval-preview-file" title={result.name}>{result.name} · {formatBytes(result.size)}</small></div>
            <a className="eval-preview-download" href={result.url} download={result.name}><ArrowDownToLine size={19}/>{tx('Download final MP3', 'تنزيل الصوت النهائي MP3')}</a>
            <p className="eval-preview-help">{tx('Replay as often as you like with no extra points. The preview disappears if you choose another file or tool.', 'اسمع النتيجة براحتك من غير نقاط إضافية. المعاينة هتختفي لو غيّرت الملف أو الأداة.')}</p>
          </section>}`,
  }
];

for (const change of changes) {
  const matches = jsx.split(change.from).length - 1;
  if (matches !== 1) {
    console.error(`ERROR: ${change.label}: expected one matching section, got ${matches}.`);
    console.error('Your AudioLab.jsx differs from the supported V2 version. No files were changed.');
    process.exit(1);
  }
  jsx = jsx.replace(change.from, change.to);
}
jsx = `/* ${marker} */\n` + jsx;
css += `\n/* ${marker} — preview player / explicit download */
.evlr-root .eval-preview-result{margin-top:17px;padding:18px;border:1px solid #c6ff4d58;border-radius:15px;background:radial-gradient(ellipse at 0 0,#c6ff4d14,transparent 65%),#101711;box-shadow:0 12px 30px #0003}
.evlr-root .eval-preview-heading{display:flex;align-items:center;gap:12px;margin-bottom:17px}
.evlr-root .eval-preview-icon{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:12px;color:#c6ff4d;background:#c6ff4d16;border:1px solid #c6ff4d45}
.evlr-root .eval-preview-heading>div{display:grid;gap:5px;min-width:0}
.evlr-root .eval-preview-heading strong{font-size:15px;color:#f8fff1}
.evlr-root .eval-preview-heading small{font-size:11px;line-height:1.6;color:#a9b7a5}
.evlr-root .eval-preview-track{padding:14px;border:1px solid #ffffff1c;border-radius:12px;background:#0c100e}
.evlr-root .eval-preview-track-title{display:flex;align-items:center;gap:8px;color:#eaf7e4;font-size:12px;font-weight:800;margin-bottom:12px}
.evlr-root .eval-preview-track-title svg{color:#c6ff4d}
.evlr-root .eval-preview-badge{margin-inline-start:auto;font:700 10px 'DM Mono',monospace;color:#c6ff4d;border:1px solid #c6ff4d55;border-radius:6px;padding:4px 7px}
.evlr-root .eval-preview-track audio{display:block;width:100%;min-width:0;max-width:100%;height:47px;accent-color:#c6ff4d}
.evlr-root .eval-preview-file{display:block;min-width:0;margin-top:9px;color:#94a38f;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.evlr-root .eval-preview-download{display:flex;justify-content:center;align-items:center;gap:10px;width:100%;min-height:48px;margin-top:13px;padding:12px 16px;border:1px solid #c6ff4d;border-radius:11px;background:#c6ff4d;color:#111a0d!important;font-size:13px;font-weight:850;text-decoration:none;transition:background .2s,transform .2s}
.evlr-root .eval-preview-download:hover{background:#e1ff9f;transform:translateY(-1px)}
.evlr-root .eval-preview-download:focus-visible{outline:3px solid #f2ffd2;outline-offset:3px}
.evlr-root .eval-preview-help{font-size:10px;line-height:1.8;color:#9daa9b;margin:11px 0 0}
@media(max-width:640px){.evlr-root .eval-preview-result{padding:14px}.evlr-root .eval-preview-heading{align-items:flex-start}.evlr-root .eval-preview-heading strong{font-size:14px}.evlr-root .eval-preview-track{padding:11px}}
@media(prefers-reduced-motion:reduce){.evlr-root .eval-preview-download{transition:none}.evlr-root .eval-preview-download:hover{transform:none}}
`;

const backupDir = path.join(root, 'backups', 'before-audio-preview-v2-2-' + new Date().toISOString().replace(/[:.]/g, '-'));
try {
  for (const rel of [jsxRel, cssRel]) {
    const backupTarget = path.join(backupDir, rel);
    fs.mkdirSync(path.dirname(backupTarget), {recursive: true});
    fs.copyFileSync(path.join(root, rel), backupTarget);
  }
  try {
    fs.writeFileSync(jsxPath, jsx, 'utf8');
    fs.writeFileSync(cssPath, css, 'utf8');
  } catch (e) {
    fs.copyFileSync(path.join(backupDir, jsxRel), jsxPath);
    fs.copyFileSync(path.join(backupDir, cssRel), cssPath);
    throw e;
  }
  console.log('SUCCESS: Audio Lab preview is ready.');
  console.log('Updated: client/src/AudioLab.jsx and client/src/audio-lab.css');
  console.log('Backups:', backupDir);
  console.log('The app no longer downloads automatically after processing.');
  console.log('No server/DB changes. Existing max file-size and duration limits were preserved.');
  console.log('Restart the frontend and refresh /editlab.');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
