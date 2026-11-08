'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const profilePath = path.join(root, 'client', 'src', 'PublicCreatorProfile.jsx');
const serverIndexPath = path.join(root, 'server', 'src', 'index.js');
const editsRoutePath = path.join(root, 'server', 'src', 'routes', 'edits.js');

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
const originalMain = main, originalProfile = profile, originalServerIndex = serverIndex, originalEditsRoute = editsRoute;

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

// Burn the watermark into a full-duration preview file on upload. The original remains protected by the existing purchase-gated download route.
if (!editsRoute.includes('async function generateWatermarkedPreview(')) {
  const helperAnchor = '// GET /api/edits\n// Return published edits without exposing filesystem paths.';
  if (!editsRoute.includes(helperAnchor)) stop('Could not find a safe insertion point for FFmpeg preview generation.');
  const helper = `async function generateWatermarkedPreview(inputPath) {
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, \`${'${parsed.name}'}-editvault-preview.mp4\`);
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const filter = \"drawtext=text='EDITVAULT PREVIEW':fontcolor=white@0.30:fontsize=h/24:borderw=2:bordercolor=black@0.18:x=(w-text_w)/2:y=(h-text_h)/2\";
  try {
    await execFileAsync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a?', '-vf', filter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
    ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
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
if (!editsRoute.includes('let watermarkedPreviewPath = null;')) {
  // Match the upload route by its actual middleware rather than assuming an exact whitespace layout.
  // Restrict the search to the text after upload.single('original') so unrelated routes cannot match.
  const uploadIndex = editsRoute.indexOf("upload.single('original')");
  if (uploadIndex === -1) stop("Could not find upload.single('original') in server/src/routes/edits.js.");
  const routeTail = editsRoute.slice(uploadIndex);
  const bodyPattern = /(async\s*\(req,\s*res,\s*next\)\s*=>\s*\{\s*)try\s*\{/;
  const bodyMatch = routeTail.match(bodyPattern);
  if (!bodyMatch || bodyMatch.index > 800) {
    const nearby = routeTail.slice(0, 240).replace(/\s+/g, ' ').trim();
    stop("Found the original upload middleware but could not safely match its handler body. Nearby source: " + nearby);
  }
  const replacedTail = routeTail.replace(bodyPattern, '$1let watermarkedPreviewPath = null;\n    try {');
  editsRoute = editsRoute.slice(0, uploadIndex) + replacedTail;
}
if (!editsRoute.includes('watermarkedPreviewPath = await generateWatermarkedPreview(req.file.path);')) {
  const insertAnchor = `      const { rows } = await db.query(
        \`
        INSERT INTO edits (`;
  if (!editsRoute.includes(insertAnchor)) stop('Could not find the edits INSERT statement to attach the generated preview.');
  const generation = `      try {
        watermarkedPreviewPath = await generateWatermarkedPreview(req.file.path);
      } catch (previewError) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (previewError && previewError.message) console.error('Watermarked preview generation failed:', previewError.message);
        return res.status(503).json({ error: 'A protected watermarked preview could not be generated. Install FFmpeg on the server or set FFMPEG_PATH, then retry the upload.' });
      }

`;
  editsRoute = editsRoute.replace(insertAnchor, `${generation}${insertAnchor}`);
}
const oldColumns = `          price_points,
          original_path,
          original_filename
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`;
if (editsRoute.includes(oldColumns)) {
  editsRoute = editsRoute.replace(oldColumns, `          price_points,
          preview_path,
          original_path,
          original_filename
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`);
}
const oldValues = `          price,
          req.file.path,
          req.file.originalname,`;
if (editsRoute.includes(oldValues)) editsRoute = editsRoute.replace(oldValues, `          price,
          watermarkedPreviewPath,
          req.file.path,
          req.file.originalname,`);
if (editsRoute.includes(oldColumns) || editsRoute.includes(oldValues)) stop('Could not safely add preview_path to the upload database insert.');
// Clean up transient files if database insertion fails.
const uploadCatchOld = `    } catch (error) {
      next(error);
    }
  }
);

// GET /api/edits/mine/library`;
const uploadCatchNew = `    } catch (error) {
      if (watermarkedPreviewPath && fs.existsSync(watermarkedPreviewPath)) {
        try { fs.unlinkSync(watermarkedPreviewPath); } catch { /* cleanup best effort */ }
      }
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch { /* cleanup best effort */ }
      }
      next(error);
    }
  }
);

// GET /api/edits/mine/library`;
if (editsRoute.includes(uploadCatchOld)) editsRoute = editsRoute.replace(uploadCatchOld, uploadCatchNew);

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
console.log('Creator requests UI and API are mounted. Next run the database migration from the server folder.');
