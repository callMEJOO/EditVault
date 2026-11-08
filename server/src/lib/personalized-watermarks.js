'use strict';
// Personalized video copies are optional buyer-specific exports; protected originals are never altered.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const STYLES = new Set(['corner', 'signature', 'neon', 'repeated']);

function normalizeWatermark(value) {
  if (value === undefined || value === null || value === false) return { name: null, style: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid watermark options.');
  if (typeof value.name !== 'string' || typeof value.style !== 'string') throw new Error('Choose a watermark name and style.');
  const name = value.name.normalize('NFC').trim();
  if (!name || [...name].length > 30 || /[\u0000-\u001f\u007f\u2028\u2029]/u.test(name)) {
    throw new Error('Watermark name must be 1–30 characters on one line.');
  }
  if (!STYLES.has(value.style)) throw new Error('Unknown watermark style.');
  return { name, style: value.style };
}

function escapeFilterPath(value) {
  // ffmpeg's filtergraph parser needs the colon of Windows drive letters escaped twice.
  return String(value).replace(/\\/g, '/').replace(/:/g, '\\\\:').replace(/'/g, "\\\\'").replace(/,/g, '\\\\,').replace(/\[/g, '\\\\[').replace(/\]/g, '\\\\]');
}

function chooseFont() {
  const options = [
    process.env.WATERMARK_FONT_PATH,
    process.platform === 'win32' ? 'C:\\Windows\\Fonts\\arial.ttf' : '',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
  ].filter(Boolean);
  const result = options.find((file) => fs.existsSync(file));
  if (!result) throw new Error('Watermark font not found; configure WATERMARK_FONT_PATH.');
  return result;
}

function buildFilters(style, font, textfile) {
  const common = `fontfile='${escapeFilterPath(font)}':textfile='${escapeFilterPath(textfile)}':expansion=none`;
  const f = (params) => `drawtext=${common}:${params}`;
  if (style === 'corner') {
    return f('fontsize=h/28:fontcolor=white@0.90:borderw=2:bordercolor=black@0.65:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=w-text_w-w/35:y=h-text_h-h/30');
  }
  if (style === 'signature') {
    return f('fontsize=h/19:fontcolor=white@0.95:box=1:boxcolor=black@0.33:boxborderw=12:x=(w-text_w)/2:y=h-text_h-h/12');
  }
  if (style === 'neon') {
    return f('fontsize=h/12:fontcolor=0xC6FF4D@0.95:borderw=3:bordercolor=black@0.9:shadowcolor=0xA1FF16@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=(h-text_h)/2');
  }
  if (style === 'repeated') {
    const base = 'fontsize=h/23:fontcolor=white@0.45:borderw=2:bordercolor=black@0.35';
    return [
      f(`${base}:x=w/10:y=h/7`),
      f(`${base}:x=w/2:y=h/2`),
      f(`${base}:x=w/6:y=h-h/5`),
      f(`${base}:x=w-w/5-text_w:y=h/5`),
    ].join(',');
  }
  throw new Error('Unsupported watermark style.');
}

async function renderPersonalizedVideo({ sourcePath, name, style }) {
  const options = normalizeWatermark({ name, style });
  if (!fs.existsSync(sourcePath)) throw new Error('Original file missing.');
  const sourceStats = await fs.promises.stat(sourcePath);
  if (sourceStats.size > 1024 * 1024 * 1024) throw new Error('Video exceeds the 1 GB personalized export limit.');
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'editvault-personalized-'));
  const textFile = path.join(tmpDir, 'label.txt');
  const outputPath = path.join(tmpDir, 'personalized.mp4');
  try {
    await fs.promises.writeFile(textFile, options.name, { encoding: 'utf8', flag: 'wx' });
    const vf = buildFilters(options.style, chooseFont(), textFile);
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', sourcePath,
      '-map', '0:v:0', '-map', '0:a?', '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
      '-threads', '2', outputPath,
    ], { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 * 3 });
    if (!fs.existsSync(outputPath) || (await fs.promises.stat(outputPath)).size < 100) {
      throw new Error('Personalized export failed to produce a video.');
    }
    return { tmpDir, outputPath };
  } catch (error) {
    await cleanup(tmpDir);
    throw error;
  }
}

async function cleanup(tmpDir) {
  if (tmpDir) await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

module.exports = { normalizeWatermark, renderPersonalizedVideo, cleanup, buildFilters };
