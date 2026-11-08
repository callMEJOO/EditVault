'use strict';

const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = {
  component: path.join(root, 'client', 'src', 'EditLabRewards.jsx'),
  componentCss: path.join(root, 'client', 'src', 'editlab-rewards.css'),
  editlabRoute: path.join(root, 'server', 'src', 'routes', 'editlab.js'),
  topazComponent: path.join(root, 'client', 'src', 'TopazAdmin.jsx'),
  topazRoute: path.join(root, 'server', 'src', 'routes', 'topaz.js'),
  schema: path.join(root, 'server', 'src', 'db', 'schema.sql'),
  rewardsMigration: path.join(root, 'server', 'src', 'db', 'apply-editlab-rewards.js'),
  processingMigration: path.join(root, 'server', 'src', 'db', 'apply-editlab-processing-points.js'),
};
const bundledMigration = path.join(root, 'upgrade-files', 'server', 'src', 'db', 'apply-editlab-processing-points.js');

function required(file) {
  if (!fs.existsSync(file)) throw new Error(`Required file not found: ${path.relative(root, file)}. Extract the complete update into the EditVault project root and merge folders.`);
}
function read(file) {
  required(file);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one match for ${label}; found ${count}. No project files were changed.`);
  return source.replace(before, after);
}
function backupWritePlan(plan) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, `editvault-editlab-10-points-topaz-backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: false });
  for (const item of plan) {
    if (fs.existsSync(item.file)) fs.copyFileSync(item.file, path.join(backupDir, path.basename(item.file)));
  }
  for (const item of plan) {
    const eol = item.original && item.original.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(item.file, item.content.replace(/\n/g, eol), 'utf8');
  }
  return backupDir;
}

try {
  // Read and validate every target before writing any project file.
  let component = read(files.component);
  let componentCss = read(files.componentCss);
  let editlabRoute = read(files.editlabRoute);
  let topazComponent = read(files.topazComponent);
  let topazRoute = read(files.topazRoute);
  let schema = read(files.schema);
  let rewardsMigration = read(files.rewardsMigration);
  const migrationTemplate = read(bundledMigration);

  if (!component.includes("fetch(`${API_URL}/api/editlab/compress`")) {
    throw new Error('EditLab export request did not match the expected component. No project files were changed.');
  }
  if (!component.includes('compressAndDownload')) {
    throw new Error('EditLab export handler was not found. No project files were changed.');
  }
  if (!editlabRoute.includes("router.post('/compress'")) {
    throw new Error('The EditLab compression route was not found. No project files were changed.');
  }
  if (!topazComponent.includes('Topaz API connection') && !topazComponent.includes('TOPAZ_API_KEY is present in the backend environment. The first job will validate it with Topaz.')) {
    // An already-updated UI is acceptable; anything else might be a different tool.
    if (!topazComponent.includes('topaz-admin-key-state')) throw new Error('Topaz status UI did not match the expected component. No project files were changed.');
  }

  // --- EditLab: debit ten EditVault points instead of enforcing an hourly job limit. ---
  if (!editlabRoute.includes('const EDITLAB_COST_POINTS = 10;')) {
    if (!editlabRoute.includes("const processLimiter = rateLimit({") || !editlabRoute.includes("router.post('/compress', auth, processLimiter,")) {
      throw new Error('EditLab route is neither the expected hourly-limited version nor the already-patched ten-point version. No project files were changed.');
    }

    editlabRoute = replaceOnce(
      editlabRoute,
      "const { auth } = require('../middleware/auth');",
      "const { auth } = require('../middleware/auth');\nconst db = require('../db/pool');",
      'EditLab wallet database import'
    );
    editlabRoute = replaceOnce(
      editlabRoute,
      "const rateLimit = require('express-rate-limit');\n",
      '',
      'remove EditLab hourly rate limiter import'
    );
    const limiterPattern = /const processLimiter = rateLimit\(\{[\s\S]*?\n\}\);\n\n/;
    const limiterMatches = editlabRoute.match(limiterPattern) || [];
    if (limiterMatches.length !== 1) throw new Error('Could not safely remove the EditLab hourly limiter. No project files were changed.');
    editlabRoute = editlabRoute.replace(limiterPattern, '');
    editlabRoute = replaceOnce(
      editlabRoute,
      "router.post('/compress', auth, processLimiter, (req, res, next) => {",
      "router.post('/compress', auth, (req, res, next) => {",
      'EditLab route authentication and limiter'
    );

    const helpers = `const EDITLAB_COST_POINTS = 10;\n\nasync function chargeEditLabPoints(userId) {\n  const client = await db.connect();\n  const chargeId = crypto.randomUUID();\n  try {\n    await client.query('BEGIN');\n    const { rows } = await client.query(\n      \`UPDATE wallets SET balance = balance - $1, updated_at = NOW()\n       WHERE user_id = $2 AND balance >= $1 RETURNING balance\`,\n      [EDITLAB_COST_POINTS, userId]\n    );\n    if (!rows[0]) {\n      const { rows: walletRows } = await client.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);\n      await client.query('ROLLBACK');\n      return { ok: false, balance: Number(walletRows[0]?.balance ?? 0) };\n    }\n    await client.query(\n      \`INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)\n       VALUES ($1, $2, 'editlab_processing', $3, $4)\`,\n      [userId, -EDITLAB_COST_POINTS, chargeId, \`editlab-processing:\${chargeId}\`]\n    );\n    await client.query('COMMIT');\n    return { ok: true, chargeId, balance: Number(rows[0].balance) };\n  } catch (error) {\n    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }\n    throw error;\n  } finally {\n    client.release();\n  }\n}\n\nasync function refundEditLabPoints(userId, chargeId) {\n  const client = await db.connect();\n  try {\n    await client.query('BEGIN');\n    const { rows } = await client.query(\n      \`INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)\n       VALUES ($1, $2, 'refund', $3, $4)\n       ON CONFLICT (idempotency_key) DO NOTHING\n       RETURNING id\`,\n      [userId, EDITLAB_COST_POINTS, chargeId, \`editlab-refund:\${chargeId}\`]\n    );\n    if (rows.length) {\n      await client.query(\n        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',\n        [EDITLAB_COST_POINTS, userId]\n      );\n    }\n    await client.query('COMMIT');\n  } catch (error) {\n    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }\n    throw error;\n  } finally {\n    client.release();\n  }\n}\n\n`;
    editlabRoute = replaceOnce(editlabRoute, 'const upload = multer({', helpers + 'const upload = multer({', 'insert EditLab points debit and refund helpers');
    editlabRoute = replaceOnce(
      editlabRoute,
      "    const outputPath = path.join(TMP_ROOT, `${crypto.randomUUID()}.mp4`);\n    try {\n      await fs.promises.mkdir(jobDir, { recursive: true });",
      "    const outputPath = path.join(TMP_ROOT, `${crypto.randomUUID()}.mp4`);\n    let chargeId = null;\n    let charged = false;\n    try {\n      const debit = await chargeEditLabPoints(req.user.id);\n      if (!debit.ok) {\n        await fs.promises.unlink(inputPath).catch(() => {});\n        return res.status(402).json({\n          error: 'Each EditLab export costs 10 points. Your current balance is ' + debit.balance + '.',\n          code: 'INSUFFICIENT_EDITLAB_POINTS',\n          requiredPoints: EDITLAB_COST_POINTS,\n          balance: debit.balance,\n        });\n      }\n      chargeId = debit.chargeId;\n      charged = true;\n      await fs.promises.mkdir(jobDir, { recursive: true });",
      'charge ten points before starting EditLab processing'
    );
    editlabRoute = replaceOnce(
      editlabRoute,
      "    res.sendFile(outputPath, async (sendError) => {\n        await Promise.allSettled([fs.promises.unlink(outputPath), fs.promises.rm(jobDir, { recursive: true, force: true })]);\n        if (sendError && !res.headersSent) next(sendError);\n      });",
      "    res.sendFile(outputPath, async (sendError) => {\n        await Promise.allSettled([fs.promises.unlink(outputPath), fs.promises.rm(jobDir, { recursive: true, force: true })]);\n        if (sendError && charged && chargeId) {\n          try { await refundEditLabPoints(req.user.id, chargeId); }\n          catch (refundError) { console.error('EditLab delivery refund failed:', refundError.message); }\n        }\n        if (sendError && !res.headersSent) next(sendError);\n      });",
      'refund if the processed file cannot be delivered'
    );
    editlabRoute = replaceOnce(
      editlabRoute,
      "    } catch (error) {\n      await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath), fs.promises.rm(jobDir, { recursive: true, force: true })]);",
      "    } catch (error) {\n      if (charged && chargeId) {\n        try { await refundEditLabPoints(req.user.id, chargeId); }\n        catch (refundError) { console.error('EditLab processing refund failed:', refundError.message); }\n      }\n      await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath), fs.promises.rm(jobDir, { recursive: true, force: true })]);",
      'refund ten points when EditLab processing fails'
    );
  }

  // --- Frontend: clearly display the 10-point cost and refresh the wallet balance. ---
  if (!component.includes('evlr-cost-hint')) {
    component = replaceOnce(
      component,
      "const MAX_FILE_BYTES = 250 * 1024 * 1024;",
      "const MAX_FILE_BYTES = 250 * 1024 * 1024;\nconst PROCESSING_COST_POINTS = 10;",
      'EditLab processing price constant'
    );
    const costHint = `              <div className="evlr-cost-hint"><Coins size={14} /><span>{tx(\`Each export costs \${PROCESSING_COST_POINTS} points.\`, \`كل عملية تصدير تكلف \${PROCESSING_COST_POINTS} نقاط.\`)}</span></div>\n`;
    component = replaceOnce(
      component,
      "              <button type=\"button\" className=\"evlr-export-btn\" onClick={compressAndDownload} disabled={!file || processing}>{processing ? <><LoaderCircle size={17} className=\"evlr-spin\" /> {tx('Processing video…', 'جارٍ معالجة الفيديو…')}</> : <><Scissors size={17} /> {tx('Apply CC & compress', 'تطبيق CC وضغط الفيديو')} <ArrowRight size={16} /></>}</button>",
      costHint + "              <button type=\"button\" className=\"evlr-export-btn\" onClick={compressAndDownload} disabled={!file || processing}>{processing ? <><LoaderCircle size={17} className=\"evlr-spin\" /> {tx('Processing video…', 'جارٍ معالجة الفيديو…')}</> : <><Scissors size={17} /> {tx('Apply CC & compress', 'تطبيق CC وضغط الفيديو')} <ArrowRight size={16} /></>}</button>",
      'show cost beside normal EditLab export'
    );
    const enhancementButton = "              <button type=\"button\" className=\"evlr-export-btn\" onClick={compressAndDownload} disabled={!file || processing}>{processing ? <><LoaderCircle size={17} className=\"evlr-spin\" /> {tx('Enhancing video…', 'جارٍ تحسين الفيديو…')}</> : <><WandSparkles size={17} /> {tx('Enhance & export video', 'حسّن وصدّر الفيديو')} <ArrowRight size={16} /></>}</button>";
    if (component.includes(enhancementButton)) {
      component = replaceOnce(component, enhancementButton, costHint + enhancementButton, 'show cost beside enhancement export');
    } else if (component.includes('evlr-enhance-panel')) {
      throw new Error('The enhanced Export button differs from the expected version. No project files were changed.');
    }
    component = replaceOnce(
      component,
      "      if (!response.ok) {\n        const data = await response.json().catch(() => ({}));\n        throw new Error(data.error || (isArabic ? 'تعذر معالجة الفيديو.' : 'Could not process this video.'));\n      }",
      "      if (!response.ok) {\n        const data = await response.json().catch(() => ({}));\n        if (typeof data.balance === 'number') onPointsChange?.(Number(data.balance));\n        if (data.code === 'INSUFFICIENT_EDITLAB_POINTS') {\n          throw new Error(isArabic ? `التصدير يكلف 10 نقاط. رصيدك الحالي ${Number(data.balance || 0)} نقطة.` : data.error);\n        }\n        throw new Error(data.error || (isArabic ? 'تعذر معالجة الفيديو.' : 'Could not process this video.'));\n      }",
      'show insufficient points message and refresh balance'
    );
    component = replaceOnce(
      component,
      '      const url = URL.createObjectURL(blob);\n      const baseName = file.name.replace(/\\.[^.]+$/, \'\').replace(/[^a-z0-9_-]/gi, \'-\').slice(0, 70) || \'editvault-video\';',
      '      const url = URL.createObjectURL(blob);\n      try {\n        const walletResponse = await fetch(`${API_URL}/api/wallet`, { headers: authHeaders() });\n        if (walletResponse.ok) {\n          const walletData = await walletResponse.json();\n          onPointsChange?.(Number(walletData.balance || 0));\n        }\n      } catch { /* the export succeeded; wallet display can refresh later */ }\n      const baseName = file.name.replace(/\\.[^.]+$/, \'\').replace(/[^a-z0-9_-]/gi, \'-\').slice(0, 70) || \'editvault-video\';',
      'refresh the displayed wallet after successful export'
    );
  }

  if (!componentCss.includes('.evlr-cost-hint')) {
    componentCss += `\n\n/* Visible EditLab per-export point cost */\n.evlr-cost-hint{display:flex;align-items:center;gap:8px;margin:10px 0;padding:10px 12px;border:1px solid rgba(153,129,240,.30);border-radius:10px;background:rgba(137,108,228,.08);color:var(--evlr-muted);font-size:11px;line-height:1.5}\n.evlr-cost-hint svg{flex:0 0 auto;color:#c6b8ff}\n`;
  }

  // --- Topaz: remove the confusing API-key banner after the status endpoint says configured. ---
  const configuredMessage = "apiState === 'configured' ? 'TOPAZ_API_KEY is present in the backend environment. The first job will validate it with Topaz.' : ";
  if (topazComponent.includes(configuredMessage)) {
    topazComponent = replaceOnce(topazComponent, configuredMessage, "apiState === 'configured' ? 'Topaz is ready for an admin test.' : ", 'replace the verbose API-key status text');
  }
  // Hide the success banner completely once configured; missing-key and request errors remain visible.
  const bannerOld = `        <div className={\`topaz-admin-key-state \${apiState === 'configured' ? 'is-good' : 'is-warn'}\`}>\n          <span className="topaz-admin-state-dot" />\n          {apiState === 'checking' ? 'Checking server configuration…' : apiState === 'configured' ? 'Topaz is ready for an admin test.' : apiState === 'missing' ? 'TOPAZ_API_KEY is missing from server/.env. Save it and restart the backend.' : error || 'Topaz configuration could not be checked.'}\n        </div>`;
  if (topazComponent.includes(bannerOld)) {
    const bannerNew = `        {apiState !== 'configured' && <div className={\`topaz-admin-key-state \${apiState === 'configured' ? 'is-good' : 'is-warn'}\`}>\n          <span className="topaz-admin-state-dot" />\n          {apiState === 'checking' ? 'Checking server configuration…' : apiState === 'missing' ? 'TOPAZ_API_KEY is missing from server/.env. Save it and restart the backend.' : error || 'Topaz configuration could not be checked.'}\n        </div>}`;
    topazComponent = replaceOnce(topazComponent, bannerOld, bannerNew, 'hide configured Topaz API-key banner');
  }

  // Remove the same misleading success wording from the status API response as well.
  const oldStatusMessage = "message: 'The key is present in the backend environment. The first actual job will verify that Topaz accepts it.',";
  if (topazRoute.includes(oldStatusMessage)) {
    topazRoute = replaceOnce(topazRoute, oldStatusMessage, "message: 'Administrator-only Topaz tools are available.',", 'replace Topaz status response wording');
  }

  // --- Topaz: properly read the signed URL array described by the current API docs. ---
  if (!topazRoute.includes('function extractUploadUrls(payload)')) {
    topazRoute = replaceOnce(
      topazRoute,
      'function statusValue(data) {',
      `function extractUploadUrls(payload) {\n  const found = [];\n  const seen = new Set();\n  const add = (candidate) => {\n    if (typeof candidate === 'string' && /^https:\\/\\//i.test(candidate) && !seen.has(candidate)) {\n      seen.add(candidate);\n      found.push(candidate);\n    }\n  };\n  const visit = (value, key = '', depth = 0) => {\n    if (depth > 8 || value == null) return;\n    if (typeof value === 'string') {\n      if (/^(?:urls?|upload[_-]?urls?)$/i.test(key)) add(value);\n      return;\n    }\n    if (Array.isArray(value)) {\n      for (const item of value) {\n        if (typeof item === 'string' && /^(?:urls?|upload[_-]?urls?)$/i.test(key)) add(item);\n        else visit(item, key, depth + 1);\n      }\n      return;\n    }\n    if (typeof value === 'object') {\n      for (const [childKey, childValue] of Object.entries(value)) {\n        if (/^(?:urls?|upload[_-]?urls?)$/i.test(childKey)) visit(childValue, childKey, depth + 1);\n        else if (childValue && typeof childValue === 'object') visit(childValue, childKey, depth + 1);\n      }\n    }\n  };\n  visit(payload);\n  return found;\n}\n\nfunction statusValue(data) {`,
      'insert Topaz upload URL array extractor'
    );
  }

  const oldUploadStart = '    const uploadUrl = findUrl(accepted.data, false);';
  if (topazRoute.includes(oldUploadStart)) {
    const videoFlowPattern = /    const uploadUrl = findUrl\(accepted\.data, false\);[\s\S]*?    res\.status\(202\)\.json\(\{ requestId: String\(requestId\), status: 'Queued', quality, output: `\$\{outputWidth\}×\$\{outputHeight\}`, model: 'Proteus' \}\);/;
    if (!videoFlowPattern.test(topazRoute)) throw new Error('Could not safely replace the old Topaz upload flow. No project files were changed.');
    const newVideoFlow = `    // Current Topaz Video API returns signed upload URLs in { uploadId, urls: string[] }.\n    const uploadUrls = extractUploadUrls(accepted.data);\n    if (uploadUrls.length === 0) {\n      const responseFields = Object.keys(accepted.data || {}).join(', ') || 'empty response body';\n      const detail = String(accepted.data?.message || accepted.data?.error || '').slice(0, 240);\n      return res.status(502).json({\n        error: 'Topaz accepted video request ' + requestId + ' but its accept response contained no usable upload URL (fields: ' + responseFields + (detail ? '; detail: ' + detail : '') + '). Check the Topaz dashboard before creating another request.',\n        requestId: String(requestId),\n      });\n    }\n    if (uploadUrls.length !== 1) {\n      return res.status(502).json({\n        error: 'Topaz returned ' + uploadUrls.length + ' upload URLs for request ' + requestId + '; this private test route only supports one-part uploads.',\n        requestId: String(requestId),\n      });\n    }\n\n    const putResponse = await fetch(uploadUrls[0], { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: req.file.buffer });\n    if (!putResponse.ok) {\n      return res.status(502).json({\n        error: 'Video upload to Topaz failed (HTTP ' + putResponse.status + ') for request ' + requestId + '. Check the Topaz dashboard before retrying.',\n        requestId: String(requestId),\n      });\n    }\n    // Topaz documents the sub-500-MB single-URL flow as a direct PUT without multipart ETag collection.\n    res.status(202).json({ requestId: String(requestId), status: 'Queued', quality, output: outputWidth + '×' + outputHeight, model: 'Proteus' });`;
    topazRoute = topazRoute.replace(videoFlowPattern, newVideoFlow);
  } else if (!topazRoute.includes('const uploadUrls = extractUploadUrls(accepted.data);') && !topazRoute.includes('Topaz documented single-part upload flow')) {
    throw new Error('The Topaz route has an unknown upload-flow version. No project files were changed.');
  }

  // Update the schema template and legacy migration so future setup runs keep the new ledger reason.
  const schemaOld = "reason TEXT NOT NULL CHECK (reason IN ('purchase','sale','ad_reward','admin_adjustment','refund')),";
  const schemaNew = "reason TEXT NOT NULL CHECK (reason IN ('purchase','sale','ad_reward','admin_adjustment','refund','referral_reward','editlab_processing')),";
  if (schema.includes(schemaOld)) schema = replaceOnce(schema, schemaOld, schemaNew, 'schema point-ledger reasons');
  else if (!schema.includes("'editlab_processing'")) throw new Error('The point-ledger schema line differs from the expected version. No project files were changed.');

  const rewardsOld = "CHECK (reason IN ('purchase','sale','ad_reward','admin_adjustment','refund','referral_reward'))";
  const rewardsNew = "CHECK (reason IN ('purchase','sale','ad_reward','admin_adjustment','refund','referral_reward','editlab_processing'))";
  if (rewardsMigration.includes(rewardsOld)) rewardsMigration = replaceOnce(rewardsMigration, rewardsOld, rewardsNew, 'legacy EditLab/rewards migration reasons');
  else if (!rewardsMigration.includes("'editlab_processing'")) throw new Error('The existing EditLab/rewards migration differs from the expected version. No project files were changed.');

  if (fs.existsSync(files.processingMigration)) {
    const existingMigration = fs.readFileSync(files.processingMigration, 'utf8');
    if (!existingMigration.includes('EditLab 10-point processing ledger migration')) {
      throw new Error('server/src/db/apply-editlab-processing-points.js already exists with different contents. No project files were changed.');
    }
  }

  // All validation and in-memory edits are complete; now create backups and write the changes.
  const plan = [
    { file: files.component, original: fs.readFileSync(files.component, 'utf8'), content: component },
    { file: files.componentCss, original: fs.readFileSync(files.componentCss, 'utf8'), content: componentCss },
    { file: files.editlabRoute, original: fs.readFileSync(files.editlabRoute, 'utf8'), content: editlabRoute },
    { file: files.topazComponent, original: fs.readFileSync(files.topazComponent, 'utf8'), content: topazComponent },
    { file: files.topazRoute, original: fs.readFileSync(files.topazRoute, 'utf8'), content: topazRoute },
    { file: files.schema, original: fs.readFileSync(files.schema, 'utf8'), content: schema },
    { file: files.rewardsMigration, original: fs.readFileSync(files.rewardsMigration, 'utf8'), content: rewardsMigration },
  ];
  if (!fs.existsSync(files.processingMigration)) {
    plan.push({ file: files.processingMigration, original: '', content: migrationTemplate });
  }
  const backupDir = backupWritePlan(plan);

  console.log('EditVault update applied: EditLab exports now cost 10 points per successful export instead of using the hourly EditLab limit.');
  console.log('If FFmpeg processing or file delivery fails, the 10 points are refunded. Insufficient balance returns a clear message without charging.');
  console.log('Removed the verbose TOPAZ_API_KEY-present banner and patched the Topaz signed upload URL parsing.');
  console.log('Backup created at: ' + path.relative(root, backupDir));
  console.log('Next: run server/src/db/apply-editlab-processing-points.js, then restart the backend and refresh Vite.');
} catch (error) {
  console.error('EditVault EditLab/Topaz update stopped: ' + error.message);
  process.exitCode = 1;
}
