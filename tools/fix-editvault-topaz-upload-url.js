'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const routePath = path.join(root, 'server', 'src', 'routes', 'topaz.js');

function replaceExactlyOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one match for ${label}; found ${count}. No project files were changed.`);
  }
  return source.replace(before, after);
}

try {
  if (!fs.existsSync(routePath)) {
    throw new Error('server/src/routes/topaz.js was not found. Run this script from the EditVault project root.');
  }

  const original = fs.readFileSync(routePath, 'utf8');
  if (original.includes('Topaz documented single-part upload flow')) {
    console.log('Topaz upload URL fix is already installed. No files were changed.');
    process.exit(0);
  }

  let updated = original;
  updated = replaceExactlyOnce(
    updated,
    `function findUrl(value, preferDownload = false, depth = 0) {\n  if (depth > 8 || value == null) return '';\n  if (Array.isArray(value)) {`,
    `function findUrl(value, preferDownload = false, depth = 0) {\n  if (depth > 8 || value == null) return '';\n  // Topaz may return URLs as string array entries, e.g. { uploadId, urls: ["https://..."] }.\n  if (typeof value === 'string') return /^https:\\/\\//i.test(value) ? value : '';\n  if (Array.isArray(value)) {`,
    'findUrl string/array handling'
  );

  const oldUploadBlock = `    const uploadUrl = findUrl(accepted.data, false);\n    if (!uploadUrl) return res.status(502).json({ error: 'Topaz did not return an upload URL. The request was created; check your Topaz dashboard before retrying.' });\n    const putResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: req.file.buffer });\n    if (!putResponse.ok) return res.status(502).json({ error: \`Video upload to Topaz failed (HTTP \${putResponse.status}). Check the Topaz dashboard before retrying.\` });\n    const eTag = putResponse.headers.get('etag');\n    if (!eTag) return res.status(502).json({ error: 'Topaz uploaded the video but did not return an ETag. Check the Topaz dashboard before retrying.' });\n\n    const completed = await topazFetch(\`\${TOPAZ_VIDEO_BASE}/\${encodeURIComponent(String(requestId))}/complete-upload\`, {\n      method: 'PATCH', headers: { 'content-type': 'application/json', accept: 'application/json' },\n      body: JSON.stringify({ uploadResults: [{ partNum: Number(accepted.data.partNum || accepted.data.part_num || 1), eTag }] }),\n    });\n    if (!completed.response.ok) return res.status(502).json({ error: \`Topaz could not queue the video (HTTP \${completed.response.status}): \${upstreamMessage(completed.data)}\` });\n    res.status(202).json({ requestId: String(requestId), status: 'Queued', quality, output: \`\${outputWidth}×\${outputHeight}\`, model: 'Proteus' });`;

  const newUploadBlock = `    // Topaz documented single-part upload flow: accept returns { uploadId, urls: string[] }.\n    // Files in this first test are capped at 25 MB, so one URL and one PUT are expected.\n    const uploadUrls = Array.isArray(accepted.data?.urls)\n      ? accepted.data.urls.filter((item) => typeof item === 'string' && /^https:\\/\\//i.test(item))\n      : [accepted.data?.url || accepted.data?.uploadUrl || accepted.data?.upload_url || findUrl(accepted.data, false)].filter((item) => typeof item === 'string' && /^https:\\/\\//i.test(item));\n\n    if (uploadUrls.length === 0) {\n      const responseFields = Object.keys(accepted.data || {}).join(', ') || 'empty response body';\n      return res.status(502).json({\n        error: \`Topaz accepted video request \${requestId} but returned no usable upload URL (response fields: \${responseFields}). Check the Topaz dashboard before retrying.\`,\n        requestId: String(requestId),\n      });\n    }\n    if (uploadUrls.length !== 1) {\n      return res.status(502).json({\n        error: \`Topaz returned \${uploadUrls.length} upload URLs for request \${requestId}; this first-test route supports one-part uploads only. Check the Topaz dashboard before retrying.\`,\n        requestId: String(requestId),\n      });\n    }\n\n    const putResponse = await fetch(uploadUrls[0], { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: req.file.buffer });\n    if (!putResponse.ok) {\n      return res.status(502).json({\n        error: \`Video upload to Topaz failed (HTTP \${putResponse.status}) for request \${requestId}. Check the Topaz dashboard before retrying.\`,\n        requestId: String(requestId),\n      });\n    }\n\n    // Current Topaz reference says single-URL uploads do not need multipart part numbers/ETags.\n    // Multi-part handling is intentionally not enabled while this route's max file size is 25 MB.\n    res.status(202).json({ requestId: String(requestId), status: 'Queued', quality, output: \`\${outputWidth}×\${outputHeight}\`, model: 'Proteus' });`;

  updated = replaceExactlyOnce(updated, oldUploadBlock, newUploadBlock, 'Topaz video single-part upload flow');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(root, `server/src/routes/topaz.js.pre-upload-url-fix-${timestamp}.bak`);
  fs.copyFileSync(routePath, backupPath, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(routePath, updated, 'utf8');

  console.log('EditVault Topaz upload URL fix applied.');
  console.log('Cause fixed: Topaz returns upload URLs in the documented `urls` array; the old helper ignored primitive string items.');
  console.log('The small-file route now follows the single-part upload flow and does not require multipart ETag handling.');
  console.log('Backup: ' + path.relative(root, backupPath));
  console.log('No database migration is required. Restart the backend before testing again.');
} catch (error) {
  console.error('Topaz upload URL fix stopped: ' + error.message);
  process.exitCode = 1;
}
