#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = process.cwd();
const targets = {
  main: path.join(root, 'client', 'src', 'main.jsx'),
  editlabUi: path.join(root, 'client', 'src', 'EditLabRewards.jsx'),
  editlabRoute: path.join(root, 'server', 'src', 'routes', 'editlab.js'),
  topazUi: path.join(root, 'client', 'src', 'TopazAdmin.jsx'),
  topazRoute: path.join(root, 'server', 'src', 'routes', 'topaz.js'),
};

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error('Required file not found: ' + path.relative(root, file) + '. Extract this patch into the EditVault project root.');
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error('Expected exactly one match for ' + label + '; found ' + count + '. No project files were changed.');
  return source.replace(before, after);
}
function replaceRegion(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error('Could not locate start of ' + label + '. No project files were changed.');
  if (source.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error('Found multiple start markers for ' + label + '. No project files were changed.');
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error('Could not locate end of ' + label + '. No project files were changed.');
  return source.slice(0, start) + replacement + source.slice(end);
}
function wrapRegion(source, startMarker, endMarker, prefix, suffix, label) {
  const start = source.indexOf(startMarker);
  if (start < 0 || source.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error('Could not uniquely locate ' + label + '. No project files were changed.');
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0 || source.indexOf(endMarker, end + endMarker.length) >= 0) throw new Error('Could not uniquely locate the end of ' + label + '. No project files were changed.');
  const endExclusive = end + endMarker.length;
  return source.slice(0, start) + prefix + source.slice(start, endExclusive) + suffix + source.slice(endExclusive);
}
function ensure(source, marker, label) {
  if (!source.includes(marker)) throw new Error('This project does not contain expected ' + label + '. No project files were changed.');
}
function replaceAllExpected(source, before, after, expectedCount, label) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) throw new Error('Expected ' + expectedCount + ' matches for ' + label + '; found ' + count + '. No project files were changed.');
  return source.split(before).join(after);
}

const imageOnlyTopazComponent = String.raw`import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, Image as ImageIcon, ShieldCheck, Upload, X } from 'lucide-react';
import './topaz-admin.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export default function TopazAdmin({ open, onClose, user, onNotice }) {
  const [apiState, setApiState] = useState('checking');
  const [file, setFile] = useState(null);
  const [model, setModel] = useState('Standard V2');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const stopPolling = useRef(false);

  const token = () => localStorage.getItem('editvault_token');
  const requestHeaders = () => ({ Authorization: 'Bearer ' + token() });
  const isTerminal = (status) => ['completed', 'complete', 'succeeded', 'success', 'done', 'failed', 'cancelled', 'error'].includes(String(status || '').toLowerCase());

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setApiState('checking');
    setError('');
    fetch(API_URL + '/api/topaz/status', { headers: requestHeaders() })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not check Topaz configuration.');
        if (live) setApiState(data.configured ? 'configured' : 'missing');
      })
      .catch((requestError) => { if (live) { setApiState('error'); setError(requestError.message || 'Could not check Topaz.'); } });
    return () => { live = false; };
  }, [open, user && user.id]);

  useEffect(() => {
    if (!open || !job || !job.processId || isTerminal(job.status)) return undefined;
    stopPolling.current = false;
    const poll = async () => {
      for (let attempt = 0; attempt < 180 && !stopPolling.current; attempt += 1) {
        await sleep(3000);
        if (stopPolling.current) return;
        try {
          const response = await fetch(API_URL + '/api/topaz/images/' + encodeURIComponent(job.processId) + '/status', { headers: requestHeaders() });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Topaz status check failed.');
          const rawStatus = String(data.status || 'Processing');
          const lower = rawStatus.toLowerCase();
          if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(lower)) {
            let downloadUrl = data.downloadUrl || data.url || '';
            if (!downloadUrl) {
              const downloadResponse = await fetch(API_URL + '/api/topaz/images/' + encodeURIComponent(job.processId) + '/download', { headers: requestHeaders() });
              const downloadData = await downloadResponse.json().catch(() => ({}));
              if (!downloadResponse.ok) throw new Error(downloadData.error || 'Topaz finished but the download link is not ready yet.');
              downloadUrl = downloadData.url || '';
            }
            setJob((current) => current && current.processId === job.processId ? { ...current, status: 'Completed', downloadUrl } : current);
            setBusy(false);
            return;
          }
          if (['failed', 'cancelled', 'error'].includes(lower)) {
            setJob((current) => current && current.processId === job.processId ? { ...current, status: rawStatus } : current);
            setError('Topaz image job ended with status: ' + rawStatus);
            setBusy(false);
            return;
          }
          setJob((current) => current && current.processId === job.processId ? { ...current, status: rawStatus } : current);
        } catch (requestError) {
          setError(requestError.message || 'Unable to check Topaz image job.');
          setBusy(false);
          return;
        }
      }
      if (!stopPolling.current) {
        setError('This image job is taking longer than the in-page wait. Check the Topaz dashboard before submitting another job.');
        setBusy(false);
      }
    };
    poll();
    return () => { stopPolling.current = true; };
  }, [open, job && job.processId]);

  if (!open) return null;

  const selectFile = (selectedFile) => {
    setError('');
    setJob(null);
    if (!selectedFile) { setFile(null); return; }
    const validMime = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'].includes(selectedFile.type);
    const validExt = /\.(jpg|jpeg|png|webp|tif|tiff)$/i.test(selectedFile.name || '');
    if (!validMime && !validExt) { setFile(null); setError('Choose a JPG, PNG, WebP, or TIFF image.'); return; }
    if (selectedFile.size > MAX_IMAGE_BYTES) { setFile(null); setError('Image exceeds the 25 MB Topaz test limit.'); return; }
    setFile(selectedFile);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) { setError('Choose an image first.'); return; }
    if (!window.confirm('Topaz will process this image and may consume paid API credits. Continue?')) return;
    setBusy(true);
    setError('');
    setJob(null);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('model', model);
      const response = await fetch(API_URL + '/api/topaz/images', { method: 'POST', headers: requestHeaders(), body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ('Topaz image request failed (' + response.status + ').'));
      const processId = data.processId || data.requestId;
      if (!processId) throw new Error('Topaz accepted the image request but did not return a job ID. Check the Topaz dashboard before retrying.');
      setJob({ processId: String(processId), status: data.status || 'Queued', downloadUrl: '', info: model });
      onNotice && onNotice('Topaz image enhancement submitted.');
    } catch (requestError) {
      setError(requestError.message || 'Could not submit the Topaz image job.');
      setBusy(false);
    }
  };

  const terminal = job && isTerminal(job.status);
  return (
    <div className="topaz-admin-backdrop" role="presentation" onClick={onClose}>
      <section className="topaz-admin-modal" role="dialog" aria-modal="true" aria-label="Topaz image enhancement" onClick={(event) => event.stopPropagation()}>
        <header className="topaz-admin-header">
          <div className="topaz-admin-brand"><span><ImageIcon size={22} /></span><div><small>EDITVAULT / ADMIN ONLY</small><h2>Topaz Image Enhancer</h2><p>AI enhancement for still images only</p></div></div>
          <button type="button" className="topaz-admin-close" onClick={onClose} aria-label="Close Topaz image enhancer"><X /></button>
        </header>

        {apiState !== 'configured' && <div className={'topaz-admin-key-state ' + (apiState === 'configured' ? 'is-good' : 'is-warn')}>
          <span className="topaz-admin-state-dot" />
          {apiState === 'checking' ? 'Checking server configuration…' : apiState === 'missing' ? 'TOPAZ_API_KEY is missing from server/.env. Save it and restart the backend.' : error || 'Topaz configuration could not be checked.'}
        </div>}

        <form className="topaz-admin-form" onSubmit={submit}>
          <label className="topaz-admin-file-picker">
            <Upload size={22} />
            <strong>{file ? file.name : 'Choose an image'}</strong>
            <span>JPG, PNG, WebP, or TIFF · up to 25 MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/tiff,.jpg,.jpeg,.png,.webp,.tif,.tiff" onChange={(event) => selectFile(event.target.files && event.target.files[0])} />
          </label>

          <label>Enhancement model
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option>Standard V2</option>
              <option>High Fidelity V2</option>
            </select>
            <small>Image enhancement can consume paid Topaz API credits.</small>
          </label>

          <div className="topaz-admin-cost-note"><Activity size={17} /><p>Only image processing is enabled here. Video quality, sharpening, denoise, and frame rate are handled in EditLab. Check the <a href="https://developer.topazlabs.com/credit-calculator" target="_blank" rel="noreferrer">Topaz credit calculator</a> before starting an expensive job. This tool is restricted to your administrator account.</p></div>
          {error && <div className="topaz-admin-error" role="alert">{error}</div>}
          <button className="topaz-admin-submit" type="submit" disabled={busy || apiState !== 'configured' || !file}>{busy ? 'Submitting image job…' : 'Enhance image with Topaz'} <ArrowDownToLine size={17} /></button>
        </form>

        {job && <section className="topaz-admin-job" aria-live="polite">
          <div className="topaz-admin-job-top"><div><small>TOPAZ IMAGE JOB</small><strong>{job.processId}</strong></div><span className={'topaz-admin-job-status ' + (terminal ? 'is-terminal' : '')}>{job.status || 'Queued'}</span></div>
          {job.info && <p>{job.info}</p>}
          {!terminal && <p>Keep this panel open while the image job is checked. Processing time depends on image size and model.</p>}
          {job.status === 'Completed' && job.downloadUrl ? <a className="topaz-admin-download" href={job.downloadUrl} target="_blank" rel="noreferrer"><ArrowDownToLine size={17} /> Download enhanced image</a> : null}
          {job.status === 'Completed' && !job.downloadUrl ? <p>Topaz reports the image is finished but no download URL was returned. Check the Topaz dashboard before submitting another job.</p> : null}
        </section>}
      </section>
    </div>
  );
}
`;

try {
  let main = readRequired(targets.main);
  let ui = readRequired(targets.editlabUi);
  let route = readRequired(targets.editlabRoute);
  let topazUi = readRequired(targets.topazUi);
  let topazRoute = readRequired(targets.topazRoute);

  ensure(ui, "const PROCESSING_COST_POINTS = 10;", 'existing EditLab point cost setting');
  if (ui.includes("body.append('frameRate'")) throw new Error('Frame-rate settings appear to be already installed or the project differs from the expected version. No project files were changed.');
  ensure(route, 'const EDITLAB_COST_POINTS = 10;', 'current server EditLab point cost setting');
  ensure(route, 'async function chargeEditLabPoints(userId)', 'EditLab wallet charge function');
  ensure(route, 'async function refundEditLabPoints(userId, chargeId)', 'EditLab wallet refund function');
  ensure(topazUi, "const [mode, setMode] = useState('image');", 'two-mode Topaz admin panel');
  ensure(topazRoute, "router.post('/videos', handleUpload(videoUpload, 'video', 25)", 'Topaz video endpoint');
  ensure(main, '<TopazAdmin open={topazOpen}', 'Topaz admin modal mount');

  // Client-side pricing mirrors the server formula so users see the actual price before export.
  ui = replaceOnce(ui, '  Clipboard, Clock3, Coins, Copy, Film, Gift, Gauge, Link2, LoaderCircle,', '  Clipboard, Clock3, Coins, Copy, Film, Gift, Image as ImageIcon, Gauge, Link2, LoaderCircle,', 'image-only Topaz tab icon import');
  ui = replaceOnce(ui, "const PROCESSING_COST_POINTS = 10;", `const PROCESSING_BASE_POINTS = 10;
const PROCESSING_POINT_COSTS = {
  quality: { smaller: 0, balanced: 2, higher: 5 },
  resolution: { source: 0, '720p': 2, '1080p': 5, '1440p': 9, '4k': 15 },
  sharpness: { off: 0, light: 1, medium: 2, strong: 3 },
  denoise: { off: 0, light: 1, medium: 2, strong: 3 },
  frameRate: { source: 0, '24': 1, '30': 2, '48': 4, '60': 6 },
};
function calculateProcessingCost(options) {
  return PROCESSING_BASE_POINTS + PROCESSING_POINT_COSTS.quality[options.quality]
    + PROCESSING_POINT_COSTS.resolution[options.resolution]
    + PROCESSING_POINT_COSTS.sharpness[options.sharpness]
    + PROCESSING_POINT_COSTS.denoise[options.denoise]
    + PROCESSING_POINT_COSTS.frameRate[options.frameRate];
}`, 'dynamic client pricing');

  ui = replaceOnce(ui, "  const [outputResolution, setOutputResolution] = useState('source');", "  const [outputResolution, setOutputResolution] = useState('source');\n  const [frameRate, setFrameRate] = useState('source');", 'frame-rate state');
  ui = replaceOnce(ui, "  const [sharpness, setSharpness] = useState('medium');", "  const [sharpness, setSharpness] = useState('off');", 'use 10-point base price by default');
  ui = replaceOnce(ui, "  const activePreset = useMemo(() => PRESETS.find((preset) => preset.id === presetId) || PRESETS[0], [presetId]);", "  const activePreset = useMemo(() => PRESETS.find((preset) => preset.id === presetId) || PRESETS[0], [presetId]);\n  const advancedVideoSettings = toolTab === 'ai';\n  const processingCostPoints = calculateProcessingCost({\n    quality,\n    resolution: advancedVideoSettings ? outputResolution : 'source',\n    sharpness: advancedVideoSettings ? sharpness : 'off',\n    denoise: advancedVideoSettings ? denoise : 'off',\n    frameRate: advancedVideoSettings ? frameRate : 'source',\n  });", 'dynamic price calculation');

  ui = replaceOnce(ui, "        if (data.code === 'INSUFFICIENT_EDITLAB_POINTS') {\n          throw new Error(isArabic ? `التصدير يكلف 10 نقاط. رصيدك الحالي ${Number(data.balance || 0)} نقطة.` : data.error);\n        }", "        if (data.code === 'INSUFFICIENT_EDITLAB_POINTS') {\n          const requiredPoints = Number(data.requiredPoints || processingCostPoints);\n          const balance = Number(data.balance || 0);\n          throw new Error(isArabic ? `التصدير بالإعدادات دي يكلف ${requiredPoints} نقطة. رصيدك الحالي ${balance} نقطة.` : (data.error || `This export costs ${requiredPoints} points. Your current balance is ${balance}.`));\n        }", 'dynamic insufficient balance message');

  ui = replaceOnce(ui, "      body.append('sharpness', sharpness);\n      body.append('denoise', denoise);\n      body.append('resolution', outputResolution);", "      body.append('sharpness', advancedVideoSettings ? sharpness : 'off');\n      body.append('denoise', advancedVideoSettings ? denoise : 'off');\n      body.append('resolution', advancedVideoSettings ? outputResolution : 'source');\n      body.append('frameRate', advancedVideoSettings ? frameRate : 'source');", 'send selected frame rate and precise export settings');

  ui = replaceAllExpected(ui, "<div className=\"evlr-cost-hint\"><Coins size={14} /><span>{tx(`Each export costs ${PROCESSING_COST_POINTS} points.`, `كل عملية تصدير تكلف ${PROCESSING_COST_POINTS} نقاط.`)}</span></div>", "<div className=\"evlr-cost-hint\"><Coins size={14} /><span>{tx(`Estimated export cost: ${processingCostPoints} points. Quality and processing options change the price.`, `تكلفة التصدير بالإعدادات الحالية: ${processingCostPoints} نقطة. السعر يزيد مع الجودة وإعدادات المعالجة.`)}</span></div>", 2, 'dynamic prices in both video panels');

  const outputResolutionLabel = "<label className=\"evlr-enhance-control\"><span>{tx('Output resolution', 'دقة التصدير')}</span><small>{tx('Preserves aspect ratio', 'يحافظ على أبعاد الفيديو')}</small><select value={outputResolution} onChange={(event) => setOutputResolution(event.target.value)}><option value=\"source\">{tx('Keep original', 'الأصلية')}</option><option value=\"720p\">720p</option><option value=\"1080p\">1080p</option><option value=\"1440p\">1440p</option><option value=\"4k\">4K</option></select></label>";
  const outputResolutionAndFps = outputResolutionLabel + "\n                <label className=\"evlr-enhance-control\"><span>{tx('Frame rate (FPS)', 'معدل الإطارات')}</span><small>{tx('FFmpeg drops or duplicates frames; this is not AI frame interpolation.', 'يتم حذف أو تكرار الإطارات بـ FFmpeg، وليس توليد إطارات بالذكاء الاصطناعي.')}</small><select value={frameRate} onChange={(event) => setFrameRate(event.target.value)}><option value=\"source\">{tx('Keep source FPS', 'معدل المصدر')}</option><option value=\"24\">24 FPS</option><option value=\"30\">30 FPS</option><option value=\"48\">48 FPS</option><option value=\"60\">60 FPS</option></select></label>";
  ui = replaceOnce(ui, outputResolutionLabel, outputResolutionAndFps, 'frame rate selector');

  const oldAiTab = "          <button type=\"button\" role=\"tab\" aria-selected={toolTab === 'ai'} className={toolTab === 'ai' ? 'is-active' : ''} onClick={() => setToolTab('ai')}><Sparkles size={17} /><span>{tx('Quality & sharpen', 'رفع الجودة والحدة')}</span><small>{tx('Sharpen · Denoise · Upscale', 'حدة · إزالة تشويش · رفع الدقة')}</small></button>";
  const newAiTab = oldAiTab + "\n          {user?.role === 'admin' && onOpenTopaz && <button type=\"button\" role=\"tab\" aria-selected={toolTab === 'topaz-image'} className={toolTab === 'topaz-image' ? 'is-active' : ''} onClick={() => setToolTab('topaz-image')}><ImageIcon size={17} /><span>{tx('Topaz image AI', 'Topaz للصور')}</span><small>{tx('Image enhancement only', 'تحسين الصور فقط')}</small></button>}";
  ui = replaceOnce(ui, oldAiTab, newAiTab, 'admin-only Topaz image tab');
  ui = replaceOnce(ui, "              {user?.role === 'admin' && onOpenTopaz && <button type=\"button\" className=\"evlr-topaz-launch-btn\" onClick={onOpenTopaz}><Sparkles size={15} /> {tx('Open Topaz AI Studio', 'افتح استوديو Topaz AI')} <ArrowRight size={14} /></button>}\n", '', 'remove Topaz launcher from video quality panel');

  const topazImagePanel = `\n            {toolTab === 'topaz-image' && user?.role === 'admin' && onOpenTopaz && <div className="evlr-tool-panel evlr-ai-panel evlr-enhance-panel" role="tabpanel">\n              <div className="evlr-control-heading"><div><span className="evlr-step">04</span><div><strong>{tx('Topaz AI image enhancement', 'تحسين الصور باستخدام Topaz AI')}</strong><small>{tx('Topaz is reserved for still images. Use the video-quality tab for sharpen, denoise, resolution and FPS.', 'Topaz مخصص للصور فقط. استخدم تبويب جودة الفيديو للحدة وإزالة التشويش والدقة ومعدل الإطارات.')}</small></div></div><span className="evlr-mini-tag">TOPAZ / IMAGE</span></div>\n              <div className="evlr-enhance-note"><ImageIcon size={16} /><span>{tx('Choose an image and an enhancement model in the private administrator tool. Topaz processing may consume paid API credits.', 'اختار صورة وموديل التحسين من أداة الأدمن الخاصة. معالجة Topaz ممكن تستهلك أرصدة مدفوعة.')}</span></div>\n              <button type="button" className="evlr-topaz-launch-btn" onClick={onOpenTopaz}><ImageIcon size={15} /> {tx('Open Topaz Image Enhancer', 'افتح تحسين الصور بـ Topaz')} <ArrowRight size={14} /></button>\n            </div>}`;
  ui = replaceOnce(ui, "            {toolTab === 'ai' && <div className=\"evlr-tool-panel evlr-ai-panel evlr-enhance-panel\" role=\"tabpanel\">", "            {toolTab === 'ai' && <div className=\"evlr-tool-panel evlr-ai-panel evlr-enhance-panel\" role=\"tabpanel\">", 'preserve quality panel marker');
  ui = replaceOnce(ui, "            </div>}\n          </section>\n\n          <aside className=\"evlr-tool-aside\">", "            </div>}" + topazImagePanel + "\n          </section>\n\n          <aside className=\"evlr-tool-aside\">", 'insert Topaz image-only panel');
  ui = wrapRegion(ui, '            <div className=\"evlr-card-topline\">', '            <input ref={fileInputRef} className=\"evlr-repick-input\" type=\"file\" accept=\"video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv\" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />', "{toolTab !== 'topaz-image' && <>\n", '\n            </>}', 'hide video workspace while Topaz image tab is active');
  ui = wrapRegion(ui, '          <aside className=\"evlr-tool-aside\">', '          </aside>', "{toolTab !== 'topaz-image' && <>\n", '\n          </>}', 'hide video-only sidebar while Topaz image tab is active');
  ui = replaceOnce(ui, '<div className=\"evlr-workspace\">', '<div className=\"evlr-workspace\" style={toolTab === \"topaz-image\" ? { gridTemplateColumns: \"minmax(0, 1fr)\" } : undefined}>', 'make Topaz image tab full width');

  // Server-side dynamic cost, validation and FFmpeg frame-rate conversion.
  route = replaceRegion(route, 'const EDITLAB_COST_POINTS = 10;', 'const upload = multer({', `const EDITLAB_BASE_POINTS = 10;
const QUALITY_COSTS = { smaller: 0, balanced: 2, higher: 5 };
const RESOLUTION_COSTS = { source: 0, '720p': 2, '1080p': 5, '1440p': 9, '4k': 15 };
const SHARPEN_COSTS = { off: 0, light: 1, medium: 2, strong: 3 };
const DENOISE_COSTS = { off: 0, light: 1, medium: 2, strong: 3 };
const FRAME_RATES = { source: null, '24': 24, '30': 30, '48': 48, '60': 60 };
const FRAME_RATE_COSTS = { source: 0, '24': 1, '30': 2, '48': 4, '60': 6 };

function calculateEditLabCost({ quality, resolution, sharpness, denoise, frameRate }) {
  return EDITLAB_BASE_POINTS + QUALITY_COSTS[quality] + RESOLUTION_COSTS[resolution]
    + SHARPEN_COSTS[sharpness] + DENOISE_COSTS[denoise] + FRAME_RATE_COSTS[frameRate];
}

async function chargeEditLabPoints(userId, costPoints) {
  const client = await db.connect();
  const chargeId = crypto.randomUUID();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      \`UPDATE wallets SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2 AND balance >= $1 RETURNING balance\`,
      [costPoints, userId]
    );
    if (!rows[0]) {
      const { rows: walletRows } = await client.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      await client.query('ROLLBACK');
      return { ok: false, balance: Number(walletRows[0]?.balance ?? 0) };
    }
    await client.query(
      \`INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
       VALUES ($1, $2, 'editlab_processing', $3, $4)\`,
      [userId, -costPoints, chargeId, 'editlab-processing:' + chargeId]
    );
    await client.query('COMMIT');
    return { ok: true, chargeId, balance: Number(rows[0].balance), costPoints };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

async function refundEditLabPoints(userId, chargeId, costPoints) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      \`INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
       VALUES ($1, $2, 'refund', $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id\`,
      [userId, costPoints, chargeId, 'editlab-refund:' + chargeId]
    );
    if (rows.length) {
      await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
        [costPoints, userId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

`, 'dynamic server-side price and point charge functions');

  route = replaceOnce(route, "    const resolution = String(req.body?.resolution || 'source');", "    const resolution = String(req.body?.resolution || 'source');\n    const frameRate = String(req.body?.frameRate || 'source');", 'server frame-rate input');
  route = replaceOnce(route, "    if (!Object.prototype.hasOwnProperty.call(RESOLUTION, resolution)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported output resolution.' });\n    }", "    if (!Object.prototype.hasOwnProperty.call(RESOLUTION, resolution)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose a supported output resolution.' });\n    }\n    if (!Object.prototype.hasOwnProperty.call(FRAME_RATES, frameRate)) {\n      fs.promises.unlink(req.file.path).catch(() => {});\n      return res.status(400).json({ error: 'Choose source FPS, 24, 30, 48, or 60 FPS.' });\n    }\n    const exportCostPoints = calculateEditLabCost({ quality: qualityId, resolution, sharpness, denoise, frameRate });", 'frame-rate validation and dynamic cost');
  route = replaceOnce(route, 'function runFfmpeg(inputPath, outputPath, preset, quality, enhancement) {', 'function runFfmpeg(inputPath, outputPath, preset, quality, enhancement) {', 'preserve ffmpeg entry');
  route = replaceOnce(route, "    const targetLongEdge = RESOLUTION[enhancement.resolution];\n    if (targetLongEdge) {\n      videoFilters.push(`scale=w='if(gte(iw,ih),${targetLongEdge},-2)':h='if(gte(iw,ih),-2,${targetLongEdge})':flags=lanczos`);\n    }", "    const targetLongEdge = RESOLUTION[enhancement.resolution];\n    if (targetLongEdge) {\n      videoFilters.push(`scale=w='if(gte(iw,ih),${targetLongEdge},-2)':h='if(gte(iw,ih),-2,${targetLongEdge})':flags=lanczos`);\n    }\n    if (FRAME_RATES[enhancement.frameRate]) videoFilters.push('fps=' + FRAME_RATES[enhancement.frameRate]);", 'apply requested output FPS');
  route = replaceOnce(route, 'const debit = await chargeEditLabPoints(req.user.id);', 'const debit = await chargeEditLabPoints(req.user.id, exportCostPoints);', 'charge computed export cost');
  route = replaceOnce(route, "error: 'Each EditLab export costs 10 points. Your current balance is ' + debit.balance + '.',\n          code: 'INSUFFICIENT_EDITLAB_POINTS',\n          requiredPoints: EDITLAB_COST_POINTS,", "error: 'This EditLab export costs ' + exportCostPoints + ' points. Your current balance is ' + debit.balance + '.',\n          code: 'INSUFFICIENT_EDITLAB_POINTS',\n          requiredPoints: exportCostPoints,", 'return dynamic cost requirement');
  route = replaceOnce(route, 'await runFfmpeg(jobInput, outputPath, preset, QUALITY[qualityId], { sharpness, denoise, resolution });', 'await runFfmpeg(jobInput, outputPath, preset, QUALITY[qualityId], { sharpness, denoise, resolution, frameRate });', 'send FPS to ffmpeg');
  route = replaceAllExpected(route, 'refundEditLabPoints(req.user.id, chargeId)', 'refundEditLabPoints(req.user.id, chargeId, exportCostPoints)', 2, 'refund exact computed export cost');

  // Remove the Topaz launcher from the global header; provide a dedicated admin-only image tab instead.
  main = replaceOnce(main, '              {user.role === \'admin\' && <button className="admin-access-btn" type="button" onClick={() => setTopazOpen(true)}>Topaz AI</button>}\n', '', 'remove top-header Topaz button');

  // Simplify Topaz UI so it can submit still images only. Video FPS and resolution stay in EditLab.
  ensure(topazUi, "<button type=\"button\" role=\"tab\" aria-selected={mode === 'video'}", 'Topaz video mode tab');
  topazUi = imageOnlyTopazComponent;

  // Disable Topaz video API routes as well, not just hide their controls.
  topazRoute = replaceOnce(topazRoute, "const TOPAZ_VIDEO_BASE = 'https://api.topazlabs.com/video';\n", '', 'remove Topaz video API base');
  topazRoute = replaceOnce(topazRoute, "const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // Keep this first admin test to a single-part upload.\n", '', 'remove Topaz video upload limit');
  topazRoute = replaceRegion(topazRoute, 'const videoUpload = multer({', 'function handleUpload(middleware, label, maxMb) {', '', 'Topaz video upload middleware');
  topazRoute = replaceRegion(topazRoute, 'function extractUploadUrls(payload) {', 'function statusValue(data) {', '', 'unused Topaz video-upload URL parser');
  topazRoute = replaceOnce(topazRoute, "    videoEndpoint: `${TOPAZ_VIDEO_BASE}/`,\n", '', 'remove Topaz video status endpoint');
  topazRoute = replaceOnce(topazRoute, "    message: 'Administrator-only Topaz tools are available.',", "    message: 'Administrator-only Topaz image enhancement is available.',", 'image-only Topaz status message');
  topazRoute = replaceRegion(topazRoute, '// VIDEO: short MP4 admin test job. The endpoint only begins processing after upload completion.', 'module.exports = router;', '// Topaz video endpoints are intentionally disabled; EditLab handles video processing locally.\n\n', 'disable Topaz video endpoints');

  // Prepare backups and updates only after all expected markers were matched.
  const backupDir = path.join(root, 'editvault-quality-fps-topaz-images-backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backupDir, { recursive: false });
  for (const [key, file] of Object.entries(targets)) fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  for (const [file, content] of [
    [targets.main, main],
    [targets.editlabUi, ui],
    [targets.editlabRoute, route],
    [targets.topazUi, topazUi],
    [targets.topazRoute, topazRoute],
  ]) fs.writeFileSync(file, content, 'utf8');

  console.log('EditVault dynamic quality pricing, FPS selector, and Topaz image-only update installed.');
  console.log('Base EditLab export: 10 points; higher quality, resolution, sharpen, denoise, and FPS options add points. Server validates and charges the same calculated price.');
  console.log('FPS conversion uses FFmpeg frame dropping/duplication; it is not AI frame interpolation.');
  console.log('Topaz is now image-only in the UI and video endpoints are disabled; the global header button was removed.');
  console.log('Backup created at: ' + path.relative(root, backupDir));
  console.log('No database migration is required. Restart the backend and refresh Vite.');
} catch (error) {
  console.error('EditVault update stopped: ' + error.message);
  process.exitCode = 1;
}
