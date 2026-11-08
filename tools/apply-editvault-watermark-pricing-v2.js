#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),root=process.cwd(),payload=path.resolve(__dirname,'../upgrade-files');
const originals=['server/src/routes/edits.js','client/src/EditVaultLibrary.jsx','client/src/PersonalizedWatermarkCheckout.jsx','client/src/personalized-watermark.css'];
const additions=['server/src/lib/watermark-pricing.js','server/src/db/apply-watermark-pricing-v2.js','client/admin-watermarks.html','client/src/AdminWatermarkQueue.jsx','client/src/admin-watermark-queue.css'];
const old={};
function replace(s,a,b,label){let i=s.indexOf(a);if(i<0||s.indexOf(a,i+a.length)>=0)throw Error('Cannot find unique '+label);return s.slice(0,i)+b+s.slice(i+a.length)}
function editRoutes(s){
 if(s.includes("require('../lib/watermark-pricing')"))throw Error('v2 already installed');
 s=replace(s,"const { auth } = require('../middleware/auth');","const { auth, adminOnly } = require('../middleware/auth');\nconst { normalizePaidWatermark } = require('../lib/watermark-pricing');",'imports');
 s=replace(s,'        p.watermark_name, p.watermark_style,','        p.watermark_name, p.watermark_style,\n        p.watermark_mode, p.watermark_fee_points, p.manual_watermark_status,','library SELECT');
 s=replace(s,'// POST /api/edits/:id/purchase',`// Pricing is advisory; the purchase transaction calculates it again.
router.get('/watermark-pricing',auth,async(req,res,next)=>{
 try{const {rows}=await db.query(\`SELECT EXISTS(SELECT 1 FROM purchases WHERE buyer_id=$1
 AND watermark_name IS NOT NULL AND (watermark_mode='auto' OR watermark_mode IS NULL)) AS used\`,[req.user.id]);
 res.json({freeAutoAvailable:!rows[0].used,autoNextPoints:10,manualPoints:40});}catch(e){next(e)}
});
// POST /api/edits/:id/purchase`,'pricing endpoint');
 s=replace(s,'  try { watermark = normalizeWatermark(req.body?.watermark); }','  try { watermark = normalizePaidWatermark(req.body?.watermark); }','normalize');
 s=replace(s,'    const { rows: wallets } = await client.query(',`    // Lock buyer to make the first-free rule safe across simultaneous purchases.
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
    let watermarkFee=0;
    if(watermark.mode==='manual') watermarkFee=40;
    else if(watermark.mode==='auto'){
      const {rows:used}=await client.query(\`SELECT 1 FROM purchases WHERE buyer_id=$1
        AND watermark_name IS NOT NULL AND (watermark_mode='auto' OR watermark_mode IS NULL) LIMIT 1\`,[req.user.id]);
      watermarkFee=used.length?10:0;
    }
    const totalCost=Number(edit.price_points)+watermarkFee;
    const { rows: wallets } = await client.query(`,'pricing transaction');
 s=replace(s,'wallets[0].balance < edit.price_points','wallets[0].balance < totalCost','wallet check');
 s=replace(s,'[edit.price_points, req.user.id]','[totalCost, req.user.id]','wallet debit');
 s=replace(s,'        price_points,\n        watermark_name,\n        watermark_style\n      )\n      VALUES ($1, $2, $3, $4, $5)','        price_points,\n        watermark_name,\n        watermark_style,\n        watermark_mode, watermark_fee_points, manual_watermark_status, manual_watermark_note\n      )\n      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)','purchase INSERT');
 s=replace(s,'[req.user.id, edit.id, edit.price_points, watermark.name, watermark.style]',"[req.user.id, edit.id, edit.price_points, watermark.name, watermark.style, watermark.mode, watermarkFee, watermark.mode==='manual'?'pending':null, watermark.brief]",'purchase values');
 s=replace(s,'        -edit.price_points,','        -totalCost,','ledger debit');
 s=replace(s,"      pointsSpent: edit.price_points,\n      message: 'Edit unlocked. Download it from your library.',","      pointsSpent: totalCost,\n      watermarkFeePoints: watermarkFee,\n      manualWatermarkStatus: watermark.mode==='manual'?'pending':null,\n      message: watermark.mode==='manual'?'Original unlocked; handcrafted copy awaiting admin delivery.':'Edit unlocked. Download it from your library.',",'purchase response');
 return s;
}
function manualRoutes(s){
const routes=`router.get('/admin/manual-watermarks',auth,adminOnly,async(_req,res,next)=>{
 try{const {rows}=await db.query(\`SELECT p.id AS purchase_id,p.created_at,p.watermark_name,p.manual_watermark_note,
 p.manual_watermark_status,p.watermark_fee_points,e.title,u.display_name AS buyer_name,u.email AS buyer_email
 FROM purchases p JOIN edits e ON e.id=p.edit_id JOIN users u ON u.id=p.buyer_id
 WHERE p.watermark_mode='manual' ORDER BY (p.manual_watermark_status='pending') DESC,p.created_at DESC LIMIT 200\`);
 res.json({requests:rows});}catch(e){next(e)}
});
router.post('/admin/manual-watermarks/:purchaseId/deliver',auth,adminOnly,upload.single('video'),async(req,res,next)=>{
 if(!req.file)return res.status(400).json({error:'Upload the finished video.'});
 try{const {rows}=await db.query(\`UPDATE purchases SET manual_watermark_status='completed',manual_watermark_path=$1
 WHERE id=$2 AND watermark_mode='manual' AND manual_watermark_status='pending' RETURNING id\`,[req.file.path,req.params.purchaseId]);
 if(!rows.length){fs.rmSync(req.file.path,{force:true});return res.status(409).json({error:'Pending request not found.'})}
 res.json({status:'completed',purchaseId:rows[0].id});
 }catch(e){fs.rmSync(req.file.path,{force:true});next(e)}
});
router.get('/:id/download-manual',auth,async(req,res,next)=>{
 try{const {rows}=await db.query(\`SELECT manual_watermark_path FROM purchases WHERE edit_id=$1 AND buyer_id=$2
 AND watermark_mode='manual' AND manual_watermark_status='completed'\`,[req.params.id,req.user.id]);
 if(!rows.length)return res.status(404).json({error:'Your custom video is not ready.'});
 const file=rows[0].manual_watermark_path;
 if(!file||!fs.existsSync(file))return res.status(410).json({error:'Custom video missing. Contact support.'});
 return res.download(file,'editvault-custom-'+req.params.id+path.extname(file));
 }catch(e){next(e)}
});

`;
 return replace(s,'// Personalized copy: auth and ownership checks live in the handler.',routes+'// Personalized copy: auth and ownership checks live in the handler.','manual routes');
}
function patchLibrary(s){
 s=replace(s,'const downloadItem = async (item, personalized = false) => {','const downloadItem = async (item, personalized = false, manual = false) => {','library handler');
 s=replace(s,"`${item.id}:${personalized ? 'personalized' : 'original'}`","`${item.id}:${manual ? 'manual' : personalized ? 'personalized' : 'original'}`",'library spinner');
 s=replace(s,'${personalized ? "download-personalized" : "download"}','${manual ? "download-manual" : personalized ? "download-personalized" : "download"}','library URL');
 const insert=`                  {item.watermark_mode === 'manual' && (
                    <div className="evwm-manual-status">
                      <strong>HANDCRAFTED DESIGN · 40 PTS</strong>
                      {item.manual_watermark_status === 'completed' ? (
                        <button type="button" className="evwm-library-button" disabled={Boolean(downloadingId)} onClick={() => downloadItem(item, false, true)}>
                          {downloadingId === \`${'${item.id}'}:manual\` ? 'Downloading…' : 'Download handmade copy'}
                        </button>
                      ) : <span>Pending manual delivery · your original is available above.</span>}
                    </div>
                  )}
                  {item.watermark_name && item.watermark_style && (`;
 return replace(s,'                  {item.watermark_name && item.watermark_style && (',insert,'manual My Library UI');
}
try{
 for(const rel of originals){const file=path.join(root,rel);if(!fs.existsSync(file))throw Error('Missing v1 file: '+rel);old[rel]=fs.readFileSync(file,'utf8')}
 for(const rel of additions){if(fs.existsSync(path.join(root,rel)))throw Error('New v2 file already exists: '+rel);if(!fs.existsSync(path.join(payload,rel)))throw Error('Missing payload: '+rel)}
 if(!old['server/src/routes/edits.js'].includes('download-personalized'))throw Error('Install v1 checkout first.');
 const changed={
  'server/src/routes/edits.js':manualRoutes(editRoutes(old['server/src/routes/edits.js'])),
  'client/src/EditVaultLibrary.jsx':patchLibrary(old['client/src/EditVaultLibrary.jsx']),
  'client/src/PersonalizedWatermarkCheckout.jsx':fs.readFileSync(path.join(payload,'client/src/PersonalizedWatermarkCheckout.jsx'),'utf8'),
  'client/src/personalized-watermark.css':fs.readFileSync(path.join(payload,'client/src/personalized-watermark.css'),'utf8')
 };
 const backup=path.join(root,'backups','before-watermark-pricing-v2-'+new Date().toISOString().replace(/[:.]/g,'-'));
 for(const rel of originals){const file=path.join(backup,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,old[rel])}
 const written=[];
 try{for(const [rel,content] of Object.entries(changed)){fs.writeFileSync(path.join(root,rel),content,'utf8');written.push(rel)}
   for(const rel of additions){const dest=path.join(root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(payload,rel),dest);written.push(rel)}
 }catch(e){for(const rel of written){if(Object.hasOwn(old,rel))fs.writeFileSync(path.join(root,rel),old[rel]);else fs.rmSync(path.join(root,rel),{force:true})}throw e}
 console.log('EditVault watermark pricing v2 installed! Backup: '+backup);
 console.log('Next: cd server && node src/db/apply-watermark-pricing-v2.js');
}catch(e){console.error('Install stopped: '+e.message);process.exitCode=1}
