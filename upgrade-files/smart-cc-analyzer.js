/**
 * EDITVAULT_SMART_CC_LOCAL_V1
 * Browser-only color analysis. No model, API, API key, account, or network request.
 * Samples up to three decoded video frames on the user's device.
 */
function awaitVideoEvent(video, eventName, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Your browser could not decode this video. Try MP4 / H.264.')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Video decoding timed out. Try a shorter MP4 video.')); }, timeoutMs);
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function analyzeFrame(context, video) {
  context.drawImage(video, 0, 0, 160, 90);
  const data = context.getImageData(0, 0, 160, 90).data;
  let luminance = 0, lumSquared = 0, saturation = 0, warmth = 0, count = 0;
  for (let i = 0; i < data.length; i += 16) { // sample every fourth pixel
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b);
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    const sat = hi ? (hi - lo) / hi : 0;
    luminance += lum;
    lumSquared += lum * lum;
    saturation += sat;
    warmth += r - b;
    count++;
  }
  const avg = luminance / count;
  return {
    brightness: avg,
    contrast: Math.sqrt(Math.max(0, lumSquared / count - avg * avg)),
    saturation: saturation / count,
    warmth: warmth / count,
  };
}

export async function analyzeVideoColor(file) {
  if (!file) throw new Error('Choose a video first.');
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) { URL.revokeObjectURL(url); throw new Error('Canvas processing is unavailable on this device.'); }
  try {
    const ready = awaitVideoEvent(video, 'loadeddata', 14000);
    video.src = url;
    video.load();
    await ready;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const frames = [];
    const positions = duration > 2 ? [0.18, 0.5, 0.8] : [0];
    for (const part of positions) {
      try {
        if (duration > 2) {
          const t = Math.min(Math.max(0.15, duration * part), duration - 0.08);
          if (Math.abs(video.currentTime - t) > 0.08) {
            const seeked = awaitVideoEvent(video, 'seeked', 3500);
            video.currentTime = t;
            await seeked;
          }
        }
        frames.push(analyzeFrame(ctx, video));
      } catch (error) {
        if (!frames.length && positions.length === 1) throw error;
        // Some mobile browsers refuse seeking in particular codecs: fall back to available frame.
      }
    }
    if (!frames.length) frames.push(analyzeFrame(ctx, video));
    const metric = (name) => frames.reduce((sum, frame) => sum + frame[name], 0) / frames.length;
    const brightness = metric('brightness');
    const contrast = metric('contrast');
    const saturation = metric('saturation');
    const warmth = metric('warmth');
    let presetId = 'pure_quality';
    let reasonEn = 'Balanced lighting and color: a subtle clean look will preserve detail.';
    let reasonAr = 'الإضاءة والألوان متوازنة، ففلتر ناعم هيحافظ على تفاصيل الفيديو.';
    if (brightness < 79) {
      presetId = 'soft_clean';
      reasonEn = 'The scene looks dark; a lighter, softer grade should help.';
      reasonAr = 'الفيديو غامق نسبيًا، فالأفضل CC ناعم يفتح الإضاءة شوية.';
    } else if (brightness > 190) {
      presetId = 'moody';
      reasonEn = 'Highlights are bright; a moodier grade can hold them back.';
      reasonAr = 'الإضاءة عالية، فستايل أغمق شوية ممكن يوازن الصورة.';
    } else if (saturation < 0.12) {
      presetId = 'bw_classic';
      reasonEn = 'The source has little color: a clean black-and-white look fits it.';
      reasonAr = 'ألوان الفيديو قليلة، فالأبيض والأسود هيليق عليه.';
    } else if (saturation > 0.49) {
      presetId = 'soft_clean';
      reasonEn = 'Colors are already vivid; a gentle look avoids oversaturation.';
      reasonAr = 'الألوان قوية أصلًا، فستايل هادي هيمنع التشبع الزيادة.';
    } else if (contrast < 33) {
      presetId = 'cinematic';
      reasonEn = 'Contrast is relatively low; a cinematic grade adds depth.';
      reasonAr = 'التباين قليل نسبيًا، فالسينمائي هيزود العمق.';
    } else if (warmth < -15) {
      presetId = 'warm';
      reasonEn = 'Cool blue tones dominate; warm grading can balance the scene.';
      reasonAr = 'الألوان باردة ومائلة للأزرق، فالستايل الدافئ ممكن يوازنها.';
    }
    return {
      presetId, reasonEn, reasonAr, frames: frames.length,
      brightness: Math.round(brightness),
      contrast: Math.round(contrast),
      saturation: Math.round(saturation * 100),
    };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
