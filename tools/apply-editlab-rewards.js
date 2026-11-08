'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = {
  main: path.join(root, 'client', 'src', 'main.jsx'),
  index: path.join(root, 'server', 'src', 'index.js'),
  auth: path.join(root, 'server', 'src', 'routes', 'auth.js'),
};
const requiredFiles = [
  path.join(root, 'client', 'src', 'EditLabRewards.jsx'),
  path.join(root, 'client', 'src', 'editlab-rewards.css'),
  path.join(root, 'server', 'src', 'routes', 'editlab.js'),
  path.join(root, 'server', 'src', 'routes', 'rewards.js'),
  path.join(root, 'server', 'src', 'db', 'apply-editlab-rewards.js'),
];

for (const file of [...Object.values(targets), ...requiredFiles]) {
  if (!fs.existsSync(file)) {
    console.error(`Required file not found: ${path.relative(root, file)}. Extract the upgrade into the project root and run this script from there.`);
    process.exit(1);
  }
}

const source = Object.fromEntries(Object.entries(targets).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
let main = source.main;
let index = source.index;
let auth = source.auth;

// Check every expected integration point before writing any file.
if (!main.includes("from './MarketplaceSections.jsx'")) throw new Error('Could not find the MarketplaceSections import in main.jsx; no project files have been changed.');
if (!main.includes('<MarketplaceSections')) throw new Error('Could not find the MarketplaceSections render in main.jsx; no project files have been changed.');
if (!index.includes("require('./routes/edits')")) throw new Error('Could not find the edit routes in server/src/index.js; no project files have been changed.');
if (!auth.includes("INSERT INTO wallets(user_id,balance) VALUES($1,0)")) throw new Error('Could not find the wallet setup in the signup route. Review server/src/routes/auth.js before integrating; no project files have been changed.');
if (!auth.includes('const { email, password, displayName } = req.body || {}') && !auth.includes('referralCode')) throw new Error('The signup body in auth.js differs from the expected version. Review it before integrating; no project files have been changed.');

// Frontend component import.
if (!main.includes("from './EditLabRewards.jsx'")) {
  main = main.replace("import MarketplaceSections from './MarketplaceSections.jsx';", "import MarketplaceSections from './MarketplaceSections.jsx';\nimport EditLabRewards from './EditLabRewards.jsx';");
}

// Navigation anchors, added once.
if (!main.includes('href="#editlab"')) {
  const navAnchor = /^([ \t]*<a href="#scene-packs"[^\r\n]*\r?\n)/m;
  const found = main.match(navAnchor);
  if (!found) throw new Error('Could not find the Scene Packs navigation link in main.jsx; no project files have been changed.');
  const extra = `          <a href="#editlab" onClick={() => setMobileNav(false)}>{language === 'ar' ? 'معمل المونتاج' : language === 'es' ? 'EditLab' : 'EditLab'}</a>\n          <a href="#earn-points" onClick={() => setMobileNav(false)}>{language === 'ar' ? 'جمع النقاط' : language === 'es' ? 'Ganar puntos' : 'Earn Points'}</a>\n`;
  main = main.replace(found[0], found[0] + extra);
}

// Insert EditLab below the existing marketplace sections while preserving all previous sections.
if (!main.includes('<EditLabRewards')) {
  const componentPattern = /<MarketplaceSections\s+user=\{user\}[\s\S]*?onPointsChange=\{setPoints\}\s*\/>/;
  const found = main.match(componentPattern);
  if (!found) throw new Error('Could not safely locate the MarketplaceSections component props in main.jsx; no project files have been changed.');
  main = main.replace(found[0], `${found[0]}\n\n        <EditLabRewards user={user} language={language} onNotice={setNotice} onLoginRequest={() => openAuth('login')} onPointsChange={setPoints} />`);
}

// Carry the referral code captured from ?ref=... into the existing account creation request.
if (!main.includes('referralCode: localStorage.getItem')) {
  const signupPayloadMarker = '            password,\n          }\n        : {\n            email: email.trim(),\n            password,\n          };';
  const signupPayloadReplacement = '            password,\n            referralCode: localStorage.getItem(\'editvault_referral_code\') || new URLSearchParams(window.location.search).get(\'ref\') || \'\',\n          }\n        : {\n            email: email.trim(),\n            password,\n          };';
  if (!main.includes(signupPayloadMarker)) throw new Error('Could not safely locate the signup payload in main.jsx; no project files have been changed.');
  main = main.replace(signupPayloadMarker, signupPayloadReplacement);
}
if (!main.includes("localStorage.removeItem('editvault_referral_code')")) {
  const saveUserMarker = "localStorage.setItem('editvault_user', JSON.stringify(data.user));";
  if (!main.includes(saveUserMarker)) throw new Error('Could not find the session persistence block in main.jsx; no project files have been changed.');
  main = main.replace(saveUserMarker, `${saveUserMarker}\n      if (isSignup) localStorage.removeItem('editvault_referral_code');`);
}

// Mount the EditLab API route once.
if (!index.includes("const editLabRoutes = require('./routes/editlab')")) {
  const editImport = "const editRoutes = require('./routes/edits');";
  if (!index.includes(editImport)) throw new Error('Could not find the edit routes import in server/src/index.js; no project files have been changed.');
  index = index.replace(editImport, `${editImport}\nconst editLabRoutes = require('./routes/editlab');`);
}
if (!index.includes("const rewardsRoutes = require('./routes/rewards')")) {
  const rewardsAnchor = "const editLabRoutes = require('./routes/editlab');";
  index = index.replace(rewardsAnchor, `${rewardsAnchor}\nconst rewardsRoutes = require('./routes/rewards');`);
}
if (!index.includes("app.use('/api/editlab', editLabRoutes)")) {
  const mountMarker = "app.use('/api/edits', editRoutes);";
  if (!index.includes(mountMarker)) throw new Error('Could not find the edits route mount in server/src/index.js; no project files have been changed.');
  index = index.replace(mountMarker, `${mountMarker}\napp.use('/api/editlab', editLabRoutes);\napp.use('/api/rewards', rewardsRoutes);`);
}

// Register the referral at signup, using the existing signup transaction and only valid existing accounts.
if (!auth.includes('referralCode')) {
  auth = auth.replace('const { email, password, displayName } = req.body || {};', 'const { email, password, displayName, referralCode } = req.body || {};');
  const walletMarker = "await client.query('INSERT INTO wallets(user_id,balance) VALUES($1,0)', [rows[0].id]);";
  const referralSnippet = `${walletMarker}
      const referralId = String(referralCode || '').trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referralId) && referralId !== String(rows[0].id)) {
        const { rows: referrerRows } = await client.query('SELECT id FROM users WHERE id = $1 AND role <> $2', [referralId, 'admin']);
        if (referrerRows[0]) {
          await client.query(\`INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT (referred_id) DO NOTHING\`, [referralId, rows[0].id]);
        }
      }`;
  if (!auth.includes(walletMarker)) throw new Error('Could not locate wallet creation in auth.js; no project files have been changed.');
  auth = auth.replace(walletMarker, referralSnippet);
}

// Back up all patched files first, then apply the fully validated changes.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
for (const [key, file] of Object.entries(targets)) {
  const original = source[key];
  const backup = `${file}.pre-editlab-${stamp}.bak`;
  fs.copyFileSync(file, backup);
  const next = key === 'main' ? main : key === 'index' ? index : auth;
  if (next !== original) fs.writeFileSync(file, next, 'utf8');
}

console.log('EditLab, referral rewards, and navigation integration applied.');
console.log('Backups ending in .pre-editlab-*.bak were created next to the updated files.');
console.log('Next: run the DB migration and install/use FFmpeg on the server before processing videos.');
