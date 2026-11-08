const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');
const multer = require('multer');
const { auth } = require('../middleware/auth');
const db = require('../db/pool');

const router = express.Router();
const TMP_ROOT = path.join(os.tmpdir(), 'editvault-editlab');
const MAX_BYTES = Math.max(1, Number(process.env.MAX_EDITLAB_UPLOAD_MB || 250)) * 1024 * 1024;
fs.mkdirSync(TMP_ROOT, { recursive: true });

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const PRESETS = {
  clean: 'eq=contrast=1.00:saturation=1.00:brightness=0.00',
  cinematic: 'eq=contrast=1.12:saturation=1.12:brightness=-0.02',
  warm: 'eq=contrast=1.04:saturation=1.13:brightness=0.02,colorbalance=rs=0.07:gs=0.02:bs=-0.05',
  cool: 'eq=contrast=1.08:saturation=0.92:brightness=0.00,colorbalance=rs=-0.04:gs=0.00:bs=0.06',
  moody: 'eq=contrast=1.16:saturation=0.78:brightness=-0.05',
  vibrant: 'eq=contrast=1.06:saturation=1.34:brightness=0.02',
  pure_quality: 'eq=contrast=1.055:saturation=1.065:brightness=0.012,unsharp=5:5:0.55:5:5:0',
  soft_clean: 'eq=contrast=0.96:saturation=0.91:brightness=0.028',
  bw_classic: 'hue=s=0,eq=contrast=1.16:brightness=0.00',
  bw_noir: 'hue=s=0,eq=contrast=1.38:brightness=-0.045',
  bw_film: 'hue=s=0,eq=contrast=0.98:brightness=0.04',
  teal_orange: 'eq=contrast=1.13:saturation=1.16:brightness=0.00,colorbalance=rs=0.05:gs=0.01:bs=-0.04:rm=-0.03:gm=0.01:bm=0.045',
  night_drive: 'eq=contrast=1.21:saturation=1.22:brightness=-0.045,colorbalance=rs=-0.045:gs=0.0:bs=0.06',
  purple_ae: 'eq=contrast=1.09:saturation=1.25:brightness=0.00,colorbalance=rs=0.045:gs=-0.025:bs=0.052',
  dreamy: 'eq=contrast=0.92:saturation=0.92:brightness=0.06,gblur=sigma=0.42',
  anime_pop: 'eq=contrast=1.14:saturation=1.48:brightness=0.01',
  retro_film: 'eq=contrast=0.94:saturation=0.83:brightness=0.035,colorbalance=rs=0.04:gs=0.015:bs=-0.035',
}; // EDITVAULT_CC_STUDIO_V3
const QUALITY = {
  smaller: { crf: '28', preset: 'veryfast' },
  balanced: { crf: '24', preset: 'medium' },
  higher: { crf: '20', preset: 'slow' },
};

const SHARPEN = {
  off: '',
  light: 'unsharp=5:5:0.35:5:5:0',
  medium: 'unsharp=5:5:0.75:5:5:0',
  strong: 'unsharp=5:5:1.1:5:5:0',
};
const DENOISE = {
  off: '',
  light: 'hqdn3d=1.2:1.2:3:3',
  medium: 'hqdn3d=2:1.5:4:3',
  strong: 'hqdn3d=3:2:6:4',
};
const RESOLUTION = { source: null, '720p': 1280, '1080p': 1920, '1440p': 2560, '4k': 3840 };

const EDITLAB_BASE_POINTS = 10;
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
      `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2 AND balance >= $1 RETURNING balance`,
      [costPoints, userId]
    );
    if (!rows[0]) {
      const { rows: walletRows } = await client.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
      await client.query('ROLLBACK');
      return { ok: false, balance: Number(walletRows[0]?.balance ?? 0) };
    }
    await client.query(
      `INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
       VALUES ($1, $2, 'editlab_processing', $3, $4)`,
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
      `INSERT INTO point_ledger (user_id, amount, reason, reference_id, idempotency_key)
       VALUES ($1, $2, 'refund', $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
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

const upload = multer({
  dest: TMP_ROOT,
  limits: { fileSize: MAX_BYTES, files: 1, fields: 8 },
  fileFilter(_req, file, callback) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const permitted = new Set(['.mp4', '.mov', '.webm', '.mkv']);
    if (!permitted.has(ext)) return callback(new Error('Only MP4, MOV, WebM, and MKV videos are supported.'));
    callback(null, true);
  },
});

function runFfmpeg(inputPath, outputPath, preset, quality, enhancement) {
  return new Promise((resolve, reject) => {
    const videoFilters = [PRESETS[preset]];
    if (DENOISE[enhancement.denoise]) videoFilters.push(DENOISE[enhancement.denoise]);
    if (SHARPEN[enhancement.sharpness]) videoFilters.push(SHARPEN[enhancement.sharpness]);
    const targetLongEdge = RESOLUTION[enhancement.resolution];
    if (targetLongEdge) {
      videoFilters.push(`scale=w='if(gte(iw,ih),${targetLongEdge},-2)':h='if(gte(iw,ih),-2,${targetLongEdge})':flags=lanczos`);
    }
    if (FRAME_RATES[enhancement.frameRate]) videoFilters.push('fps=' + FRAME_RATES[enhancement.frameRate]);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', videoFilters.filter(Boolean).join(','), '-c:v', 'libx264', '-crf', quality.crf,
      '-preset', quality.preset, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      '-max_muxing_queue_size', '1024', outputPath,
    ];
    const child = spawn(FFMPEG, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-6000); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (error.code === 'ENOENT') return reject(Object.assign(new Error('FFmpeg is not installed or FFMPEG_PATH is not configured. Install FFmpeg on the server, then restart the API.'), { statusCode: 503 }));
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return resolve();
      const detail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 450);
      reject(Object.assign(new Error(detail ? `FFmpeg could not process this file: ${detail}` : 'FFmpeg could not process this file. Try another source video.'), { statusCode: 422 }));
    });
  });
}

router.post('/compress', auth, (req, res, next) => {
  upload.single('video')(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Video exceeds the ${Math.round(MAX_BYTES / 1024 / 1024)} MB upload limit.` });
      return res.status(400).json({ error: uploadError.message || 'Invalid video upload.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose a video file first.' });

    const preset = String(req.body?.preset || 'clean');
    const qualityId = String(req.body?.quality || 'balanced');
    if (!Object.prototype.hasOwnProperty.call(PRESETS, preset)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Choose a supported CC preset.' });
    }
    if (!Object.prototype.hasOwnProperty.call(QUALITY, qualityId)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Choose a supported export quality.' });
    }

    const sharpness = String(req.body?.sharpness || 'off');
    const denoise = String(req.body?.denoise || 'off');
    const resolution = String(req.body?.resolution || 'source');
    const frameRate = String(req.body?.frameRate || 'source');
    if (!Object.prototype.hasOwnProperty.call(SHARPEN, sharpness)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Choose a supported sharpness setting.' });
    }
    if (!Object.prototype.hasOwnProperty.call(DENOISE, denoise)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Choose a supported denoise setting.' });
    }
    if (!Object.prototype.hasOwnProperty.call(RESOLUTION, resolution)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Choose a supported output resolution.' });
    }
    if (!Object.prototype.hasOwnProperty.call(FRAME_RATES, frameRate)) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Choose source FPS, 24, 30, 48, or 60 FPS.' });
    }
    const exportCostPoints = calculateEditLabCost({ quality: qualityId, resolution, sharpness, denoise, frameRate });

    const jobDir = path.join(TMP_ROOT, crypto.randomUUID());
    const inputPath = req.file.path;
    const outputPath = path.join(TMP_ROOT, `${crypto.randomUUID()}.mp4`);
    let chargeId = null;
    let charged = false;
    try {
      const debit = await chargeEditLabPoints(req.user.id, exportCostPoints);
      if (!debit.ok) {
        await fs.promises.unlink(inputPath).catch(() => {});
        return res.status(402).json({
          error: 'This EditLab export costs ' + exportCostPoints + ' points. Your current balance is ' + debit.balance + '.',
          code: 'INSUFFICIENT_EDITLAB_POINTS',
          requiredPoints: exportCostPoints,
          balance: debit.balance,
        });
      }
      chargeId = debit.chargeId;
      charged = true;
      await fs.promises.mkdir(jobDir, { recursive: true });
      const jobInput = path.join(jobDir, `source${path.extname(req.file.originalname).toLowerCase()}`);
      await fs.promises.rename(inputPath, jobInput);
      await runFfmpeg(jobInput, outputPath, preset, QUALITY[qualityId], { sharpness, denoise, resolution, frameRate });
      const inputBytes = Number(req.file.size || 0);
      const outputBytes = fs.statSync(outputPath).size;
      const safeName = path.basename(req.file.originalname || 'editvault-video').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.[^.]+$/, '').slice(0, 70) || 'editvault-video';
      res.status(200);
      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${safeName}-editvault.mp4"`,
        'Content-Length': String(outputBytes),
        'X-Input-Bytes': String(inputBytes),
        'X-Output-Bytes': String(outputBytes),
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Input-Bytes, X-Output-Bytes',
        'Cache-Control': 'no-store',
      });
      res.sendFile(outputPath, async (sendError) => {
        await Promise.allSettled([fs.promises.unlink(outputPath), fs.promises.rm(jobDir, { recursive: true, force: true })]);
        if (sendError && charged && chargeId) {
          try { await refundEditLabPoints(req.user.id, chargeId, exportCostPoints); }
          catch (refundError) { console.error('EditLab delivery refund failed:', refundError.message); }
        }
        if (sendError && !res.headersSent) next(sendError);
      });
    } catch (error) {
      if (charged && chargeId) {
        try { await refundEditLabPoints(req.user.id, chargeId, exportCostPoints); }
        catch (refundError) { console.error('EditLab processing refund failed:', refundError.message); }
      }
      await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath), fs.promises.rm(jobDir, { recursive: true, force: true })]);
      const status = Number(error.statusCode) || 500;
      if (status >= 500 && status !== 503) console.error('EditLab processing failed:', error.message);
      res.status(status).json({ error: error.message || 'EditLab could not process the video.' });
    }
  });
});

router.use('/audio', require('./editlab-audio'));

module.exports = router;
