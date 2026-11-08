'use strict';
const { normalizeWatermark } = require('./personalized-watermarks');
function normalizePaidWatermark(raw) {
  if (raw === null || raw === undefined || raw === false) return { mode: null, name: null, style: null, brief: null };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid watermark customization.');
  if (raw.mode === 'manual') {
    if (typeof raw.name !== 'string') throw new Error('Enter a name for the manual customization.');
    const name = raw.name.normalize('NFC').trim();
    if (!name || [...name].length > 30 || /[\u0000-\u001f\u007f\u2028\u2029]/u.test(name)) throw new Error('Name must be 1–30 characters on one line.');
    if (raw.brief !== undefined && typeof raw.brief !== 'string') throw new Error('Manual instructions must be text.');
    const brief = (raw.brief || '').trim();
    if (brief.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(brief)) throw new Error('Instructions must be 500 characters or less.');
    return { mode: 'manual', name, style: null, brief };
  }
  if (raw.mode !== undefined && raw.mode !== 'auto') throw new Error('Unknown customization type.');
  const auto = normalizeWatermark(raw);
  if (!auto.name) throw new Error('Choose a name and style.');
  return { mode: 'auto', name: auto.name, style: auto.style, brief: null };
}
module.exports = { normalizePaidWatermark };
