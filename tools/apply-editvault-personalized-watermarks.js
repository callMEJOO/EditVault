#!/usr/bin/env node
'use strict';
// Run from the EditVault project root. Fails closed if anchors have changed.
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const payload = path.resolve(__dirname, '../upgrade-files');
const originals = ['client/src/main.jsx','client/src/EditVaultLibrary.jsx','server/src/routes/edits.js'];
const additions = ['client/src/PersonalizedWatermarkCheckout.jsx','client/src/personalized-watermark.css','server/src/lib/personalized-watermarks.js','server/src/lib/personalized-download.js','server/src/db/apply-personalized-watermarks.js'];
const old = {};
function one(s,a,b,label) {
  const at = s.indexOf(a);
  if (at < 0 || s.indexOf(a,at+a.length) !== -1) throw new Error('Cannot safely find unique anchor: '+label);
  return s.slice(0,at)+b+s.slice(at+a.length);
}
function patchMain(s) {
  if(s.includes('import PersonalizedWatermarkCheckout')) throw new Error('Checkout was already patched.');
  s=one(s,"import EditVaultLibrary from './EditVaultLibrary.jsx';","import EditVaultLibrary from './EditVaultLibrary.jsx';\nimport PersonalizedWatermarkCheckout from './PersonalizedWatermarkCheckout.jsx';",'checkout import');
  s=one(s,'  const [purchaseLoading, setPurchaseLoading] = useState(false);','  const [purchaseLoading, setPurchaseLoading] = useState(false);\n  const [checkoutEdit, setCheckoutEdit] = useState(null);','checkout state');
  s=one(s,'  const buy = async (edit) => {',`  const startWatermarkCheckout = (edit) => {
    if (!user) { setNotice('Please log in before buying an edit.'); openAuth('login'); return; }
    setCheckoutEdit(edit);
  };

  const buy = async (edit, watermark) => {`,'buy function');
  const start=s.indexOf('  const buy = async (edit, watermark) => {');
  const end=s.indexOf('\n  return (',start);
  if(end < 0) throw new Error('Could not isolate buy function');
  let part=s.slice(start,end);
  part=one(part,"const response = await fetch(`${API_URL}/api/edits/${edit.id}/purchase`, {\n        method: 'POST',\n        headers: { Authorization: `Bearer ${token}` },\n      });","const response = await fetch(`${API_URL}/api/edits/${edit.id}/purchase`, {\n        method: 'POST',\n        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },\n        body: JSON.stringify({ watermark }),\n      });",'purchase POST body');
  part=one(part,'      setPurchased((current) => current.includes(edit.id) ? current : [...current, edit.id]);','      setPurchased((current) => current.includes(edit.id) ? current : [...current, edit.id]);\n      setCheckoutEdit(null);','checkout success');
  s=s.slice(0,start)+part+s.slice(end);
  s=one(s,'onClick={() => purchased.includes(edit.id) ? downloadEdit(edit) : buy(edit)}','onClick={() => purchased.includes(edit.id) ? downloadEdit(edit) : startWatermarkCheckout(edit)}','buy button');
  s=one(s,'      <AccountSettings open={settingsOpen}',`      <PersonalizedWatermarkCheckout edit={checkoutEdit} points={points} busy={purchaseLoading} language={language}
        onClose={() => { if (!purchaseLoading) setCheckoutEdit(null); }}
        onConfirm={(watermark) => { if (checkoutEdit) buy(checkoutEdit, watermark); }} />
      <AccountSettings open={settingsOpen}`,'mount checkout');
  return s;
}
function patchLibrary(s) {
  if(s.includes('evwm-library-download')) throw new Error('My Library was already patched.');
  s=one(s,'  const downloadItem = async (item) => {','  const downloadItem = async (item, personalized = false) => {','library handler');
  const at=s.indexOf('  const downloadItem = async (item, personalized = false) => {');
  const end=s.indexOf('\n  const updateDraft',at);
  if(end<0) throw new Error('Cannot isolate library download handler');
  let body=s.slice(at,end);
  body=one(body,'    setDownloadingId(item.id);',"    setDownloadingId(`${item.id}:${personalized ? 'personalized' : 'original'}`);",'library download state');
  body=one(body,'`${API_URL}/api/edits/${item.id}/download`','`${API_URL}/api/edits/${item.id}/${personalized ? "download-personalized" : "download"}`','download url');
  body=one(body,'      onNotice?.(`Downloading “${item.title}”.`);','      onNotice?.(personalized ? `Downloading your personalized copy of “${item.title}”.` : `Downloading “${item.title}”.`);','download notification');
  s=s.slice(0,at)+body+s.slice(end);
  s=one(s,'disabled={downloadingId === item.id} onClick={() => downloadItem(item)}','disabled={Boolean(downloadingId)} onClick={() => downloadItem(item)}','library original disabled');
  s=one(s,"{downloadingId === item.id ? <LoaderCircle", "{downloadingId === `${item.id}:original` ? <LoaderCircle",'library spinner');
  s=one(s,"{downloadingId === item.id ? 'Preparing download…'", "{downloadingId === `${item.id}:original` ? 'Preparing download…'",'library label');
  const oldStr='                  </button>\n                  <div className="ev-library-review-block">';
  const added=`                  </button>
                  {item.watermark_name && item.watermark_style && (
                    <div className="evwm-library-download">
                      <div className="evwm-library-label">PERSONALIZED COPY <span>{item.watermark_name} · {item.watermark_style}</span></div>
                      <button type="button" className="evwm-library-button" disabled={Boolean(downloadingId)} onClick={() => downloadItem(item, true)}>
                        {downloadingId === \`${'${item.id}'}:personalized\` ? <LoaderCircle className="ev-library-spinner" size={16} /> : <Download size={16} />}
                        {downloadingId === \`${'${item.id}'}:personalized\` ? 'Rendering your watermark…' : 'Download with my name'}
                      </button>
                    </div>
                  )}
                  <div className="ev-library-review-block">`;
  return one(s,oldStr,added,'library personalized button');
}
function patchEdits(s) {
  if(s.includes("require('../lib/personalized-watermarks')")) throw new Error('Edit routes were already patched.');
  s=one(s,"const { auth } = require('../middleware/auth');","const { auth } = require('../middleware/auth');\nconst { normalizeWatermark } = require('../lib/personalized-watermarks');\nconst { personalizedDownload } = require('../lib/personalized-download');",'backend import');
  s=one(s,'        p.id AS purchase_id,\n        p.created_at AS purchased_at,','        p.id AS purchase_id,\n        p.created_at AS purchased_at,\n        p.watermark_name, p.watermark_style,','library SQL');
  s=one(s,"router.post('/:id/purchase', auth, async (req, res, next) => {\n  const client = await db.connect();",`router.post('/:id/purchase', auth, async (req, res, next) => {
  let watermark;
  try { watermark = normalizeWatermark(req.body?.watermark); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const client = await db.connect();`,'purchase validate');
  s=one(s,'      INSERT INTO purchases (\n        buyer_id,\n        edit_id,\n        price_points\n      )\n      VALUES ($1, $2, $3)','      INSERT INTO purchases (\n        buyer_id,\n        edit_id,\n        price_points,\n        watermark_name,\n        watermark_style\n      )\n      VALUES ($1, $2, $3, $4, $5)','purchase insert');
  s=one(s,'      [req.user.id, edit.id, edit.price_points]\n    );\n\n    await client.query(\n      `\n      INSERT INTO point_ledger','      [req.user.id, edit.id, edit.price_points, watermark.name, watermark.style]\n    );\n\n    await client.query(\n      `\n      INSERT INTO point_ledger','purchase insert values');
  s=one(s,'// GET /api/edits/:id/download\n',`// Personalized copy: auth and ownership checks live in the handler.
router.get('/:id/download-personalized', auth, personalizedDownload(db));

// GET /api/edits/:id/download
`,'new download route');
  return s;
}
try {
  for(const rel of originals){const file=path.join(root,rel);if(!fs.existsSync(file))throw new Error('Missing file: '+rel);old[rel]=fs.readFileSync(file,'utf8');}
  for(const rel of additions){if(fs.existsSync(path.join(root,rel)))throw new Error('New destination already exists: '+rel);if(!fs.existsSync(path.join(payload,rel)))throw new Error('Missing ZIP payload: '+rel);}
  const patched={'client/src/main.jsx':patchMain(old['client/src/main.jsx']),'client/src/EditVaultLibrary.jsx':patchLibrary(old['client/src/EditVaultLibrary.jsx']),'server/src/routes/edits.js':patchEdits(old['server/src/routes/edits.js'])};
  const backup=path.join(root,'backups','before-personalized-watermarks-'+new Date().toISOString().replace(/[:.]/g,'-'));
  for(const rel of originals){const dest=path.join(backup,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,old[rel],'utf8');}
  const done=[];
  try {
    for(const [rel,content] of Object.entries(patched)){fs.writeFileSync(path.join(root,rel),content,'utf8');done.push(rel);}
    for(const rel of additions){const dest=path.join(root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(payload,rel),dest);done.push(rel);}
  }catch(e){for(const rel of done){if(Object.hasOwn(old,rel))fs.writeFileSync(path.join(root,rel),old[rel],'utf8');else fs.rmSync(path.join(root,rel),{force:true});}throw e;}
  console.log('Personalized edit watermarks installed. Backup: '+backup);
  console.log('Next: cd server && node src/db/apply-personalized-watermarks.js');
}catch(e){console.error('Install stopped (no intentional changes): '+e.message);process.exitCode=1;}
