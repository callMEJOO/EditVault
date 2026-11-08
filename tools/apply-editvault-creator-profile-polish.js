'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  main: path.join(root, 'client', 'src', 'main.jsx'),
  styles: path.join(root, 'client', 'src', 'styles.css'),
  profile: path.join(root, 'client', 'src', 'PublicCreatorProfile.jsx'),
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    console.error(`Required file not found: ${path.relative(root, file)}. Run this from the EditVault project root. No files were changed.`);
    process.exit(1);
  }
}

let main = fs.readFileSync(files.main, 'utf8');
let styles = fs.readFileSync(files.styles, 'utf8');
let profile = fs.readFileSync(files.profile, 'utf8');
const original = { main, styles, profile };

// Verify this patch matches the purchase/library version installed earlier.
if (!main.includes('ev-card-review-summary') || !main.includes('ev-card-review-stars')) {
  console.error('The purchase card markup was not found in main.jsx. Apply the purchase/library upgrade first. No files were changed.');
  process.exit(1);
}
if (!profile.includes('public-creator-work-heading') || !profile.includes('profile.display_name')) {
  console.error('PublicCreatorProfile.jsx does not match the expected EditVault profile component. No files were changed.');
  process.exit(1);
}

// Use numeric Unicode code points for stars; this avoids corrupted star glyphs when a file was rewritten with the wrong encoding.
if (!main.includes('String.fromCharCode(9733)')) {
  const starPattern = /<span className="ev-card-review-stars">[\s\S]*?<\/span>/;
  if (!starPattern.test(main)) {
    console.error('Could not safely locate the edit-rating stars. No files were changed.');
    process.exit(1);
  }
  main = main.replace(starPattern,
    '<span className="ev-card-review-stars" aria-label={"Rating " + Number(edit.avgRating || 0).toFixed(1) + " out of 5"}>{String.fromCharCode(9733).repeat(Math.max(0, Math.min(5, Math.round(Number(edit.avgRating || 0)))))}{String.fromCharCode(9734).repeat(5 - Math.max(0, Math.min(5, Math.round(Number(edit.avgRating || 0)))))}</span>');
}

// Clear, localized labels for the review summary and one-of-one sales badge.
const scoreOld = "<span>{edit.ratingCount ? Number(edit.avgRating || 0).toFixed(1) : 'New'}</span>";
const scoreNew = "<span className=\"ev-review-score\">{edit.ratingCount ? Number(edit.avgRating || 0).toFixed(1) : (document.documentElement.dir === 'rtl' ? 'جديد' : 'New')}</span>";
if (main.includes(scoreOld)) main = main.replace(scoreOld, scoreNew);

const countOld = "<span className=\"ev-card-review-count\">{edit.ratingCount ? '(' + edit.ratingCount + ' ratings)' : 'No ratings yet'}</span>";
const countNew = "<span className=\"ev-card-review-count\">{edit.ratingCount ? (document.documentElement.dir === 'rtl' ? '(' + edit.ratingCount + ' تقييم)' : '(' + edit.ratingCount + ' ratings)') : (document.documentElement.dir === 'rtl' ? 'لا توجد تقييمات بعد' : 'No ratings yet')}</span>";
if (main.includes(countOld)) main = main.replace(countOld, countNew);

const soldOld = '<span className="ev-sold-badge">ONE-OF-ONE · SOLD</span>';
const soldNew = '<span className="ev-sold-badge">{document.documentElement.dir === \'rtl\' ? \'مباع — نسخة واحدة\' : \'ONE-OF-ONE · SOLD\'}</span>';
if (main.includes(soldOld)) main = main.replace(soldOld, soldNew);

// Give every card a sane layout at laptop and tablet widths. The review summary is an explicit grid so English words never stack vertically.
const styleMarker = '/* EditVault creator/profile polish — safe to keep after future theme changes. */';
if (!styles.includes(styleMarker)) {
  styles += `\n\n${styleMarker}
.edit-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; }
.edit-grid > .edit-card:only-child { grid-column: 1 / -1; justify-self: center; width: min(100%, 440px); min-width: 0; }
.ev-card-review-summary {
  display: grid !important;
  grid-template-columns: max-content max-content;
  justify-content: start;
  align-items: center;
  gap: 7px 9px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding: 9px 0 10px;
  border-top: 1px solid rgba(255,255,255,.08);
  border-bottom: 1px solid rgba(255,255,255,.08);
  text-align: left;
  direction: ltr;
  unicode-bidi: isolate;
}
.ev-card-review-stars {
  display: inline-flex;
  align-items: center;
  width: max-content;
  max-width: 100%;
  color: #c6ff4d;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.2;
  white-space: nowrap;
  overflow-wrap: normal;
}
.ev-review-score {
  display: inline-flex;
  align-items: center;
  min-height: 21px;
  padding: 3px 7px;
  border: 1px solid rgba(198,255,77,.2);
  border-radius: 999px;
  background: rgba(198,255,77,.07);
  color: #eaf8ca;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  unicode-bidi: isolate;
}
.ev-card-review-count {
  grid-column: 1 / -1;
  display: block;
  min-width: 0;
  max-width: 100%;
  color: #a4a1b0;
  font-size: 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: normal;
  white-space: normal;
  unicode-bidi: plaintext;
}
.ev-sold-badge {
  grid-column: 1 / -1;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  min-height: 24px;
  padding: 5px 8px;
  border: 1px solid rgba(255,111,133,.32);
  border-radius: 7px;
  background: rgba(255,78,105,.09);
  color: #ff9eae;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .25px;
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
  direction: auto;
  unicode-bidi: plaintext;
}

/* Make the creator identity look and behave like a clear profile entry point. */
.creator-profile-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  max-width: 100%;
  padding: 5px 9px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 999px;
  background: rgba(255,255,255,.035);
  color: #e7e4ef;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.3;
  overflow-wrap: anywhere;
  transition: border-color .2s ease, background .2s ease, color .2s ease;
}
.creator-profile-link::after { content: '↗'; color: var(--lime); font-size: 12px; }
.creator-profile-link:hover { border-color: rgba(198,255,77,.35); background: rgba(198,255,77,.06); color: var(--lime); text-decoration: none; }
.creator-profile-link:focus-visible { outline: 2px solid rgba(198,255,77,.7); outline-offset: 3px; }

/* A polished creator profile with visible account context and a dedicated Creator's Edits section. */
.public-creator-page {
  border-color: rgba(198,255,77,.2);
  background: radial-gradient(ellipse at 92% 0%, rgba(198,255,77,.12), transparent 34%), radial-gradient(ellipse at 0% 100%, rgba(101,91,255,.1), transparent 38%), #15151b;
}
.public-creator-header { position: relative; }
.public-creator-avatar {
  border-color: rgba(198,255,77,.52);
  background: linear-gradient(145deg, rgba(198,255,77,.18), rgba(198,255,77,.035));
  box-shadow: 0 0 35px rgba(198,255,77,.1), inset 0 1px rgba(255,255,255,.1);
}
.public-creator-heading h2 { line-height: 1.25; }
.public-creator-verified {
  padding: 5px 8px;
  border: 1px solid rgba(157,223,255,.18);
  border-radius: 999px;
  background: rgba(157,223,255,.055);
}
.public-creator-insights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0 5px;
}
.public-creator-insight {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
  padding: 15px;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.015));
  box-shadow: inset 0 1px rgba(255,255,255,.025);
}
.public-creator-insight > span {
  color: #8c8999;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .8px;
  line-height: 1.5;
  text-transform: uppercase;
}
.public-creator-insight > strong {
  color: #f7f6fc;
  font-size: clamp(15px, 2vw, 22px);
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.public-creator-insight > small {
  color: #a3a0af;
  font-size: 10px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.public-creator-work-heading {
  padding-top: 6px;
}
.public-creator-work-heading .eyebrow { color: var(--lime); }
.public-creator-work-heading h3 { line-height: 1.35; }
.public-creator-grid { align-items: stretch; }
.public-creator-edit { transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
.public-creator-edit:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(0,0,0,.24); }
.public-creator-edit-body > strong { line-height: 1.45; }
@media (max-width: 900px) {
  .edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 740px) {
  .public-creator-insights { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .public-creator-insight:last-child { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .edit-grid { grid-template-columns: minmax(0, 1fr); }
  .edit-card { width: 100%; max-width: 440px; margin-inline: auto; }
  .ev-card-review-summary { gap: 6px 8px; }
  .public-creator-insights { grid-template-columns: minmax(0, 1fr); }
  .public-creator-insight:last-child { grid-column: auto; }
}
`;
}

// Add a compact creator overview using fields already supplied by the public-profile endpoint.
// No new database query or schema change is needed.
if (!profile.includes('public-creator-insights')) {
  const workHeading = '<div className="public-creator-work-heading"><div><div className="eyebrow">ORIGINAL WORK</div><h3>Published edits <span>{edits.length}</span></h3></div></div>';
  if (!profile.includes(workHeading)) {
    console.error('Could not locate the known Creator’s Edits heading in PublicCreatorProfile.jsx. No project files were changed.');
    process.exit(1);
  }
  const overview = `
          <section className="public-creator-insights" aria-label="Creator overview">
            <article className="public-creator-insight">
              <span>{document.documentElement.dir === 'rtl' ? 'حالة الحساب' : 'PROFILE STATUS'}</span>
              <strong>{profile.is_verified ? (document.documentElement.dir === 'rtl' ? 'مبدع موثّق' : 'Verified creator') : (document.documentElement.dir === 'rtl' ? 'مبدع' : 'Creator')}</strong>
              <small>{profile.is_verified ? (document.documentElement.dir === 'rtl' ? 'تم توثيق الحساب على EditVault' : 'Verified on EditVault') : (document.documentElement.dir === 'rtl' ? 'الملف العام للمبدع' : 'Public creator profile')}</small>
            </article>
            <article className="public-creator-insight">
              <span>{document.documentElement.dir === 'rtl' ? 'الإيديتات المنشورة' : 'PUBLISHED EDITS'}</span>
              <strong>{edits.length.toLocaleString()}</strong>
              <small>{document.documentElement.dir === 'rtl' ? 'إيديتات من هذا المبدع' : 'Original edits from this creator'}</small>
            </article>
            <article className="public-creator-insight">
              <span>{document.documentElement.dir === 'rtl' ? 'متابعو تيك توك' : 'TIKTOK FOLLOWERS'}</span>
              <strong>{profile.tiktok_followers_updated_at ? Number(profile.tiktok_followers || 0).toLocaleString() : '—'}</strong>
              <small>{profile.tiktok_followers_updated_at ? (document.documentElement.dir === 'rtl' ? 'بيانات الملف العام' : 'Public profile data') : (document.documentElement.dir === 'rtl' ? 'لم تتم المزامنة بعد' : 'Not synced yet')}</small>
            </article>
          </section>
          <div className="public-creator-work-heading"><div><div className="eyebrow">{document.documentElement.dir === 'rtl' ? 'أعمال أصلية' : 'ORIGINAL WORK'}</div><h3>{document.documentElement.dir === 'rtl' ? 'إيديتات المبدع' : "Creator’s edits"} <span>{edits.length}</span></h3></div></div>`;
  profile = profile.replace(workHeading, overview);
} else {
  profile = profile.replace(
    '<h3>Published edits <span>{edits.length}</span></h3>',
    '<h3>{document.documentElement.dir === \'rtl\' ? \'إيديتات المبدع\' : "Creator’s edits"} <span>{edits.length}</span></h3>'
  );
}

const changed = [];
if (main !== original.main) changed.push(['main', files.main, main]);
if (styles !== original.styles) changed.push(['styles', files.styles, styles]);
if (profile !== original.profile) changed.push(['profile', files.profile, profile]);
if (!changed.length) {
  console.log('Creator/profile UI polish is already applied. No files needed changes.');
  process.exit(0);
}

// Back up every changed source before writing any file.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
for (const [key, file] of changed) {
  const backup = `${file}.pre-creator-profile-polish-${stamp}.bak`;
  fs.copyFileSync(file, backup);
}
for (const [key, file, value] of changed) {
  fs.writeFileSync(file, value, 'utf8');
  console.log(`Updated ${path.relative(root, file)}`);
}
console.log('Edit-card readability and creator-profile polish applied. Backups were created. Restart Vite if the browser does not hot-reload.');
