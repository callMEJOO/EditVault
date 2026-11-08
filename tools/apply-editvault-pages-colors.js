'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const cssPath = path.join(root, 'client', 'src', 'editvault-page-layout.css');

if (!fs.existsSync(mainPath)) {
  console.error('client/src/main.jsx was not found. Extract this update into the EditVault project root and run it there.');
  process.exit(1);
}

let main = fs.readFileSync(mainPath, 'utf8');
const originalMain = main;

// Fix the startup crash introduced when the page-title effect was placed above
// the language state declaration. React runs hook arguments during render, so
// the dependency array cannot reference `language` before it is initialized.
const effectMarker = 'const pageLabels = language === \'ar\' ? {';
const effectMarkerAt = main.indexOf(effectMarker);
if (effectMarkerAt !== -1) {
  const languageDeclaration = "const [language, setLanguage] = useState(() => localStorage.getItem('editvault_language') || 'en');";
  const txDeclaration = "const tx = (en, ar) => language === 'ar' ? ar : en;";
  const languageAt = main.indexOf(languageDeclaration);
  const txAt = main.indexOf(txDeclaration);
  const effectStart = main.lastIndexOf('  useEffect(() => {', effectMarkerAt);
  const effectEndMarker = '  }, [activePage, language]);';
  const effectEndAt = main.indexOf(effectEndMarker, effectMarkerAt);

  if (languageAt === -1 || txAt === -1 || effectStart === -1 || effectEndAt === -1) {
    console.error('Could not safely locate the language state and page-title effect. No files were changed.');
    process.exit(1);
  }

  const effectEnd = effectEndAt + effectEndMarker.length;
  if (effectStart < languageAt) {
    const effectBlock = main.slice(effectStart, effectEnd).trimEnd();
    main = main.slice(0, effectStart) + main.slice(effectEnd);
    const refreshedTxAt = main.indexOf(txDeclaration);
    if (refreshedTxAt === -1) {
      console.error('Could not locate the language helper after preparing the fix. No files were changed.');
      process.exit(1);
    }
    const insertAt = refreshedTxAt + txDeclaration.length;
    main = main.slice(0, insertAt) + '\n\n  ' + effectBlock.trimStart() + '\n' + main.slice(insertAt);
  }
}

// Ensure the new layout stylesheet is loaded after the existing styling layers.
const importLine = "import './editvault-page-layout.css';";
if (!main.includes(importLine)) {
  const candidateAnchors = [
    "import './consumer-arabic-ui.css';",
    "import './multipage-routing.css';",
    "import './styles.css';",
  ];
  const anchor = candidateAnchors.find((value) => main.includes(value));
  if (!anchor) {
    console.error('Could not find an existing stylesheet import in main.jsx. No files were changed.');
    process.exit(1);
  }
  main = main.replace(anchor, `${anchor}\n${importLine}`);
}

// Route state and app shell must already be installed by the multipage update.
const routeMarkers = [
  'const EDITVAULT_PAGE_PATHS = {',
  'data-page={activePage}',
  "activePage === 'scene-packs'",
];
for (const marker of routeMarkers) {
  if (!main.includes(marker)) {
    console.error(`Expected multipage routing marker was not found: ${marker}. No source files were changed.`);
    process.exit(1);
  }
}

const css = String.raw`/* EditVault page isolation + visual system refresh. Loaded last to correct old route selectors. */
:root {
  --ev-accent: #c6ff4d;
  --ev-accent-soft: rgba(198, 255, 77, .12);
  --ev-violet: #a78bfa;
  --ev-cyan: #66d9ef;
  --ev-surface: #17171f;
  --ev-border: rgba(255,255,255,.10);
}

.app-shell[data-page] { min-height: 100dvh; }
.app-shell[data-page] main#top { min-width: 0; }

/* Only the selected route is visible. Main sections are children of <main>, not .app-shell. */
.app-shell[data-page]:not([data-page="home"]) main#top > .hero,
.app-shell[data-page]:not([data-page="home"]) main#top > .stats-row,
.app-shell[data-page]:not([data-page="explore"]) main#top > .market-section,
.app-shell[data-page]:not([data-page="scene-packs"]) main#top .evx-marketplace-sections > .evx-scene-packs,
.app-shell[data-page]:not([data-page="clip-assembly"]) main#top .evx-marketplace-sections > .evx-clip-assembly,
.app-shell[data-page]:not([data-page="editlab"]):not([data-page="earn"]) main#top > .evlr-root,
.app-shell[data-page="editlab"] main#top .evlr-root > .evlr-rewards,
.app-shell[data-page="earn"] main#top .evlr-root > .evlr-editlab,
.app-shell[data-page]:not([data-page="accounts"]) main#top > .premium-section,
.app-shell[data-page]:not([data-page="creators"]) main#top > .creator-banner,
.app-shell[data-page]:not([data-page="how"]) main#top > .how-section {
  display: none !important;
}

/* Each page gets a consistent content width, spacing and entrance animation. */
.app-shell[data-page] main#top > .hero,
.app-shell[data-page] main#top > .stats-row,
.app-shell[data-page] main#top > .market-section,
.app-shell[data-page] main#top > .premium-section,
.app-shell[data-page] main#top > .creator-banner,
.app-shell[data-page] main#top > .how-section,
.app-shell[data-page] main#top .evx-marketplace-sections > .evx-section,
.app-shell[data-page] main#top > .evlr-root > .evlr-section {
  animation: evPageEnter .34s cubic-bezier(.2,.75,.25,1) both;
}

@keyframes evPageEnter {
  from { opacity: 0; transform: translate3d(0, 12px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

/* A quiet color hierarchy: lime for actions, violet/cyan for supporting accents. */
.app-shell[data-page] .nav a {
  border-radius: 8px;
  transition: color .18s ease, background .18s ease, transform .18s ease;
}
.app-shell[data-page] .nav a:hover,
.app-shell[data-page] .nav a.nav-active {
  color: #fff;
  background: rgba(198,255,77,.075);
}
.app-shell[data-page] .nav a.nav-active { box-shadow: inset 0 -2px 0 var(--ev-accent); }
.app-shell[data-page] :is(.primary-cta, .secondary-cta, .signup-btn, .login-btn, .buy-btn, .evx-action-btn, .evlr-export-btn, .evlr-refresh-btn) {
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease, color .18s ease;
}
.app-shell[data-page] :is(.primary-cta, .signup-btn, .buy-btn, .evx-action-btn, .evlr-export-btn):hover:not(:disabled) {
  box-shadow: 0 8px 28px rgba(198,255,77,.10);
}
.app-shell[data-page] :is(.edit-card, .premium-card, .evx-pack-card, .evlr-editor-card, .evlr-side-card, .evlr-referral-card, .evlr-task-card) {
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}
.app-shell[data-page] :is(.edit-card, .premium-card, .evx-pack-card, .evlr-editor-card, .evlr-side-card, .evlr-referral-card, .evlr-task-card):hover {
  border-color: rgba(198,255,77,.26);
}
.app-shell[data-page] :is(input, textarea, select):focus-visible {
  outline: 2px solid rgba(198,255,77,.8);
  outline-offset: 2px;
}
.app-shell[data-page] :is(.market-section, .premium-section, .how-section, .creator-banner, .evx-section, .evlr-section) { scroll-margin-top: 88px; }
.app-shell[data-page="home"] main#top > .hero { padding-top: clamp(34px, 5.5vw, 74px); }
.app-shell[data-page="explore"] main#top > .market-section,
.app-shell[data-page="accounts"] main#top > .premium-section,
.app-shell[data-page="how"] main#top > .how-section { padding-top: clamp(34px, 5vw, 68px); }
.app-shell[data-page="creators"] main#top > .creator-banner { margin-top: clamp(34px, 6vw, 84px); margin-bottom: clamp(48px, 8vw, 100px); }
.app-shell[data-page="scene-packs"] .evx-section,
.app-shell[data-page="clip-assembly"] .evx-section,
.app-shell[data-page="editlab"] .evlr-section,
.app-shell[data-page="earn"] .evlr-section { margin-block: clamp(28px, 5vw, 64px); }

/* Arabic typography and bidirectional layout. */
.app-shell[data-language="ar"] { font-family: "Cairo", Tahoma, sans-serif; letter-spacing: 0; line-height: 1.75; }
.app-shell[data-language="ar"] :is(h1,h2,h3,h4,p,label,button,a,input,textarea,select,small,span) { letter-spacing: 0; }
.app-shell[data-language="ar"] :is(.hero h1,.section-heading h2,.premium-heading h2,.creator-banner h2,.how-section h2,.evx-section h2,.evlr-heading h2) {
  line-height: 1.5;
  text-wrap: balance;
}
.app-shell[data-language="ar"] .eyebrow { font-family: "Cairo", Tahoma, sans-serif; letter-spacing: 0; line-height: 1.8; }
.app-shell[data-language="ar"] :is(.nav, .top-actions, .hero-buttons, .market-controls, .category-tabs, .card-footer, .premium-card-footer) { direction: rtl; }
.app-shell[dir="rtl"] .lucide-arrow-up-right { transform: scaleX(-1); }

/* Responsive navigation and cards. */
@media (max-width: 820px) {
  .app-shell[data-page] { padding-inline: clamp(14px, 3.5vw, 26px); }
  .app-shell[data-page] .topbar { gap: 12px; }
  .app-shell[data-page] .nav.open { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
  .app-shell[data-page] .nav.open a { min-height: 42px; display: flex; align-items: center; padding: 10px 12px; border: 1px solid rgba(255,255,255,.075); background: rgba(255,255,255,.025); }
  .app-shell[data-page] .nav.open a.nav-active { border-color: rgba(198,255,77,.30); background: rgba(198,255,77,.075); }
  .app-shell[data-page] .account-identity-copy { display: none; }
  .app-shell[data-page] .account-identity { padding: 4px; }
  .app-shell[data-page] .edit-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 520px) {
  .app-shell[data-page] { padding-inline: 14px; }
  .app-shell[data-page] .topbar { min-height: 66px; }
  .app-shell[data-page] .brand { min-width: 0; }
  .app-shell[data-page] .top-actions { gap: 6px; }
  .app-shell[data-page] .points-pill { padding: 8px 9px; }
  .app-shell[data-page] .account-identity-copy,
  .app-shell[data-page] .settings-access-btn { display: none; }
  .app-shell[data-page] .edit-grid,
  .app-shell[data-page] .premium-grid { grid-template-columns: minmax(0,1fr); }
  .app-shell[data-page] .edit-cover { aspect-ratio: 16 / 9; }
  .app-shell[data-page] :is(.market-section,.premium-section,.how-section) { padding-block: 34px; }
  .app-shell[data-page] .evx-section,
  .app-shell[data-page] .evlr-section { padding-inline: 0; }
  .app-shell[data-page] :is(.creator-banner,.premium-order,.evx-request-card) { align-items: stretch; }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell[data-page] *, .app-shell[data-page] *::before, .app-shell[data-page] *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
`;

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
if (main !== originalMain) fs.copyFileSync(mainPath, `${mainPath}.pre-pages-colors-${stamp}.bak`);
if (fs.existsSync(cssPath)) fs.copyFileSync(cssPath, `${cssPath}.pre-pages-colors-${stamp}.bak`);
fs.writeFileSync(mainPath, main, 'utf8');
fs.writeFileSync(cssPath, css, 'utf8');

console.log('EditVault page layout and colors applied.');
console.log('Pages are isolated: Home, Explore, Scene Packs, Clip Assembly, EditLab, Earn Points, Accounts, Creators, How It Works.');
console.log('The page-title effect order was checked and corrected if needed; backups were saved next to changed files.');
