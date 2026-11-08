const router = require('express').Router();
const multer = require('multer');
const { auth, adminOnly } = require('../middleware/auth');

const TOPAZ_IMAGE_BASE = 'https://api.topazlabs.com/image/v1';
const TOPAZ_VIDEO_BASE = 'https://api.topazlabs.com/video';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // Keep this first admin test to a single-part upload.

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, callback) => {
    const ok = /^image\/(jpeg|png|webp|tiff)$/.test(file.mimetype || '');
    callback(ok ? null : new Error('Choose a JPG, PNG, WebP, or TIFF image.'), ok);
  },
});
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, callback) => {
    const isMp4 = (file.mimetype || '') === 'video/mp4' || /\.mp4$/i.test(file.originalname || '');
    callback(isMp4 ? null : new Error('For the first Topaz video test, use an MP4 file.'), isMp4);
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
    videoEndpoint: `${TOPAZ_VIDEO_BASE}/`,
    access: 'admin-only',
    message: 'The key is present in the backend environment. The first actual job will verify that Topaz accepts it.',
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

// VIDEO: short MP4 admin test job. The endpoint only begins processing after upload completion.
router.post('/videos', handleUpload(videoUpload, 'video', 25), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an MP4 video first.' });
    const width = Number(req.body?.width);
    const height = Number(req.body?.height);
    const duration = Number(req.body?.duration);
    const frameRate = Number(req.body?.frameRate || 30);
    const quality = String(req.body?.quality || '1080p');
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > 7680 || height > 7680) {
      return res.status(400).json({ error: 'Could not read the video dimensions. Re-select the MP4 and try again.' });
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 120) return res.status(400).json({ error: 'For the first test, choose a video up to 2 minutes long.' });
    if (![24, 25, 30, 50, 60].includes(frameRate)) return res.status(400).json({ error: 'Choose a frame rate of 24, 25, 30, 50, or 60 FPS.' });
    if (!['720p', '1080p', '4k'].includes(quality)) return res.status(400).json({ error: 'Choose 720p, 1080p, or 4K output.' });

    const targetLongEdge = quality === '720p' ? 1280 : quality === '1080p' ? 1920 : 3840;
    const scale = targetLongEdge / Math.max(width, height);
    const outputWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
    const outputHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
    const frameCount = Math.max(1, Math.round(duration * frameRate));
    const requestBody = {
      source: { resolution: { width, height }, container: 'mp4', size: req.file.size, duration, frameRate, frameCount },
      output: { resolution: { width: outputWidth, height: outputHeight }, audioCodec: 'AAC', audioTransfer: 'Copy', frameRate, dynamicCompressionLevel: 'High', container: 'mp4' },
      filters: [{ model: 'prob-4' }],
    };

    const created = await topazFetch(`${TOPAZ_VIDEO_BASE}/`, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(requestBody),
    });
    if (!created.response.ok) return res.status(502).json({ error: `Topaz rejected the video request (HTTP ${created.response.status}): ${upstreamMessage(created.data)}` });
    const requestId = created.data.requestID || created.data.requestId || created.data.request_id || created.data.id;
    if (!requestId) return res.status(502).json({ error: 'Topaz did not return a video request ID.' });

    const accepted = await topazFetch(`${TOPAZ_VIDEO_BASE}/${encodeURIComponent(String(requestId))}/accept`, { method: 'PATCH', headers: { accept: 'application/json' } });
    if (!accepted.response.ok) return res.status(502).json({ error: `Topaz could not accept the video upload (HTTP ${accepted.response.status}): ${upstreamMessage(accepted.data)}` });
    // Topaz documented single-part upload flow: accept returns { uploadId, urls: string[] }.
    // Files in this first test are capped at 25 MB, so one URL and one PUT are expected.
    const uploadUrls = Array.isArray(accepted.data?.urls)
      ? accepted.data.urls.filter((item) => typeof item === 'string' && /^https:\/\//i.test(item))
      : [accepted.data?.url || accepted.data?.uploadUrl || accepted.data?.upload_url || findUrl(accepted.data, false)].filter((item) => typeof item === 'string' && /^https:\/\//i.test(item));

    if (uploadUrls.length === 0) {
      const responseFields = Object.keys(accepted.data || {}).join(', ') || 'empty response body';
      return res.status(502).json({
        error: `Topaz accepted video request ${requestId} but returned no usable upload URL (response fields: ${responseFields}). Check the Topaz dashboard before retrying.`,
        requestId: String(requestId),
      });
    }
    if (uploadUrls.length !== 1) {
      return res.status(502).json({
        error: `Topaz returned ${uploadUrls.length} upload URLs for request ${requestId}; this first-test route supports one-part uploads only. Check the Topaz dashboard before retrying.`,
        requestId: String(requestId),
      });
    }

    const putResponse = await fetch(uploadUrls[0], { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: req.file.buffer });
    if (!putResponse.ok) {
      return res.status(502).json({
        error: `Video upload to Topaz failed (HTTP ${putResponse.status}) for request ${requestId}. Check the Topaz dashboard before retrying.`,
        requestId: String(requestId),
      });
    }

    // Current Topaz reference says single-URL uploads do not need multipart part numbers/ETags.
    // Multi-part handling is intentionally not enabled while this route's max file size is 25 MB.
    res.status(202).json({ requestId: String(requestId), status: 'Queued', quality, output: `${outputWidth}×${outputHeight}`, model: 'Proteus' });
  } catch (error) { next(error); }
});

router.get('/videos/:requestId/status', async (req, res, next) => {
  try {
    const id = String(req.params.requestId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return res.status(400).json({ error: 'Invalid Topaz video request ID.' });
    const { response, data } = await topazFetch(`${TOPAZ_VIDEO_BASE}/${encodeURIComponent(id)}/status`);
    if (!response.ok) return res.status(502).json({ error: `Topaz video status failed (HTTP ${response.status}): ${upstreamMessage(data)}` });
    const status = statusValue(data);
    const downloadUrl = findUrl(data, true);
    res.json({ status, downloadUrl: downloadUrl && /^https:\/\//i.test(downloadUrl) ? downloadUrl : null, eta: data.eta || null });
  } catch (error) { next(error); }
});

module.exports = router;
