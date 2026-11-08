'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const profilePath = path.join(root, 'client', 'src', 'PublicCreatorProfile.jsx');
const serverIndexPath = path.join(root, 'server', 'src', 'index.js');
const editsRoutePath = path.join(root, 'server', 'src', 'routes', 'edits.js');
const studioRoutePath = path.join(root, 'server', 'src', 'routes', 'studio.js');

function stop(message) {
  console.error(`EditVault upgrade stopped: ${message}`);
  console.error('No project source files were changed. Check that the ZIP was extracted into the EditVault project root.');
  process.exit(1);
}
for (const file of [mainPath, profilePath, serverIndexPath, editsRoutePath]) {
  if (!fs.existsSync(file)) stop(`Required file not found: ${path.relative(root, file)}`);
}

let main = fs.readFileSync(mainPath, 'utf8');
let profile = fs.readFileSync(profilePath, 'utf8');
let serverIndex = fs.readFileSync(serverIndexPath, 'utf8');
let editsRoute = fs.readFileSync(editsRoutePath, 'utf8').replace(/\r\n/g, '\n');
let studioRoute = fs.existsSync(studioRoutePath) ? fs.readFileSync(studioRoutePath, 'utf8').replace(/\r\n/g, '\n') : null;
const originalMain = main, originalProfile = profile, originalServerIndex = serverIndex, originalEditsRoute = editsRoute, originalStudioRoute = studioRoute;

// Preflight checks: this patch targets the current routed EditVault frontend.
const requiredMain = [
  'const EDITVAULT_PAGE_PATHS = {',
  'const [activePage, setActivePage] = useState',
  'data-page={activePage}',
  'from \'./PublicCreatorProfile.jsx\'',
  '<main id="top">',
  '<PublicCreatorProfile',
];
for (const marker of requiredMain) if (!main.includes(marker)) stop(`The current main.jsx is missing expected routed-app marker: ${marker}`);
for (const marker of [
  'export default function PublicCreatorProfile(',
  "const token = localStorage.getItem('editvault_token');",
  'const [myReview, setMyReview] = useState(null);',
  '<div className="public-creator-work-heading">',
  'const submitReview = async (event) => {',
]) if (!profile.includes(marker)) stop(`PublicCreatorProfile.jsx is missing expected marker: ${marker}`);
if (!serverIndex.includes("require('express')") || !serverIndex.includes('app.use(')) stop('server/src/index.js does not look like the expected Express server.');
for (const marker of ["const { auth } = require('../middleware/auth');", "router.post(\n  '/',", 'original_path', 'preview_path']) if (!editsRoute.includes(marker)) stop(`server/src/routes/edits.js is missing expected marker: ${marker}`);

// Add the custom request page to the existing route table.
if (!main.includes("requests: '/requests'")) {
  const routeAnchor = /  creators: '\/creators',/;
  if (!routeAnchor.test(main)) stop('Could not find the creators route in EDITVAULT_PAGE_PATHS.');
  main = main.replace(routeAnchor, (line) => `${line}\n  requests: '/requests',`);
}
// Browser/hash navigation maps #requests to the independent /requests route.
if (!main.includes("requests: 'requests'")) {
  const navMapAnchor = "creators: 'creators', how: 'how',";
  if (!main.includes(navMapAnchor)) stop('Could not find the page-link routing map to add the requests route.');
  main = main.replace(navMapAnchor, "creators: 'creators', requests: 'requests', how: 'how',");
}
if (!main.includes("requests: 'طلبات التعديل'")) {
  const arabicLabelAnchor = "accounts: 'الحسابات', creators: 'المبدعون', how: 'كيف يعمل الموقع',";
  if (!main.includes(arabicLabelAnchor)) stop('Could not find the Arabic page title labels.');
  main = main.replace(arabicLabelAnchor, "accounts: 'الحسابات', creators: 'المبدعون', requests: 'طلبات التعديل', how: 'كيف يعمل الموقع',");
}
if (!main.includes("requests: 'Creator Requests'")) {
  const labelAnchor = "how: 'How It Works',";
  if (!main.includes(labelAnchor)) stop('Could not find the page title labels.');
  main = main.replace(labelAnchor, `requests: 'Creator Requests',\n      ${labelAnchor}`);
}
// Add a visible nav item without replacing or rearranging the user's existing navigation.
if (!main.includes('href="#requests"')) {
  const navEnd = '        </nav>';
  if (!main.includes(navEnd)) stop('Could not find the closing navigation tag.');
  const navItem = `          <a className={activePage === 'requests' ? 'nav-active' : ''} href="#requests" onClick={() => setMobileNav(false)}>{language === 'ar' ? 'طلبات التعديل' : language === 'es' ? 'Solicitudes' : 'Requests'}</a>\n`;
  main = main.replace(navEnd, `${navItem}${navEnd}`);
}
if (!main.includes("import CreatorRequests from './CreatorRequests.jsx';")) {
  const importAnchor = "import PublicCreatorProfile from './PublicCreatorProfile.jsx';";
  main = main.replace(importAnchor, `${importAnchor}\nimport CreatorRequests from './CreatorRequests.jsx';`);
}
if (!main.includes("import './creator-requests.css';")) {
  const cssAnchor = "import CreatorRequests from './CreatorRequests.jsx';";
  if (!main.includes(cssAnchor)) stop('Could not find the new requests import to attach its stylesheet.');
  main = main.replace(cssAnchor, `${cssAnchor}\nimport './creator-requests.css';`);
}
// Put the routed page as a direct child of <main>, so route CSS can strictly isolate it.
if (!main.includes('<CreatorRequests user={user} activePage={activePage}')) {
  const closeMainAt = main.lastIndexOf('</main>');
  if (closeMainAt === -1) stop('Could not find </main> to mount the dedicated Requests page.');
  const mount = `\n        <CreatorRequests user={user} activePage={activePage} onLoginRequest={() => openAuth('login')} />\n      `;
  main = main.slice(0, closeMainAt) + mount + main.slice(closeMainAt);
}

// Add a watermark to the full on-page preview modal, not only the small video cards.
if (!main.includes('className="ev-watermarked-preview"')) {
  const videoStart = '            <video\n              key={previewEdit.id}';
  const videoEnd = '            </video>\n\n            <p style={{ marginTop: \'12px\' }}>';
  if (!main.includes(videoStart) || !main.includes(videoEnd)) stop('Could not safely wrap the preview-modal video with the watermark layer.');
  main = main.replace(videoStart, '            <div className="ev-watermarked-preview">\n              <video\n              key={previewEdit.id}');
  main = main.replace(videoEnd, '            </video>\n            </div>\n\n            <p style={{ marginTop: \'12px\' }}>');
}

// Custom request form on each public creator profile.
if (!profile.includes('const [requestOpen, setRequestOpen] = useState(false);')) {
  const stateAnchor = '  const [myReview, setMyReview] = useState(null);';
  const requestState = `  const [requestOpen, setRequestOpen] = useState(false);\n  const [requestTitle, setRequestTitle] = useState('');\n  const [requestBrief, setRequestBrief] = useState('');\n  const [requestCategory, setRequestCategory] = useState('Gaming');\n  const [requestReference, setRequestReference] = useState('');\n  const [requestDeadline, setRequestDeadline] = useState('');\n  const [requestBudget, setRequestBudget] = useState('');\n  const [requestSubmitting, setRequestSubmitting] = useState(false);\n  const [requestMessage, setRequestMessage] = useState('');\n  const [requestError, setRequestError] = useState('');\n  const isArabicRequestUi = localStorage.getItem('editvault_language') === 'ar';\n  const requestText = (en, ar) => isArabicRequestUi ? ar : en;`;
  profile = profile.replace(stateAnchor, `${stateAnchor}\n${requestState}`);
}
if (!profile.includes('const submitCustomRequest = async (event) => {')) {
  const handlerAnchor = '  if (!creatorId) return null;';
  const handler = `  const submitCustomRequest = async (event) => {\n    event.preventDefault();\n    const token = localStorage.getItem('editvault_token');\n    if (!token) { onLoginRequest?.(); return; }\n    setRequestSubmitting(true); setRequestError(''); setRequestMessage('');\n    try {\n      const response = await fetch(\x60${'${API_URL}'}\/api\/custom-requests\x60, {\n        method: 'POST',\n        headers: { Authorization: \x60Bearer ${'${token}'}\x60, 'Content-Type': 'application/json' },\n        body: JSON.stringify({ creatorId, title: requestTitle.trim(), brief: requestBrief.trim(), category: requestCategory, referenceUrl: requestReference.trim(), deadline: requestDeadline, budgetPoints: requestBudget === '' ? null : Number(requestBudget) }),\n      });\n      const data = await response.json().catch(() => ({}));\n      if (!response.ok) throw new Error(data.error || requestText('Could not send request.', 'تعذر إرسال الطلب.'));\n      setRequestMessage(data.message || requestText('Request sent successfully.', 'تم إرسال الطلب بنجاح.'));\n      setRequestTitle(''); setRequestBrief(''); setRequestCategory('Gaming'); setRequestReference(''); setRequestDeadline(''); setRequestBudget('');\n      setRequestOpen(false);\n    } catch (error) { setRequestError(error.message || requestText('Could not send request.', 'تعذر إرسال الطلب.')); }\n    finally { setRequestSubmitting(false); }\n  };\n\n`;
  if (!profile.includes(handlerAnchor)) stop('Could not find the insertion point for the custom request submit handler.');
  profile = profile.replace(handlerAnchor, `${handler}${handlerAnchor}`);
}
if (!profile.includes('className="ev-custom-request-box"')) {
  const profileAnchor = '          <div className="public-creator-work-heading">';
  if (!profile.includes(profileAnchor)) stop('Could not find the creator work section to place the Request an Edit panel.');
  const panel = `          <section className="ev-custom-request-box" dir={isArabicRequestUi ? 'rtl' : 'ltr'} aria-labelledby="ev-custom-request-title">\n            <h3 id="ev-custom-request-title">{requestText('Need a custom edit?', 'محتاج تعديل مخصوص؟')}</h3>\n            <p>{requestText('Tell this creator what you have in mind. They can review your brief and send you an offer in points.', 'اشرح للكريتور التعديل اللي محتاجه. هيقدر يراجع التفاصيل ويبعتلك عرض بالنقاط.')}</p>\n            {user?.id === profile.id ? <p>{requestText('This is your creator profile. Open Requests from the main navigation to manage client briefs.', 'ده بروفايلك. افتح «طلبات التعديل» من القائمة لإدارة طلبات العملاء.')}</p> : <button className="ev-custom-request-toggle" type="button" onClick={() => { if (!user) { onLoginRequest?.(); return; } setRequestOpen((value) => !value); setRequestError(''); setRequestMessage(''); }}><Send size={15}/>{requestText('Request a custom edit', 'اطلب تعديل مخصص')}</button>}\n            {requestOpen && user && user.id !== profile.id && <form className="ev-custom-request-form" onSubmit={submitCustomRequest}>\n              <label>{requestText('Project title', 'عنوان الطلب')}<input required minLength={3} maxLength={120} value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder={requestText('e.g. 30-second gaming montage', 'مثال: مونتاج جيمينج 30 ثانية')}/></label>\n              <label>{requestText('Edit type', 'نوع التعديل')}<select value={requestCategory} onChange={(event) => setRequestCategory(event.target.value)}><option>Gaming</option><option>AMV</option><option>Cinematic</option><option>TikTok / Reels</option><option>CC / Color grading</option><option>Other</option></select></label>\n              <label className="ev-custom-wide">{requestText('Describe what you need', 'اشرح التعديل المطلوب')}<textarea required minLength={15} maxLength={4000} value={requestBrief} onChange={(event) => setRequestBrief(event.target.value)} placeholder={requestText('Style, duration, music, format, references, and anything the creator should know…', 'الستايل والمدة والموسيقى والمقاس والمراجع وأي تفاصيل مهمة…')}/></label>\n              <label>{requestText('Reference link (optional)', 'رابط مرجعي (اختياري)')}<input type="url" maxLength={1200} value={requestReference} onChange={(event) => setRequestReference(event.target.value)} placeholder="https://…"/></label>\n              <label>{requestText('Preferred deadline (optional)', 'موعد التسليم (اختياري)')}<input type="date" value={requestDeadline} onChange={(event) => setRequestDeadline(event.target.value)}/></label>\n              <label>{requestText('Expected budget in points (optional)', 'الميزانية المتوقعة بالنقاط (اختياري)')}<input type="number" min="0" max="1000000" step="1" value={requestBudget} onChange={(event) => setRequestBudget(event.target.value)} placeholder="e.g. 500"/></label>\n              <button className="ev-custom-request-toggle" type="submit" disabled={requestSubmitting}><Send size={15}/>{requestSubmitting ? requestText('Sending…', 'جارٍ الإرسال…') : requestText('Send request', 'إرسال الطلب')}</button>\n            </form>}\n            {requestError && <p className="ev-custom-request-message error" role="alert">{requestError}</p>}\n            {requestMessage && <p className="ev-custom-request-message success" role="status">{requestMessage}</p>}\n          </section>\n\n`;
  profile = profile.replace(profileAnchor, `${panel}${profileAnchor}`);
}

// Burn the watermark into a FULL-LENGTH public preview derived from the original video.
if (!editsRoute.includes('async function generateWatermarkedPreview(')) {
  const helperAnchor = '// GET /api/edits\n// Return published edits without exposing filesystem paths.';
  if (!editsRoute.includes(helperAnchor)) stop('Could not find a safe insertion point for FFmpeg preview generation.');
  const helper = `async function generateWatermarkedPreview(inputPath, outputPathOverride = null) {
  const parsed = path.parse(inputPath);
  const outputPath = outputPathOverride || path.join(parsed.dir, \`${'${parsed.name}'}-editvault-preview.mp4\`);
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const filter = "drawtext=text='EDITVAULT':fontcolor=white@0.26:fontsize=h/20:borderw=2:bordercolor=black@0.16:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='EDITVAULT':fontcolor=white@0.42:fontsize=h/38:borderw=1:bordercolor=black@0.18:x=w-text_w-24:y=h-text_h-22";
  try {
    await execFileAsync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a?', '-vf', filter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
    ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error('FFmpeg created an empty preview file.');
    return outputPath;
  } catch (error) {
    if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch { /* cleanup best effort */ } }
    error.code = 'EV_FFMPEG_PREVIEW_FAILED';
    throw error;
  }
}

`;
  if (!editsRoute.includes("const crypto = require('crypto');")) stop('Could not find the crypto import in edits.js.');
  editsRoute = editsRoute.replace("const crypto = require('crypto');", "const crypto = require('crypto');\nconst { execFile } = require('child_process');\nconst { promisify } = require('util');\nconst execFileAsync = promisify(execFile);");
  editsRoute = editsRoute.replace(helperAnchor, `${helper}${helperAnchor}`);
}

// The current EditVault API uses upload.fields(original + preview), not upload.single(original).
// Rewrite only the /api/edits upload block. The original remains protected; public preview is
// generated from the entire original video, and any optional separately-uploaded preview is ignored/cleaned up.
{
  const blockStart = editsRoute.indexOf('// POST /api/edits\n');
  const blockEnd = editsRoute.indexOf('// POST /api/edits/:id/preview', blockStart + 1);
  if (blockStart === -1 || blockEnd === -1) stop('Could not locate the full /api/edits upload block safely.');
  const oldBlock = editsRoute.slice(blockStart, blockEnd);
  if (!oldBlock.includes('upload.fields([') || !oldBlock.includes('originalFile') || !oldBlock.includes('preview_path')) {
    stop('The /api/edits upload handler is not the supported upload.fields(original, preview) version.');
  }
  const replacement = `// POST /api/edits
// Upload a protected original and generate a full-duration, watermarked public preview from it.
router.post(
  '/',
  auth,
  verifiedCreatorOnly,
  upload.fields([
    { name: 'original', maxCount: 1 },
    { name: 'preview', maxCount: 1 }, // Accepted for backward compatibility; public preview comes from the original.
  ]),
  async (req, res, next) => {
    const originalFile = req.files?.original?.[0];
    const previewFile = req.files?.preview?.[0];
    let watermarkedPreviewPath = null;

    const removeUploadedFiles = ({ keepOriginal = false, keepWatermarked = false } = {}) => {
      for (const file of [originalFile, previewFile]) {
        if (!file?.path || (keepOriginal && file === originalFile)) continue;
        try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch { /* Best-effort cleanup. */ }
      }
      if (watermarkedPreviewPath && !keepWatermarked) {
        try { if (fs.existsSync(watermarkedPreviewPath)) fs.unlinkSync(watermarkedPreviewPath); } catch { /* Best-effort cleanup. */ }
      }
    };

    try {
      if (!originalFile) {
        removeUploadedFiles();
        return res.status(400).json({ error: 'Upload the original video file.' });
      }

      const {
        title,
        description = '',
        category = 'Other',
        editingSoftware = '',
        pricePoints,
      } = req.body;
      const price = Number(pricePoints);

      if (!title?.trim() || !Number.isInteger(price) || price < 1 || price > 100000) {
        removeUploadedFiles();
        return res.status(400).json({ error: 'A title and price between 1 and 100000 points are required.' });
      }

      try {
        watermarkedPreviewPath = await generateWatermarkedPreview(originalFile.path);
      } catch (previewError) {
        removeUploadedFiles();
        console.error('Watermarked full-video preview generation failed:', previewError.message);
        return res.status(503).json({ error: 'Could not generate the full-length watermarked preview. Confirm FFmpeg is installed on the server and FFMPEG_PATH is correct, then retry.' });
      }

      const { rows } = await db.query(
        \`INSERT INTO edits (
          creator_id, title, description, category, editing_software,
          price_points, preview_path, original_path, original_filename
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, title, description, category, editing_software, price_points, status, created_at\`,
        [
          req.user.id,
          title.trim(),
          String(description).slice(0, 2000),
          String(category).slice(0, 40),
          String(editingSoftware).slice(0, 80),
          price,
          watermarkedPreviewPath,
          originalFile.path,
          originalFile.originalname,
        ]
      );

      // Keep the protected original and committed preview. Remove unused upload fields only.
      removeUploadedFiles({ keepOriginal: true, keepWatermarked: true });
      res.status(201).json({
        edit: { ...rows[0], has_preview: true },
        message: 'Edit uploaded with a full-length watermarked preview. The original remains protected.',
      });
    } catch (error) {
      removeUploadedFiles();
      next(error);
    }
  }
);

`;
  editsRoute = editsRoute.slice(0, blockStart) + replacement + editsRoute.slice(blockEnd);
}

// Keep the old preview-replacement API compatible, but regenerate the full-length branded preview from the protected original.
{
  const previewStart = editsRoute.indexOf('// POST /api/edits/:id/preview');
  const previewEnd = editsRoute.indexOf('// POST /api/edits/:id/purchase', previewStart + 1);
  if (previewStart === -1 || previewEnd === -1) stop('Could not locate the preview-replacement endpoint safely.');
  const previewBlock = editsRoute.slice(previewStart, previewEnd);
  if (!previewBlock.includes("upload.single('preview')") || !previewBlock.includes('original_path')) {
    stop('The preview-replacement endpoint is not the supported protected-original version.');
  }
  const fixedPreviewRoute = `// POST /api/edits/:id/preview
// Regenerate the full-length watermarked preview from the protected original.
router.post('/:id/preview', auth, verifiedCreatorOnly, upload.single('preview'), async (req, res, next) => {
  let newWatermarkedPath = null;
  const cleanupUpload = () => {
    if (req.file?.path) {
      try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch { /* best-effort cleanup */ }
    }
  };
  try {
    const { rows } = await db.query(
      \`SELECT e.id, e.creator_id, e.preview_path, e.original_path, u.role AS requester_role
       FROM edits e JOIN users u ON u.id = $2
       WHERE e.id = $1 AND e.status <> 'removed'\`,
      [req.params.id, req.user.id]
    );
    const edit = rows[0];
    if (!edit) { cleanupUpload(); return res.status(404).json({ error: 'Edit not found.' }); }
    if (String(edit.creator_id) !== String(req.user.id) && edit.requester_role !== 'admin') {
      cleanupUpload();
      return res.status(403).json({ error: 'Only the edit owner or an admin can refresh this preview.' });
    }

    const originalPath = path.resolve(edit.original_path || '');
    const relativePath = path.relative(uploadDir, originalPath);
    if (!edit.original_path || !relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(originalPath)) {
      cleanupUpload();
      return res.status(410).json({ error: 'Protected original is unavailable; a full preview cannot be regenerated.' });
    }

    const parsed = path.parse(originalPath);
    const uniqueOutput = path.join(parsed.dir, parsed.name + '-editvault-preview-' + Date.now() + '.mp4');
    newWatermarkedPath = await generateWatermarkedPreview(originalPath, uniqueOutput);
    const { rows: updated } = await db.query(
      'UPDATE edits SET preview_path = $1 WHERE id = $2 RETURNING id, title, status',
      [newWatermarkedPath, edit.id]
    );
    if (!updated[0]) throw new Error('Preview path could not be saved.');

    cleanupUpload();
    newWatermarkedPath = null;
    res.json({ edit: updated[0], editId: edit.id, has_preview: true, previewUrl: \`/api/edits/${'${edit.id}'}/preview\`, message: 'Full-length watermarked preview regenerated.' });
  } catch (error) {
    cleanupUpload();
    if (newWatermarkedPath && fs.existsSync(newWatermarkedPath)) { try { fs.unlinkSync(newWatermarkedPath); } catch { /* best-effort cleanup */ } }
    if (error?.code === 'EV_FFMPEG_PREVIEW_FAILED') {
      return res.status(503).json({ error: 'FFmpeg could not generate the full-length watermarked preview. Check FFMPEG_PATH.' });
    }
    next(error);
  }
});

`;
  editsRoute = editsRoute.slice(0, previewStart) + fixedPreviewRoute + editsRoute.slice(previewEnd);
}

// If the app also exposes Creator Studio preview-trimming endpoints, make them generate the same full-length watermarked preview.
if (studioRoute !== null) {
  const studioStart = studioRoute.indexOf('function createPreview(sourcePath, start, end) {');
  const studioEnd = studioRoute.indexOf('\nfunction validTikTokUrl(', studioStart + 1);
  if (studioStart !== -1 && studioEnd !== -1) {
    const currentHelper = studioRoute.slice(studioStart, studioEnd);
    if (!currentHelper.includes("drawtext=text='EDITVAULT'")) {
      const fullVideoHelper = `function createPreview(sourcePath, start, end) {
  return new Promise((resolve, reject) => {
    const parsed = path.parse(sourcePath);
    const outputPath = path.join(uploadDir, parsed.name + '-editvault-preview-' + Date.now() + '-' + crypto.randomUUID() + '.mp4');
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const filter = "drawtext=text='EDITVAULT':fontcolor=white@0.26:fontsize=h/20:borderw=2:bordercolor=black@0.16:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='EDITVAULT':fontcolor=white@0.42:fontsize=h/38:borderw=1:bordercolor=black@0.18:x=w-text_w-24:y=h-text_h-22";
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-map', '0:v:0', '-map', '0:a?', '-vf', filter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
    ];
    let stderr = '';
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-6000); });
    child.on('error', (error) => { safeUnlink(outputPath); reject(new Error('Could not start FFmpeg: ' + error.message)); });
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return resolve(outputPath);
      safeUnlink(outputPath);
      reject(new Error('Could not create the full-length watermarked preview. ' + stderr));
    });
  });
}
`;
      studioRoute = studioRoute.slice(0, studioStart) + fullVideoHelper + studioRoute.slice(studioEnd);
    }
    studioRoute = studioRoute.replace(/message:\s*`Edit published with a \$\{clip\.duration\.toFixed\(1\)\} second public preview\. The original remains protected\.`/, "message: 'Edit published with a full-length watermarked preview. The original remains protected.'");
    studioRoute = studioRoute.replace(/message:\s*`Preview changed to \$\{clip\.duration\.toFixed\(1\)\} seconds\.`/, "message: 'Full-length watermarked preview regenerated from the original video.'");
  } else if (studioRoute.includes('function createPreview(')) {
    stop('Found server/src/routes/studio.js, but could not safely identify its preview generator. No project files were written.');
  }
}

// Register the backend router. Existing unrelated routes are preserved.
const routeImport = "const customRequestsRoutes = require('./routes/custom-requests');";
if (!serverIndex.includes(routeImport)) {
  const appAnchor = 'const app = express();';
  if (!serverIndex.includes(appAnchor)) stop('Could not find const app = express() in the backend entry file.');
  serverIndex = serverIndex.replace(appAnchor, `${routeImport}\n${appAnchor}`);
}
const routeMount = "app.use('/api/custom-requests', customRequestsRoutes);";
if (!serverIndex.includes(routeMount)) {
  const errorMiddlewareAt = serverIndex.search(/app\.use\(\s*\(err\s*,/);
  if (errorMiddlewareAt === -1) stop('Could not find Express error middleware to mount the request route before it.');
  serverIndex = serverIndex.slice(0, errorMiddlewareAt) + `${routeMount}\n` + serverIndex.slice(errorMiddlewareAt);
}

// All transformations are now validated; backups are written before any source is changed.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const updates = [[mainPath, main, originalMain], [profilePath, profile, originalProfile], [serverIndexPath, serverIndex, originalServerIndex], [editsRoutePath, editsRoute, originalEditsRoute]];
if (studioRoute !== null) updates.push([studioRoutePath, studioRoute, originalStudioRoute]);
for (const [file, content, original] of updates) {
  if (content !== original) {
    const backup = `${file}.pre-creator-orders-${stamp}.bak`;
    fs.copyFileSync(file, backup);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${path.relative(root, file)} (backup: ${path.basename(backup)})`);
  } else {
    console.log(`Already installed: ${path.relative(root, file)}`);
  }
}
console.log('Creator requests UI/API installed; full-length previews will be generated from the protected original with an embedded watermark. Next run the database migration from the server folder.');
