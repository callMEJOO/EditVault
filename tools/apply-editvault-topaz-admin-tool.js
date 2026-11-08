'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const indexPath = path.join(root, 'server', 'src', 'index.js');
const routePath = path.join(root, 'server', 'src', 'routes', 'topaz.js');
const componentPath = path.join(root, 'client', 'src', 'TopazAdmin.jsx');
const cssPath = path.join(root, 'client', 'src', 'topaz-admin.css');

function requireFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Required file not found: ${path.relative(root, file)}. Run this script from the EditVault project root.`);
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one match for ${label}; found ${count}. No project files were changed.`);
  return source.replace(before, after);
}

try {
  [mainPath, indexPath].forEach(requireFile);
  if ([routePath, componentPath, cssPath].some((file) => fs.existsSync(file))) {
    throw new Error('A Topaz admin tool file already exists. No files were changed; inspect the existing files before reinstalling.');
  }

  const originalMain = fs.readFileSync(mainPath, 'utf8');
  const originalIndex = fs.readFileSync(indexPath, 'utf8');
  const mainEol = originalMain.includes('\r\n') ? '\r\n' : '\n';
  const indexEol = originalIndex.includes('\r\n') ? '\r\n' : '\n';
  let main = originalMain.replace(/\r\n/g, '\n');
  let index = originalIndex.replace(/\r\n/g, '\n');

  main = replaceOnce(
    main,
    "import CreatorApplication from './CreatorApplication.jsx';",
    "import CreatorApplication from './CreatorApplication.jsx';\nimport TopazAdmin from './TopazAdmin.jsx';",
    'TopazAdmin import'
  );
  main = replaceOnce(
    main,
    "  const [creatorApplicationOpen, setCreatorApplicationOpen] = useState(false);",
    "  const [creatorApplicationOpen, setCreatorApplicationOpen] = useState(false);\n  const [topazOpen, setTopazOpen] = useState(false);",
    'Topaz admin modal state'
  );
  const creatorApplicationRender = '      <CreatorApplication open={creatorApplicationOpen} onClose={() => setCreatorApplicationOpen(false)} user={user} onNotice={setNotice} onUserUpdate={(updatedUser) => setUser((current) => { const next = { ...(current || {}), ...updatedUser }; localStorage.setItem(\'editvault_user\', JSON.stringify(next)); return next; })} />';
  main = replaceOnce(
    main,
    creatorApplicationRender,
    `${creatorApplicationRender}\n      <TopazAdmin open={topazOpen} onClose={() => setTopazOpen(false)} user={user} onNotice={setNotice} />`,
    'Topaz admin render'
  );
  const adminButton = "              {user.role === 'admin' && <button className=\"admin-access-btn\" onClick={() => document.getElementById('creator-admin-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{tx('Admin', 'الإدارة')}</button>}";
  main = replaceOnce(
    main,
    adminButton,
    `${adminButton}\n              {user.role === 'admin' && <button className=\"admin-access-btn\" type=\"button\" onClick={() => setTopazOpen(true)}>Topaz AI</button>}`,
    'administrator Topaz AI button'
  );

  index = replaceOnce(
    index,
    "const customRequestsRoutes = require('./routes/custom-requests');",
    "const customRequestsRoutes = require('./routes/custom-requests');\nconst topazRoutes = require('./routes/topaz');",
    'Topaz route import'
  );
  index = replaceOnce(
    index,
    "app.use('/api/custom-requests', customRequestsRoutes);",
    "app.use('/api/custom-requests', customRequestsRoutes);\napp.use('/api/topaz', topazRoutes);",
    'Topaz API mount'
  );

  const routeSource = path.join(root, 'upgrade-files', 'server', 'src', 'routes', 'topaz.js');
  const componentSource = path.join(root, 'upgrade-files', 'client', 'src', 'TopazAdmin.jsx');
  const cssSource = path.join(root, 'upgrade-files', 'client', 'src', 'topaz-admin.css');
  [routeSource, componentSource, cssSource].forEach(requireFile);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, `editvault-topaz-backup-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: false });
  fs.copyFileSync(mainPath, path.join(backupDir, 'main.jsx'));
  fs.copyFileSync(indexPath, path.join(backupDir, 'index.js'));

  main = main.replace(/\n/g, mainEol);
  index = index.replace(/\n/g, indexEol);
  fs.writeFileSync(mainPath, main, 'utf8');
  fs.writeFileSync(indexPath, index, 'utf8');
  fs.copyFileSync(routeSource, routePath);
  fs.copyFileSync(componentSource, componentPath);
  fs.copyFileSync(cssSource, cssPath);

  console.log('EditVault Topaz admin tool installed.');
  console.log('Added an administrator-only Topaz AI panel for private image and short MP4 tests.');
  console.log('Backup created at: ' + path.relative(root, backupDir));
  console.log('No database migration is required. Restart the backend and Vite to load the new route and component.');
  console.log('Warning: enhancement jobs can consume Topaz API credits. The API key remains server-side.');
} catch (error) {
  console.error('Topaz install stopped: ' + error.message);
  process.exitCode = 1;
}
