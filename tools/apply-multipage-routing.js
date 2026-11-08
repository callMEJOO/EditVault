'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const cssPath = path.join(root, 'client', 'src', 'multipage-routing.css');
const redirectPath = path.join(root, 'client', 'public', '_redirects');

if (!fs.existsSync(mainPath)) {
  console.error('client/src/main.jsx was not found. Run this script from the EditVault project root.');
  process.exit(1);
}

let main = fs.readFileSync(mainPath, 'utf8');
const original = main;
const required = ["from './MarketplaceSections.jsx'", "from './EditLabRewards.jsx'", '<MarketplaceSections', '<EditLabRewards'];
for (const marker of required) {
  if (!main.includes(marker)) {
    console.error(`Expected existing marketplace marker was not found: ${marker}. No source files were changed.`);
    process.exit(1);
  }
}

if (!main.includes("import './multipage-routing.css';")) {
  const anchor = "import './styles.css';";
  if (!main.includes(anchor)) {
    console.error('Could not find the styles.css import. No source files were changed.');
    process.exit(1);
  }
  main = main.replace(anchor, `${anchor}\nimport './multipage-routing.css';`);
}

const routeConfig = `const EDITVAULT_PAGE_PATHS = {
  home: '/',
  explore: '/explore',
  'scene-packs': '/scene-packs',
  'clip-assembly': '/clip-assembly',
  editlab: '/editlab',
  earn: '/earn',
  accounts: '/accounts',
  creators: '/creators',
  how: '/how',
};

function resolveEditVaultPage(pathname) {
  const cleanPath = String(pathname || '/').replace(/\\/+$/, '') || '/';
  return Object.entries(EDITVAULT_PAGE_PATHS).find(([, route]) => route === cleanPath)?.[0] || 'home';
}

`;
if (!main.includes('const EDITVAULT_PAGE_PATHS = {')) {
  const anchor = 'function App() {';
  if (!main.includes(anchor)) {
    console.error('Could not find App() in main.jsx. No source files were changed.');
    process.exit(1);
  }
  main = main.replace(anchor, routeConfig + anchor);
}

if (!main.includes('const [activePage, setActivePage] = useState')) {
  const anchor = 'function App() {\n  const [category, setCategory] = useState';
  const injected = `function App() {
  const [activePage, setActivePage] = useState(() => resolveEditVaultPage(window.location.pathname));
  const navigateTo = (page) => {
    const nextPage = Object.prototype.hasOwnProperty.call(EDITVAULT_PAGE_PATHS, page) ? page : 'home';
    const nextPath = EDITVAULT_PAGE_PATHS[nextPage];
    if (window.location.pathname !== nextPath) window.history.pushState({ editVaultPage: nextPage }, '', nextPath);
    setActivePage(nextPage);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleAppNavigation = (event) => {
    const anchor = event.target.closest?.('a[href^="#"]');
    if (!anchor) return;
    const sectionToPage = {
      top: 'home', explore: 'explore', 'scene-packs': 'scene-packs',
      'clip-assembly': 'clip-assembly', editlab: 'editlab',
      'earn-points': 'earn', premium: 'accounts', creators: 'creators', how: 'how',
    };
    const target = (anchor.getAttribute('href') || '').slice(1);
    const targetPage = sectionToPage[target];
    if (!targetPage) return;
    event.preventDefault();
    navigateTo(targetPage);
  };
  useEffect(() => {
    const syncPageFromUrl = () => {
      setActivePage(resolveEditVaultPage(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', syncPageFromUrl);
    return () => window.removeEventListener('popstate', syncPageFromUrl);
  }, []);
  useEffect(() => {
    const pageLabels = {
      home: 'Home', explore: 'Explore Edits', 'scene-packs': 'Scene Packs',
      'clip-assembly': 'Clip Assembly', editlab: 'EditLab', earn: 'Earn Points',
      accounts: 'Accounts', creators: 'Creators', how: 'How It Works',
    };
    document.title = \`EditVault · \${pageLabels[activePage] || 'Home'}\`;
  }, [activePage]);
  const [category, setCategory] = useState`;
  if (!main.includes(anchor)) {
    console.error('Could not find the App() state anchor. No source files were changed.');
    process.exit(1);
  }
  main = main.replace(anchor, injected);
}

const appShell = '<div className="app-shell" dir={language === \'ar\' ? \'rtl\' : \'ltr\'} data-language={language}>';
const routedShell = '<div className="app-shell" dir={language === \'ar\' ? \'rtl\' : \'ltr\'} data-language={language} data-page={activePage} onClick={handleAppNavigation}>';
if (!main.includes('data-page={activePage}')) {
  if (!main.includes(appShell)) {
    console.error('Could not find the app-shell opening element. No source files were changed.');
    process.exit(1);
  }
  main = main.replace(appShell, routedShell);
}

const navRegex = /        <nav className=\{mobileNav \? 'nav open' : 'nav'\} aria-label="Marketplace navigation">[\s\S]*?        <\/nav>/;
const navReplacement = `        <nav className={mobileNav ? 'nav open' : 'nav'} aria-label="Marketplace navigation">
          <a className={activePage === 'explore' ? 'nav-active' : ''} href="#explore" onClick={() => setMobileNav(false)}>Explore</a>
          <a className={activePage === 'scene-packs' ? 'nav-active' : ''} href="#scene-packs" onClick={() => setMobileNav(false)}>Scene Packs</a>
          <a className={activePage === 'editlab' ? 'nav-active' : ''} href="#editlab" onClick={() => setMobileNav(false)}>EditLab</a>
          <a className={activePage === 'earn' ? 'nav-active' : ''} href="#earn-points" onClick={() => setMobileNav(false)}>Earn Points</a>
          <a className={activePage === 'accounts' ? 'nav-active' : ''} href="#premium" onClick={() => setMobileNav(false)}>Accounts</a>
          <a className={activePage === 'clip-assembly' ? 'nav-active' : ''} href="#clip-assembly" onClick={() => setMobileNav(false)}>Clip Assembly</a>
          <a className={activePage === 'creators' ? 'nav-active' : ''} href="#creators" onClick={() => setMobileNav(false)}>Creators</a>
          <a className={activePage === 'how' ? 'nav-active' : ''} href="#how" onClick={() => setMobileNav(false)}>How it works</a>
        </nav>`;
const navMatch = main.match(navRegex);
if (navMatch) {
  main = main.replace(navRegex, navReplacement);
} else if (!main.includes("activePage === 'scene-packs'")) {
  console.error('Could not safely find the navigation block. No source files were changed.');
  process.exit(1);
}

const css = `/* EditVault routed-page layout. The existing components are preserved and only the selected page is shown. */
.app-shell[data-page]:not([data-page="home"]) > .hero,
.app-shell[data-page]:not([data-page="home"]) > .stats-row { display: none !important; }
.app-shell[data-page]:not([data-page="explore"]) > .market-section { display: none !important; }
.app-shell[data-page]:not([data-page="scene-packs"]):not([data-page="clip-assembly"]) .evx-marketplace-sections { display: none !important; }
.app-shell[data-page="scene-packs"] .evx-clip-assembly { display: none !important; }
.app-shell[data-page="clip-assembly"] .evx-scene-packs { display: none !important; }
.app-shell[data-page]:not([data-page="editlab"]):not([data-page="earn"]) .evlr-root { display: none !important; }
.app-shell[data-page="editlab"] .evlr-rewards { display: none !important; }
.app-shell[data-page="earn"] .evlr-editlab { display: none !important; }
.app-shell[data-page]:not([data-page="accounts"]) > .premium-section { display: none !important; }
.app-shell[data-page]:not([data-page="creators"]) > .creator-banner { display: none !important; }
.app-shell[data-page]:not([data-page="how"]) > .how-section { display: none !important; }

/* Give each route a small, consistent page-enter transition without changing its layout. */
.app-shell[data-page] > .hero,
.app-shell[data-page] > .market-section,
.app-shell[data-page] > .stats-row,
.app-shell[data-page] > .premium-section,
.app-shell[data-page] > .creator-banner,
.app-shell[data-page] > .how-section,
.app-shell[data-page] .evx-section,
.app-shell[data-page] .evlr-section { animation: evRouteEnter .26s ease both; }
@keyframes evRouteEnter { from { opacity: .65; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }

.app-shell[data-page="home"] > .hero { padding-top: clamp(32px, 5vw, 65px); }
.app-shell[data-page="creators"] > .creator-banner { margin-top: clamp(30px, 6vw, 82px); margin-bottom: clamp(50px, 8vw, 120px); }
.app-shell[data-page="how"] > .how-section { padding-top: clamp(36px, 5vw, 72px); padding-bottom: clamp(50px, 8vw, 110px); }
@media (prefers-reduced-motion: reduce) { .app-shell[data-page] > .hero, .app-shell[data-page] > .market-section, .app-shell[data-page] > .stats-row, .app-shell[data-page] > .premium-section, .app-shell[data-page] > .creator-banner, .app-shell[data-page] > .how-section, .app-shell[data-page] .evx-section, .app-shell[data-page] .evlr-section { animation: none !important; } }
`;

// All preflight validation is complete. Back up the changed source before applying.
if (main !== original) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(mainPath, `${mainPath}.pre-multipage-${stamp}.bak`);
  fs.writeFileSync(mainPath, main, 'utf8');
}
fs.writeFileSync(cssPath, css, 'utf8');
fs.mkdirSync(path.dirname(redirectPath), { recursive: true });
fs.writeFileSync(redirectPath, '/*  /index.html  200\n', 'utf8');

console.log('EditVault pages enabled: Home, Explore, Scene Packs, Clip Assembly, EditLab, Earn Points, Accounts, Creators, and How it works.');
console.log('Direct URLs and browser Back/Forward are supported. A main.jsx backup was created if it changed.');
console.log('For Render static hosting, client/public/_redirects enables direct-route reloads.');
