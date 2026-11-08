const router = require('express').Router();
const multer = require('multer');
const { auth, adminOnly } = require('../middleware/auth');

const TOPAZ_IMAGE_BASE = 'https://api.topazlabs.com/image/v1';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, callback) => {
    const ok = /^image\/(jpeg|png|webp|tiff)$/.test(file.mimetype || '');
    callback(ok ? null : new Error('Choose a JPG, PNG, WebP, or TIFF image.'), ok);
  },
});
function handleUpload(middleware, label, maxMb) {
  return (req, res, next) => middleware.single(label)(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File exceeds the ${maxMb} MB Topaz test limit.` });
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.message });
    return res.status(400).json({ error: error.message || 'Invalid upload.' });
  });
}

function requireTopazKey(req, res, next) {
  if (!process.env.TOPAZ_API_KEY || !process.env.TOPAZ_API_KEY.trim()) {
    return res.status(503).json({ error: 'TOPAZ_API_KEY is missing from server/.env. Restart the backend after saving it.' });
  }
  next();
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 300) }; }
}

function upstreamMessage(data, fallback) {
  let message = String(data?.message || data?.error || data?.detail || fallback || 'Topaz request failed.');
  if (process.env.TOPAZ_API_KEY) message = message.split(process.env.TOPAZ_API_KEY).join('[redacted]');
  return message.slice(0, 500);
}

async function topazFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-API-Key': process.env.TOPAZ_API_KEY,
      ...(options.headers || {}),
    },
  });
  const data = await readJson(response);
  return { response, data };
}

function findUrl(value, preferDownload = false, depth = 0) {
  if (depth > 8 || value == null) return '';
  // Topaz may return URLs as string array entries, e.g. { uploadId, urls: ["https://..."] }.
  if (typeof value === 'string') return /^https:\/\//i.test(value) ? value : '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item, preferDownload, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const entries = Object.entries(value);
  if (preferDownload) {
    for (const [key, item] of entries) {
      if (/download|output|result/i.test(key) && typeof item === 'string' && /^https:\/\//i.test(item)) return item;
    }
  }
  for (const [, item] of entries) {
    if (typeof item === 'string' && /^https:\/\//i.test(item)) return item;
  }
  for (const [, item] of entries) {
    const found = findUrl(item, preferDownload, depth + 1);
    if (found) return found;
  }
  return '';
}

function statusValue(data) {
  return String(data?.status || data?.state || data?.processing_status || 'Processing');
}

// Every route below is authenticated AND restricted to administrators. Do not expose this as a public processing service.
router.use(auth, adminOnly, requireTopazKey);

router.get('/status', (_req, res) => {
  res.json({
    configured: true,
    imageEndpoint: `${TOPAZ_IMAGE_BASE}/enhance/async`,
    access: 'admin-only',
    message: 'Administrator-only Topaz image enhancement is available.',
  });
});

// IMAGE: submit an asynchronous enhancement job. Actual processing may consume Topaz credits.
router.post('/images', handleUpload(imageUpload, 'image', 25), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an image first.' });
    const allowedModels = new Set(['Standard V2', 'High Fidelity V2']);
    const model = allowedModels.has(String(req.body?.model || '')) ? String(req.body.model) : 'Standard V2';
    const ext = String(req.file.originalname || '').split('.').pop().toLowerCase();
    const outputFormat = ext === 'png' ? 'png' : 'jpeg';
    const form = new FormData();
    form.append('model', model);
    form.append('output_format', outputFormat);
    form.append('image', new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' }), req.file.originalname || 'input-image');

    const { response, data } = await topazFetch(`${TOPAZ_IMAGE_BASE}/enhance/async`, { method: 'POST', body: form });
    if (!response.ok) return res.status(502).json({ error: `Topaz rejected the image job (HTTP ${response.status}): ${upstreamMessage(data)}` });
    const processId = data.process_id || data.processId || data.id;
    if (!processId) return res.status(502).json({ error: 'Topaz accepted the request but did not return a process ID.' });
    res.status(202).json({ processId: String(processId), eta: data.eta || null, status: 'Queued', model });
  } catch (error) { next(error); }
});

router.get('/images/:processId/status', async (req, res, next) => {
  try {
    const id = String(req.params.processId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return res.status(400).json({ error: 'Invalid Topaz process ID.' });
    const { response, data } = await topazFetch(`${TOPAZ_IMAGE_BASE}/status/${encodeURIComponent(id)}`);
    if (!response.ok) return res.status(502).json({ error: `Topaz status check failed (HTTP ${response.status}): ${upstreamMessage(data)}` });
    res.json({ status: statusValue(data), eta: data.eta || null, detail: data.message || null });
  } catch (error) { next(error); }
});

router.get('/images/:processId/download', async (req, res, next) => {
  try {
    const id = String(req.params.processId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return res.status(400).json({ error: 'Invalid Topaz process ID.' });
    const { response, data } = await topazFetch(`${TOPAZ_IMAGE_BASE}/download/${encodeURIComponent(id)}`);
    if (!response.ok) return res.status(502).json({ error: `Topaz download lookup failed (HTTP ${response.status}): ${upstreamMessage(data)}` });
    const url = data.url || data.download_url || findUrl(data, true);
    if (!url || !/^https:\/\//i.test(url)) return res.status(502).json({ error: 'Topaz did not return a download URL yet. Check the job status and try again.' });
    res.json({ url });
  } catch (error) { next(error); }
});

// Topaz video endpoints are intentionally disabled; EditLab handles video processing locally.

module.exports = router;
