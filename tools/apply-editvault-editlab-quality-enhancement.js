#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = {
  main: path.join(root, 'client', 'src', 'main.jsx'),
  component: path.join(root, 'client', 'src', 'EditLabRewards.jsx'),
  css: path.join(root, 'client', 'src', 'editlab-rewards.css'),
  route: path.join(root, 'server', 'src', 'routes', 'editlab.js'),
};

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`Required file not found: ${path.relative(root, file)}. Run from the EditVault project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one match for ${label}; found ${count}. No project files were changed.`);
  return source.replace(before, after);
}
function has(source, snippet) { return source.includes(snippet); }

try {
  let main = readRequired(files.main);
  let component = readRequired(files.component);
  let css = readRequired(files.css);
  let route = readRequired(files.route);

  // Guard against accidentally patching a different app/component.
  if (!has(component, "fetch(`${API_URL}/api/editlab/compress`")) throw new Error('EditLab export route did not match the expected project. No files were changed.');
  if (!has(route, "router.post('/compress', auth, processLimiter")) throw new Error('EditLab backend route did not match the expected project. No files were changed.');
  if (!has(component, "<small>{tx('Coming soon', 'قريبًا')}</small>")) throw new Error('The quality tab no longer looks like the expected placeholder. No files were changed.');

  // Frontend state and request payload for real FFmpeg controls (not falsely labelled as AI).
  component = replaceOnce(
    component,
    "  const [quality, setQuality] = useState('balanced');\n  const [processing, setProcessing] = useState(false);",
    "  const [quality, setQuality] = useState('balanced');\n  const [sharpness, setSharpness] = useState('medium');\n  const [denoise, setDenoise] = useState('off');\n  const [outputResolution, setOutputResolution] = useState('source');\n  const [processing, setProcessing] = useState(false);",
    'EditLab enhancement settings'
  );
  component = replaceOnce(
    component,
    "      body.append('preset', presetId);\n      body.append('quality', quality);\n      const response = await fetch(`${API_URL}/api/editlab/compress`, {",
    "      body.append('preset', presetId);\n      body.append('quality', quality);\n      body.append('sharpness', sharpness);\n      body.append('denoise', denoise);\n      body.append('resolution', outputResolution);\n      const response = await fetch(`${API_URL}/api/editlab/compress`, {",
    'enhancement request payload'
  );
  component = replaceOnce(
    component,
    "<span>{tx('AI quality boost', 'تحسين بالذكاء الاصطناعي')}</span><small>{tx('Coming soon', 'قريبًا')}</small>",
    "<span>{tx('Quality & sharpen', 'رفع الجودة والحدة')}</span><small>{tx('Sharpen · Denoise · Upscale', 'حدة · إزالة تشويش · رفع الدقة')}</small>",
    'quality tab label'
  );

  const oldPanel = `            {toolTab === 'ai' && <div className="evlr-tool-panel evlr-ai-panel" role="tabpanel">\n              <div className="evlr-ai-art"><div className="evlr-topaz-glow" /><Sparkles size={31} /></div>\n              <span className="evlr-coming-soon">{tx('COMING SOON', 'قريبًا')}</span>\n              <h3>{tx('AI Quality Boost', 'تحسين الجودة بالذكاء الاصطناعي')}</h3>\n              <p>{tx('Topaz integration is not active yet. We will enable it after API access, per-job cost limits, and a processing queue are configured.', 'ربط Topaz مش مفعّل حاليًا. هنضيفه بعد تجهيز صلاحيات الـ API وحدود تكلفة كل عملية وطابور المعالجة.')}</p>\n              <div className="evlr-feature-list"><span><CheckCircle2 size={14} /> {tx('Resolution enhancement', 'تحسين دقة الفيديو')}</span><span><CheckCircle2 size={14} /> {tx('Noise reduction', 'تقليل التشويش')}</span><span><Clock3 size={14} /> {tx('Controlled job queue', 'طابور معالجة منظّم')}</span></div>\n            </div>}`;
  const newPanel = `            {toolTab === 'ai' && <div className="evlr-tool-panel evlr-ai-panel evlr-enhance-panel" role="tabpanel">\n              <div className="evlr-control-heading"><div><span className="evlr-step">03</span><div><strong>{tx('Quality & detail controls', 'إعدادات الجودة والتفاصيل')}</strong><small>{tx('These controls are applied on the server during export. The browser preview cannot reproduce real sharpening or denoising.', 'الإعدادات دي بتتطبق على السيرفر وقت التصدير. معاينة المتصفح مش بتقدر تعرض الشاربن وإزالة التشويش الحقيقيين.')}</small></div></div><span className="evlr-mini-tag">FFMPEG</span></div>\n              <div className="evlr-enhance-grid">\n                <label className="evlr-enhance-control"><span>{tx('Sharpen', 'حدة التفاصيل')}</span><small>{tx('Add edge clarity', 'زود وضوح الحواف')}</small><select value={sharpness} onChange={(event) => setSharpness(event.target.value)}><option value="off">{tx('Off', 'إيقاف')}</option><option value="light">{tx('Light', 'خفيف')}</option><option value="medium">{tx('Medium', 'متوسط')}</option><option value="strong">{tx('Strong', 'قوي')}</option></select></label>\n                <label className="evlr-enhance-control"><span>{tx('Denoise', 'إزالة التشويش')}</span><small>{tx('Reduce grain and noise', 'قلل الحبيبات والتشويش')}</small><select value={denoise} onChange={(event) => setDenoise(event.target.value)}><option value="off">{tx('Off', 'إيقاف')}</option><option value="light">{tx('Light', 'خفيف')}</option><option value="medium">{tx('Medium', 'متوسط')}</option><option value="strong">{tx('Strong', 'قوي')}</option></select></label>\n                <label className="evlr-enhance-control"><span>{tx('Output resolution', 'دقة التصدير')}</span><small>{tx('Preserves aspect ratio', 'يحافظ على أبعاد الفيديو')}</small><select value={outputResolution} onChange={(event) => setOutputResolution(event.target.value)}><option value="source">{tx('Keep original', 'الأصلية')}</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="1440p">1440p</option><option value="4k">4K</option></select></label>\n              </div>\n              <div className="evlr-enhance-note"><Sparkles size={16} /><span>{tx('Sharpen, denoise and scaling are real FFmpeg operations—not generative AI. Upscaling with FFmpeg enlarges pixels but does not invent AI-recovered details.', 'الشاربن وإزالة التشويش وتغيير الدقة عمليات FFmpeg فعلية وليست ذكاءً اصطناعيًا توليديًا. تكبير الفيديو بـ FFmpeg لا يعيد بناء تفاصيل بالذكاء الاصطناعي.')}</span></div>\n              {processError && <div className="evlr-error" role="alert"><CircleHelp size={15} /> {processError}</div>}\n              {result && <div className="evlr-result" role="status"><CheckCircle2 size={17} /><div><strong>{tx('Enhancement export complete', 'اكتمل تحسين وتصدير الفيديو')}</strong><small>{formatBytes(result.before)} → {formatBytes(result.after)}</small></div><a href={result.url} download={result.name}><ArrowDownToLine size={14} /> {tx('Download again', 'إعادة التنزيل')}</a></div>}\n              <button type="button" className="evlr-export-btn" onClick={compressAndDownload} disabled={!file || processing}>{processing ? <><LoaderCircle size={17} className="evlr-spin" /> {tx('Enhancing video…', 'جارٍ تحسين الفيديو…')}</> : <><WandSparkles size={17} /> {tx('Enhance & export video', 'حسّن وصدّر الفيديو')} <ArrowRight size={16} /></>}</button>\n              {!user && <p className="evlr-signin-hint"><LockKeyhole size={13} /> {tx('Log in to export an enhanced video.', 'سجّل الدخول لتصدير الفيديو المحسّن.')}</p>}\n              {user?.role === 'admin' && onOpenTopaz && <button type="button" className="evlr-topaz-launch-btn" onClick={onOpenTopaz}><Sparkles size={15} /> {tx('Open Topaz AI Studio', 'افتح استوديو Topaz AI')} <ArrowRight size={14} /></button>}\n            </div>}`;
  component = replaceOnce(component, oldPanel, newPanel, 'quality tab placeholder panel');
  component = replaceOnce(
    component,
    'export default function EditLabRewards({ user, language = \'en\', onNotice, onLoginRequest, onPointsChange }) {',
    'export default function EditLabRewards({ user, language = \'en\', onNotice, onLoginRequest, onPointsChange, onOpenTopaz }) {',
    'EditLab Topaz launch prop'
  );

  // Backend: safe finite presets only. Never interpolate arbitrary user input into FFmpeg.
  route = replaceOnce(
    route,
    "const QUALITY = {\n  smaller: { crf: '28', preset: 'veryfast' },\n  balanced: { crf: '24', preset: 'medium' },\n  higher: { crf: '20', preset: 'slow' },\n};",
    "const QUALITY = {\n  smaller: { crf: '28', preset: 'veryfast' },\n  balanced: { crf: '24', preset: 'medium' },\n  higher: { crf: '20', preset: 'slow' },\n};\n\nconst SHARPEN = {\n  off: '',\n  light: 'unsharp=5:5:0.35:5:5:0',\n  medium: 'unsharp=5:5:0.75:5:5:0',\n  strong: 'unsharp=5:5:1.1:5:5:0',\n};\nconst DENOISE = {\n  off: '',\n  light: 'hqdn3d=1.2:1.2:3:3',\n  medium: 'hqdn3d=2:1.5:4:3',\n  strong: 'hqdn3d=3:2:6:4',\n};\nconst RESOLUTION = { source: null, '720p': 1280, '1080p': 1920, '1440p': 2560, '4k': 3840 };",
    'FFmpeg quality enhancement presets'
  );
  route = replaceOnce(
    route,
    '  limits: { fileSize: MAX_BYTES, files: 1, fields: 3 },',
    '  limits: { fileSize: MAX_BYTES, files: 1, fields: 8 },',
    'EditLab upload field limit'
  );
  route = replaceOnce(
    route,
    'function runFfmpeg(inputPath, outputPath, preset, quality) {\n  return new Promise((resolve, reject) => {\n    const args = [',
    "function runFfmpeg(inputPath, outputPath, preset, quality, enhancement) {\n  return new Promise((resolve, reject) => {\n    const videoFilters = [PRESETS[preset]];\n    if (DENOISE[enhancement.denoise]) videoFilters.push(DENOISE[enhancement.denoise]);\n    if (SHARPEN[enhancement.sharpness]) videoFilters.push(SHARPEN[enhancement.sharpness]);\n    const targetLongEdge = RESOLUTION[enhancement.resolution];\n    if (targetLongEdge) {\n      videoFilters.push(`scale=w='if(gte(iw,ih),${targetLongEdge},-2)':h='if(gte(iw,ih),-2,${targetLongEdge})':flags=lanczos`);\n    }\n    const args = [",
    'FFmpeg filter construction'
  );
  route = replaceOnce(
    route,
    "      '-vf', PRESETS[preset], '-c:v', 'libx264', '-crf', quality.crf,",
    "      '-vf', videoFilters.filter(Boolean).join(','), '-c:v', 'libx264', '-crf', quality.crf,",
    'FFmpeg active filter chain'
  );
  route = replaceOnce(
    route,
    "    if (!Object.prototype.hasOwnProperty.call(QUALITY, qualityId)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported export quality.' });\n    }\n\n    const jobDir = path.join(TMP_ROOT, crypto.randomUUID());",
    "    if (!Object.prototype.hasOwnProperty.call(QUALITY, qualityId)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported export quality.' });\n    }\n\n    const sharpness = String(req.body?.sharpness || 'off');\n    const denoise = String(req.body?.denoise || 'off');\n    const resolution = String(req.body?.resolution || 'source');\n    if (!Object.prototype.hasOwnProperty.call(SHARPEN, sharpness)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported sharpness setting.' });\n    }\n    if (!Object.prototype.hasOwnProperty.call(DENOISE, denoise)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported denoise setting.' });\n    }\n    if (!Object.prototype.hasOwnProperty.call(RESOLUTION, resolution)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported output resolution.' });\n    }\n\n    const jobDir = path.join(TMP_ROOT, crypto.randomUUID());",
    'validate enhancement controls'
  );
  route = replaceOnce(
    route,
    '      await runFfmpeg(jobInput, outputPath, preset, QUALITY[qualityId]);',
    '      await runFfmpeg(jobInput, outputPath, preset, QUALITY[qualityId], { sharpness, denoise, resolution });',
    'pass enhancement controls to FFmpeg'
  );

  // Responsive form controls are appended rather than rewriting the existing stylesheet.
  const cssAdd = `\n\n/* EditLab quality controls: responsive sharpening, denoise and target resolution. */\n.evlr-enhance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin:14px 0 12px}\n.evlr-enhance-control{display:flex;flex-direction:column;gap:7px;min-width:0;padding:13px;border:1px solid var(--evlr-line);border-radius:13px;background:rgba(12,16,25,.72)}\n.evlr-enhance-control>span{font-size:12px;font-weight:850;color:var(--evlr-text)}\n.evlr-enhance-control>small{font-size:10px;line-height:1.5;color:var(--evlr-muted);min-height:28px}\n.evlr-enhance-control select{width:100%;min-width:0;border:1px solid var(--evlr-line);border-radius:9px;background:#0c1018;color:var(--evlr-text);padding:10px 9px;font:inherit;font-size:11px}\n.evlr-enhance-note{display:flex;align-items:flex-start;gap:9px;padding:12px;border:1px solid rgba(153,129,240,.22);border-radius:11px;background:rgba(137,108,228,.07);color:var(--evlr-muted);font-size:10px;line-height:1.6}\n.evlr-enhance-note svg{flex:0 0 auto;color:#baa7ff;margin-top:1px}\n.evlr-topaz-launch-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;padding:12px;border:1px solid rgba(149,127,240,.45);border-radius:11px;background:rgba(126,102,222,.11);color:#dfd5ff;font-size:11px;font-weight:800;cursor:pointer}\n.evlr-topaz-launch-btn:hover{background:rgba(126,102,222,.2)}\n@media(max-width:760px){.evlr-enhance-grid{grid-template-columns:1fr}}\n@media(max-width:680px){.evlr-enhance-control{padding:11px}.evlr-enhance-control>small{min-height:0}.evlr-enhance-note{font-size:9px;padding:10px}}\n`;
  if (!has(css, '/* EditLab quality controls: responsive sharpening, denoise and target resolution. */')) css += cssAdd;

  // If the Topaz admin modal is installed, connect its opener from the quality tab.
  const topazInstalled = has(main, "const [topazOpen, setTopazOpen] = useState(false);") && has(main, '<TopazAdmin open={topazOpen}');
  if (topazInstalled && !has(main, 'onOpenTopaz={() => setTopazOpen(true)}')) {
    main = replaceOnce(
      main,
      '<EditLabRewards user={user} language={language} onNotice={setNotice} onLoginRequest={() => openAuth(\'login\')} onPointsChange={setPoints} />',
      '<EditLabRewards user={user} language={language} onNotice={setNotice} onLoginRequest={() => openAuth(\'login\')} onPointsChange={setPoints} onOpenTopaz={() => setTopazOpen(true)} />',
      'connect EditLab to existing Topaz admin modal'
    );
  }

  // All edits are prepared and validated before any project file is written.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, `editvault-editlab-quality-backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: false });
  for (const [key, file] of Object.entries(files)) fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  for (const [file, content] of [[files.main, main], [files.component, component], [files.css, css], [files.route, route]]) {
    fs.writeFileSync(file, content, 'utf8');
  }

  console.log('EditVault EditLab quality controls installed.');
  console.log('Enabled server-side sharpen, denoise and aspect-ratio-preserving resolution controls.');
  console.log(topazInstalled ? 'Connected the admin-only Topaz AI Studio launcher.' : 'Topaz AI Studio was not detected; local quality controls are installed without a Topaz launcher.');
  console.log('Local quality filters use FFmpeg and do not consume Topaz API credits. Upscaling here is conventional scaling, not AI detail reconstruction.');
  console.log('Backup created at: ' + path.relative(root, backupDir));
  console.log('No database migration is required. Restart the backend and refresh Vite.');
} catch (error) {
  console.error('EditLab quality update stopped: ' + error.message);
  process.exitCode = 1;
}
