#!/usr/bin/env node
'use strict';
// EditVault CC Studio V3. Surgical installer: preserves other features and creates backups.
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const marker = 'EDITVAULT_CC_STUDIO_V3';
const paths = {
  ui: 'client/src/EditLabRewards.jsx',
  css: 'client/src/editlab-rewards.css',
  api: 'server/src/routes/editlab.js',
  main: 'client/src/main.jsx',
  sections: 'client/src/MarketplaceSections.jsx',
};
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing ${rel}. Run this command from the main edit-marketplace folder.`);
  return fs.readFileSync(full, 'utf8').replace(/\r\n/g,'\n');
}
function replaceExactly(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}. No project files were changed.`);
  return source.replace(before,after);
}
function reExactly(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
  if (matches.length !== 1) throw new Error(`${label}: expected 1 match, found ${matches.length}. No project files were changed.`);
  return source.replace(pattern,replacement);
}
try {
  const originals = Object.fromEntries(Object.entries(paths).map(([key,rel])=>[key,read(rel)]));
  const changed = { ...originals };
  if (originals.ui.includes(marker) && originals.api.includes(marker)) {
    console.log('CC Studio V3 already installed. No changes needed.');
    process.exit(0);
  }
  if (originals.ui.includes(marker) !== originals.api.includes(marker)) throw new Error('Partial previous install detected. No changes made.');
  if (!originals.ui.includes("body.append('preset', presetId)")) throw new Error('EditLab is a different version. Refusing to overwrite it.');
  if (!originals.api.includes("const PRESETS = {")) throw new Error('EditLab API presets not found. Refusing to overwrite it.');

  changed.ui = reExactly(changed.ui,
    /const PRESETS = \[([\s\S]*?)\n\];/,
    (whole,body)=>`const PRESETS = [${body}\n  { id: 'pure_quality', group: 'clean', en: 'Pure Quality', ar: 'بيور كواليتي', descEn: 'Crisp, natural detail', descAr: 'حدة ونقاء طبيعي', filter: 'contrast(1.055) saturate(1.065) brightness(1.015)', swatch: 'linear-gradient(135deg,#506978,#d9eff0)' },
  { id: 'soft_clean', group: 'clean', en: 'Soft Clean', ar: 'سوفت كلين', descEn: 'Soft skin-friendly tones', descAr: 'درجات ناعمة للبشرة', filter: 'contrast(.96) brightness(1.035) saturate(.91)', swatch: 'linear-gradient(135deg,#756981,#f1cbd4)' },
  { id: 'bw_classic', group: 'mono', en: 'Black & White', ar: 'أبيض وأسود', descEn: 'Classic monochrome', descAr: 'أبيض وأسود كلاسيك', filter: 'grayscale(1) contrast(1.16)', swatch: 'linear-gradient(135deg,#16181c,#e9e9ea)' },
  { id: 'bw_noir', group: 'mono', en: 'Noir B&W', ar: 'نوار أبيض وأسود', descEn: 'Deep noir contrast', descAr: 'كونتراست قوي سينمائي', filter: 'grayscale(1) contrast(1.38) brightness(.92)', swatch: 'linear-gradient(135deg,#030405,#aeb0b7)' },
  { id: 'bw_film', group: 'mono', en: 'Silver Film', ar: 'فيلم فضي', descEn: 'Soft vintage mono', descAr: 'أسود وأبيض فيلم قديم', filter: 'grayscale(1) contrast(.98) brightness(1.05)', swatch: 'linear-gradient(135deg,#4a4b50,#e9e5dd)' },
  { id: 'teal_orange', group: 'cinema', en: 'Teal & Orange', ar: 'تيل وأورانج', descEn: 'Movie-grade separation', descAr: 'ستايل ألوان الأفلام', filter: 'contrast(1.13) saturate(1.19) hue-rotate(-6deg)', swatch: 'linear-gradient(135deg,#063b4b,#ec9351)' },
  { id: 'night_drive', group: 'cinema', en: 'Night Drive', ar: 'نايت درايف', descEn: 'Cool neon shadows', descAr: 'ظلال نيون باردة', filter: 'contrast(1.21) brightness(.89) saturate(1.22) hue-rotate(10deg)', swatch: 'linear-gradient(135deg,#12113b,#39b2d0)' },
  { id: 'purple_ae', group: 'creative', en: 'Purple Glow', ar: 'بيربل جلو', descEn: 'After Effects-inspired', descAr: 'ستايل مستوحى من افترافكت', filter: 'contrast(1.09) saturate(1.25) hue-rotate(16deg)', swatch: 'linear-gradient(135deg,#2c174d,#d074e3)' },
  { id: 'dreamy', group: 'creative', en: 'Dreamy', ar: 'دريمي', descEn: 'Airy soft highlights', descAr: 'إضاءة ناعمة حالمة', filter: 'contrast(.92) brightness(1.08) saturate(.92)', swatch: 'linear-gradient(135deg,#827db8,#ffcfdb)' },
  { id: 'anime_pop', group: 'creative', en: 'Anime Pop', ar: 'أنمي بوب', descEn: 'Bold vivid colors', descAr: 'ألوان قوية للأنمي', filter: 'contrast(1.14) saturate(1.48) brightness(1.01)', swatch: 'linear-gradient(135deg,#2141c1,#ef55a6)' },
  { id: 'retro_film', group: 'creative', en: 'Retro Film', ar: 'ريترو فيلم', descEn: 'Faded vintage warmth', descAr: 'ألوان فيلم قديم', filter: 'sepia(.24) contrast(.94) saturate(.83) brightness(1.06)', swatch: 'linear-gradient(135deg,#715344,#e9c69c)' },
]; // ${marker}`,
    'CC preset palette');
  changed.ui = replaceExactly(changed.ui,
    "  const [presetId, setPresetId] = useState('cinematic');",
    "  const [presetId, setPresetId] = useState('cinematic');\n  const [ccCategory, setCcCategory] = useState('all');",
    'CC category state');
  changed.ui = reExactly(changed.ui, /(<button[^\n]*setToolTab\('color'\)[^\n]*<small>)([^<]*)(<\/small>)/,
    (_,a,old,b)=>a+'{tx(\'17 looks\', \'١٧ فلتر\')}' + b, 'CC tab counter');
  changed.ui = changed.ui.replace(/\{tx\('6 PRESETS', '٦ فلاتر'\)\}/g,"{tx('17 PRESETS', '١٧ فلتر')}");

  changed.ui = replaceExactly(changed.ui,
    '              <div className="evlr-presets-grid">{PRESETS.map((preset) =>',
    `              <div className="evlr-cc-toolbar"><div className="evlr-cc-categories" role="group" aria-label={tx('Filter color looks', 'تصنيف فلاتر الألوان')}>{[
                { id: 'all', en: 'All looks', ar: 'الكل' }, { id: 'clean', en: 'Clean / Quality', ar: 'جودة ونقاء' },
                { id: 'mono', en: 'B&W', ar: 'أبيض وأسود' }, { id: 'cinema', en: 'Cinematic', ar: 'سينمائي' },
                { id: 'creative', en: 'AE styles', ar: 'ستايلات افترافكت' },
              ].map((category) => <button key={category.id} type="button" className={ccCategory === category.id ? 'is-active' : ''} aria-pressed={ccCategory === category.id} onClick={() => setCcCategory(category.id)}>{isArabic ? category.ar : category.en}</button>)}</div><span className="evlr-cc-count">{PRESETS.filter(preset => ccCategory === 'all' || (preset.group || (['clean'].includes(preset.id) ? 'clean' : ['cinematic','warm','cool','moody'].includes(preset.id) ? 'cinema' : 'creative')) === ccCategory).length} {tx('looks', 'فلاتر')}</span></div>
              <div className="evlr-presets-grid">{PRESETS.filter(preset => ccCategory === 'all' || (preset.group || (['clean'].includes(preset.id) ? 'clean' : ['cinematic','warm','cool','moody'].includes(preset.id) ? 'cinema' : 'creative')) === ccCategory).map((preset) =>`,
    'CC category toolbar');
  changed.ui = replaceExactly(changed.ui,
    '              <div className="evlr-selected-look">',
    `              <div className="evlr-cc-note"><Sparkles size={14}/><span>{tx('Includes clean quality, 3 black-and-white moods and After Effects-inspired creative color looks. Browser preview is approximate; FFmpeg applies the final grading on export. Pure Quality adds subtle sharpening but cannot recover lost detail.', 'فيه بيور كواليتي و٣ ستايلات أبيض وأسود وتدرجات مستوحاة من افترافكت. المعاينة تقريبية، والتصدير النهائي بيتم عبر FFmpeg. بيور كواليتي بيضيف حدة خفيفة لكنه مش بيرجع تفاصيل مفقودة.')}</span></div>
              <div className="evlr-selected-look">`,
    'CC preview notice');
  changed.api = reExactly(changed.api,
    /const PRESETS = \{([\s\S]*?)\n\};/,
    (whole,body)=>`const PRESETS = {${body}\n  pure_quality: 'eq=contrast=1.055:saturation=1.065:brightness=0.012,unsharp=5:5:0.55:5:5:0',
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
}; // ${marker}`,
    'FFmpeg preset whitelist');

  // Clip Assembly: remove its *page and navigation*, keep stored DB history/routes intact.
  changed.main = changed.main.replace(/^.*'clip-assembly': '\/clip-assembly',\s*\n/m,'');
  changed.main = changed.main.replace(/\s*'clip-assembly': 'clip-assembly',\s*/g,' ');
  changed.main = changed.main.replace(/\s*'clip-assembly': 'تجميع المقاطع',\s*/g,' ');
  changed.main = changed.main.replace(/\s*'clip-assembly': 'Clip Assembly',\s*/g,' ');
  changed.main = changed.main.replace(/^.*<a[^\n]*href="#clip-assembly"[^\n]*<\/a>\s*\n/gm,'');
  if (changed.sections.includes('<section className="evx-section evx-clip-assembly"')) {
    changed.sections = reExactly(changed.sections,
      /      <section className="evx-section evx-clip-assembly"[\s\S]*?      <\/section>(?=\s*<\/div>\s*\);)/,
      '', 'Clip Assembly page removal');
  }
  if (changed.main.includes('href="#clip-assembly"') || changed.sections.includes('evx-clip-assembly"')) {
    throw new Error('Clip Assembly markup could not be fully removed. No files changed.');
  }
  changed.css += `\n
/* EDITVAULT_CC_STUDIO_V3 — palette/category controls (scoped) */
.evlr-root .evlr-cc-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:7px 0 15px;flex-wrap:wrap}
.evlr-root .evlr-cc-categories{display:flex;gap:7px;flex-wrap:wrap}
.evlr-root .evlr-cc-categories button{border:1px solid rgba(255,255,255,.13);color:#bac0cc;background:#11141d;padding:9px 12px;border-radius:999px;font-size:10px;font-weight:800;transition:all .18s ease}
.evlr-root .evlr-cc-categories button.is-active,.evlr-root .evlr-cc-categories button[aria-pressed="true"]{background:rgba(198,255,77,.11);color:#c6ff4d;border-color:rgba(198,255,77,.54)}
.evlr-root .evlr-cc-categories button:hover{border-color:rgba(198,255,77,.4)}
.evlr-root .evlr-cc-count{font:10px 'DM Mono',monospace;color:#929aa9;white-space:nowrap}
.evlr-root .evlr-presets-grid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:11px}
.evlr-root .evlr-preset{min-height:68px;padding:9px 10px;border-radius:14px;background:linear-gradient(145deg,#191d28,#101219);border:1px solid rgba(255,255,255,.11)}
.evlr-root .evlr-preset.is-selected{border-color:#c6ff4d;background:linear-gradient(135deg,rgba(198,255,77,.10),rgba(16,18,26,.97));box-shadow:0 0 0 1px rgba(198,255,77,.13),0 10px 25px rgba(0,0,0,.14)}
.evlr-root .evlr-preset:hover{border-color:rgba(198,255,77,.45)}
.evlr-root .evlr-preset-swatch{width:44px;height:46px;border-radius:10px}
.evlr-root .evlr-preset-check{color:#c6ff4d}
.evlr-root .evlr-cc-note{display:flex;align-items:flex-start;gap:8px;padding:11px 13px;margin-top:14px;border-radius:12px;border:1px solid rgba(198,255,77,.18);background:rgba(198,255,77,.045);font-size:10px;line-height:1.6;color:#acb4b8}
.evlr-root .evlr-cc-note svg{color:#c6ff4d;flex-shrink:0;margin-top:1px}
@media(max-width:600px){.evlr-root .evlr-presets-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.evlr-root .evlr-cc-categories button{padding:8px 10px}.evlr-root .evlr-preset{gap:6px;padding:7px}.evlr-root .evlr-preset-swatch{width:35px;height:39px}}
@media(prefers-reduced-motion:reduce){.evlr-root .evlr-cc-categories button{transition:none}}
\n`;
  const affected = Object.keys(paths).filter(key => changed[key] !== originals[key]);
  const backup = path.join(root,'backups',`before-cc-studio-v3-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  fs.mkdirSync(backup,{recursive:true});
  for (const key of affected) {
    const rel = paths[key];
    const backupFile = path.join(backup,rel);
    fs.mkdirSync(path.dirname(backupFile),{recursive:true});
    fs.copyFileSync(path.join(root,rel),backupFile);
  }
  for (const key of affected) {
    const full = path.join(root,paths[key]);
    fs.writeFileSync(full,changed[key],'utf8');
    console.log('Updated:',paths[key]);
  }
  console.log('SUCCESS: 17 CC looks + category filters + Clip Assembly hidden.');
  console.log('Backup:',backup);
  console.log('No database migration required. Restart client + server.');
} catch (error) {
  console.error('Upgrade stopped:',error.message);
  process.exitCode = 1;
}
