'use strict';
// EditVault Audio Lab V2 — server-side FFmpeg tools, no external API or AI claims.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');
const multer = require('multer');
const db = require('../db/pool');
const { auth } = require('../middleware/auth');

const router = express.Router();
const ROOT = path.join(os.tmpdir(), 'editvault-audio-lab');
fs.mkdirSync(ROOT, { recursive: true });
const MAX_BYTES = 150 * 1024 * 1024;
const MAX_SECONDS = 600;
const MAX_RUNNING = 2;
let running = 0;
const activeUsers = new Set();
const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static') || 'ffmpeg';
const TOOLS = Object.freeze({
  extract: { points: 1, filters: [], video: true },
  trim: { points: 1, filters: [] },
  normalize: { points: 1, filters: ['loudnorm=I=-16:TP=-1.5:LRA=11'] },
  denoise: { points: 2, filters: ['highpass=f=70', 'afftdn=nf=-28'] },
  voice: { points: 3, filters: ['highpass=f=95', 'lowpass=f=9000', 'afftdn=nf=-28', 'loudnorm=I=-16:TP=-1.5:LRA=11'] },
  bass: { points: 2, filters: ['bass=g=5:f=110:w=0.6', 'alimiter=limit=0.95'] },
});
const allowedExts = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.mp4', '.mov', '.webm', '.mkv']);
const videoExts = new Set(['.mp4', '.mov', '.webm', '.mkv']);
const upload = multer({
  dest: ROOT,
  limits: { fileSize: MAX_BYTES, files: 1, fields: 4 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExts.has(ext)) return cb(new Error('Unsupported file type. Choose MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, WebM, or MKV.'));
    cb(null, true);
  },
});

function execFfmpeg(args, { timeoutMs = 480_000, allowNonzero = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let completed = false;
    const finish = (error, output) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(Object.assign(new Error('Audio processing timed out. Try a shorter file.'), { statusCode: 422 }));
    }, timeoutMs);
    child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-10_000); });
    child.on('error', error => finish(Object.assign(new Error(error.code === 'ENOENT' ? 'FFmpeg is unavailable on this server.' : error.message), { statusCode: error.code === 'ENOENT' ? 503 : 500 })));
    child.on('close', code => {
      if (code === 0 || allowNonzero) return finish(null, stderr);
      // Do not expose the full internal FFmpeg stderr or local file paths to clients.
      return finish(Object.assign(new Error('Could not process this audio file. Check that it contains a supported audio track.'), { statusCode: 422 }));
    });
  });
}

function mediaDuration(text) {
  const found = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  return found ? Number(found[1]) * 3600 + Number(found[2]) * 60 + Number(found[3]) : null;
}

async function reserve(userId, cost) {
  const client = await db.connect();
  const chargeId = crypto.randomUUID();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND balance >= $1 RETURNING balance', [cost, userId]);
    if (!rows.length) {
      const wallet = await client.query('SELECT balance FROM wallets WHERE user_id=$1', [userId]);
      await client.query('ROLLBACK');
      return { ok: false, balance: Number(wallet.rows[0]?.balance ?? 0) };
    }
    // Keep ledger reason compatible with existing EditLab constraint.
    await client.query("INSERT INTO point_ledger(user_id, amount, reason, reference_id, idempotency_key) VALUES($1,$2,'editlab_processing',$3,$4)", [userId, -cost, chargeId, 'audio-charge:' + chargeId]);
    await client.query('COMMIT');
    return { ok: true, id: chargeId, balance: Number(rows[0].balance) };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

async function refund(userId, chargeId, cost) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query("INSERT INTO point_ledger(user_id,amount,reason,reference_id,idempotency_key) VALUES($1,$2,'refund',$3,$4) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id", [userId, cost, chargeId, 'audio-refund:' + chargeId]);
    if (inserted.rowCount) await client.query('UPDATE wallets SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2', [cost, userId]);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { client.release(); }
}

router.get('/tools', (_req, res) => res.json({ maxBytes: MAX_BYTES, maxSeconds: MAX_SECONDS, tools: Object.fromEntries(Object.entries(TOOLS).map(([key, value]) => [key, value.points])) }));

router.post('/process', auth, (req, res) => {
  upload.single('audio')(req, res, async error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 150 MB audio limit.' : error.message });
    const tempInput = req.file?.path;
    if (!tempInput) return res.status(400).json({ error: 'Choose an audio or video file first.' });
    const toolId = String(req.body?.tool || 'extract');
    const tool = TOOLS[toolId];
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    if (!tool || (tool.video && !videoExts.has(ext))) {
      await fs.promises.unlink(tempInput).catch(() => {});
      return res.status(400).json({ error: !tool ? 'Unknown audio tool.' : 'Extract audio requires a video file.' });
    }
    const start = Number(req.body?.start || 0);
    const end = Number(req.body?.end || 0);
    if (toolId === 'trim' && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > MAX_SECONDS)) {
      await fs.promises.unlink(tempInput).catch(() => {});
      return res.status(400).json({ error: 'Enter a valid start/end time. Maximum clip length: 600 seconds.' });
    }
    if (running >= MAX_RUNNING || activeUsers.has(req.user.id)) {
      await fs.promises.unlink(tempInput).catch(() => {});
      return res.status(429).json({ error: 'Audio Lab is busy. Please wait for your current job to finish.' });
    }
    running += 1;
    activeUsers.add(req.user.id);
    const outDir = path.join(ROOT, crypto.randomUUID());
    const outPath = path.join(outDir, 'output.mp3');
    let chargeId = null;
    let delivered = false;
    try {
      await fs.promises.mkdir(outDir, { recursive: true });
      const probe = await execFfmpeg(['-hide_banner', '-i', tempInput], { timeoutMs: 20_000, allowNonzero: true });
      const duration = mediaDuration(probe);
      if (!duration || duration > MAX_SECONDS + 0.1) throw Object.assign(new Error('Choose a file up to 10 minutes long.'), { statusCode: 422 });
      if (toolId === 'trim' && (start >= duration || end > duration + 0.1)) throw Object.assign(new Error('The trim range must fit inside the file duration.'), { statusCode: 422 });
      if (!/Audio:\s*\S+/i.test(probe)) throw Object.assign(new Error('This file does not contain an audio track.'), { statusCode: 422 });
      const debit = await reserve(req.user.id, tool.points);
      if (!debit.ok) return res.status(402).json({ error: `This operation costs ${tool.points} points.`, code: 'INSUFFICIENT_AUDIO_POINTS', balance: debit.balance, requiredPoints: tool.points });
      chargeId = debit.id;
      const args = ['-hide_banner', '-loglevel', 'error', '-y'];
      if (toolId === 'trim') args.push('-ss', String(start));
      args.push('-i', tempInput);
      if (toolId === 'trim') args.push('-t', String(end - start));
      args.push('-map', '0:a:0', '-vn');
      if (tool.filters.length) args.push('-af', tool.filters.join(','));
      args.push('-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', outPath);
      await execFfmpeg(args);
      const bytes = (await fs.promises.stat(outPath)).size;
      if (!bytes) throw Object.assign(new Error('No audio was produced.'), { statusCode: 422 });
      const safeName = path.basename(req.file.originalname || 'audio').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50) || 'audio';
      res.set({ 'Content-Type': 'audio/mpeg', 'Content-Disposition': `attachment; filename="${safeName}-${toolId}-editvault.mp3"`, 'Content-Length': String(bytes), 'Cache-Control': 'no-store', 'Access-Control-Expose-Headers': 'Content-Disposition' });
      delivered = true;
      res.sendFile(outPath, async sendErr => {
        if (sendErr && chargeId) {
          try { await refund(req.user.id, chargeId, tool.points); } catch (e) { console.error('Audio Lab delivery refund failed:', e.message); }
        }
        await Promise.allSettled([fs.promises.unlink(tempInput), fs.promises.rm(outDir, { recursive: true, force: true })]);
        running -= 1; activeUsers.delete(req.user.id);
      });
    } catch (failure) {
      if (chargeId) {
        try { await refund(req.user.id, chargeId, tool.points); } catch (e) { console.error('Audio Lab refund failed:', e.message); }
      }
      if (failure.statusCode >= 500 || !failure.statusCode) console.error('Audio Lab failed:', failure);
      res.status(failure.statusCode || 500).json({ error: failure.statusCode ? failure.message : 'Audio Lab could not process the file.' });
    } finally {
      if (!delivered) {
        await Promise.allSettled([fs.promises.unlink(tempInput), fs.promises.rm(outDir, { recursive: true, force: true })]);
        running -= 1; activeUsers.delete(req.user.id);
      }
    }
  });
});
module.exports = router;
