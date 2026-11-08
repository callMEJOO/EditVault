$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$mainPath = Join-Path $root 'client\src\main.jsx'
$cssPath = Join-Path $root 'client\src\styles.css'
$editsPath = Join-Path $root 'server\src\routes\edits.js'
$creatorsPath = Join-Path $root 'server\src\routes\creators.js'
foreach ($p in @($mainPath,$cssPath,$editsPath,$creatorsPath)) { if (!(Test-Path $p)) { throw "Missing required file: $p. Run this script from the project root." } }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "creator-studio-backup-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
foreach ($p in @($mainPath,$cssPath,$editsPath,$creatorsPath)) { Copy-Item $p (Join-Path $backup ([IO.Path]::GetFileName($p))) }
function Read-Normalized([string]$Path) { return [IO.File]::ReadAllText($Path).Replace("`r`n","`n") }
function Replace-Once([string]$Text,[string]$Old,[string]$New,[string]$Label) {
  $count = ([regex]::Matches($Text,[regex]::Escape($Old))).Count
  if ($count -ne 1) { throw "Patch stopped at '$Label': expected one match, found $count. Backup: $backup" }
  return $Text.Replace($Old,$New)
}
$main = Read-Normalized $mainPath
$css = Read-Normalized $cssPath
$edits = Read-Normalized $editsPath
$creators = Read-Normalized $creatorsPath

# Frontend imports and state
$main = Replace-Once $main "import './styles.css';" "import './styles.css';`nimport CreatorStudio from './CreatorStudio.jsx';" 'import CreatorStudio component'
$main = Replace-Once $main "  const [previewEdit, setPreviewEdit] = useState(null);" "  const [previewEdit, setPreviewEdit] = useState(null);`n  const [creatorStudioOpen, setCreatorStudioOpen] = useState(false);" 'Creator Studio state'
$main = Replace-Once $main '    <div className="app-shell">' ('    <div className="app-shell">' + "`n" + '      <CreatorStudio open={creatorStudioOpen} onClose={() => setCreatorStudioOpen(false)} user={user} onNotice={setNotice} />') 'render Creator Studio overlay'
$main = Replace-Once $main "user ? setNotice('Creator tools are coming soon.') : openAuth('signup')" "user ? setCreatorStudioOpen(true) : openAuth('signup')" 'hero creator button'
$main = Replace-Once $main "user`n                ? setNotice('Creator tools are coming soon.')`n                : openAuth('signup')" "user`n                ? setCreatorStudioOpen(true)`n                : openAuth('signup')" 'creator banner button'

# Creator-owned video list API, inserted before preview route.
$mineRoute = @'
// GET /api/edits/mine - videos owned by the authenticated creator.
router.get('/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.description, e.category, e.price_points,
              e.status, e.created_at,
              COUNT(p.id)::int AS sales,
              COALESCE(SUM(p.price_points), 0)::int AS points_earned
       FROM edits e
       LEFT JOIN purchases p ON p.edit_id = e.id
       WHERE e.creator_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ edits: rows });
  } catch (error) { next(error); }
});

'@
if ($edits -notmatch "router\.get\('/mine'") {
  $edits = Replace-Once $edits '// GET /api/edits/:id/preview' ($mineRoute + '// GET /api/edits/:id/preview') 'insert creator video list endpoint'
}
# Restrict upload on the server to verified creators/admins; check before multer stores the file.
$gate = @'
async function verifiedCreatorOnly(req, res, next) {
  try {
    const { rows } = await db.query('SELECT role, verification_status FROM users WHERE id = $1', [req.user.id]);
    const account = rows[0];
    if (!account) return res.status(401).json({ error: 'Account not found.' });
    if (account.role !== 'admin' && (account.role !== 'creator' || account.verification_status !== 'verified')) {
      return res.status(403).json({ error: 'Verify your TikTok profile before uploading videos.', verificationRequired: true });
    }
    next();
  } catch (error) { next(error); }
}

'@
if ($edits -notmatch 'function verifiedCreatorOnly') {
  $edits = Replace-Once $edits '// POST /api/edits' ($gate + '// POST /api/edits') 'insert verified creator guard'
  $edits = Replace-Once $edits "  auth,`n  upload.single('original')," "  auth,`n  verifiedCreatorOnly,`n  upload.single('original')," 'protect video upload endpoint'
}
# Current user's TikTok verification data endpoint.
$meRoute = @'
router.get('/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, display_name, email, role, tiktok_url, verification_status, verification_note FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

'@
if ($creators -notmatch "router\.get\('/me'") {
  $creators = Replace-Once $creators "router.post('/verification-request'" ($meRoute + "router.post('/verification-request'") 'insert creator profile endpoint'
}

# New, self-contained Creator Studio UI component.
$componentPath = Join-Path $root 'client\src\CreatorStudio.jsx'
$component = @'
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Coins, ExternalLink, Film, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const initialForm = { title: '', description: '', category: 'Anime', pricePoints: '80', original: null };

export default function CreatorStudio({ open, onClose, user, onNotice }) {
  const [profile, setProfile] = useState(user || null);
  const [videos, setVideos] = useState([]);
  const [sales, setSales] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('editvault_token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });
  const readJson = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Request failed.');
    return data;
  };

  const loadStudio = useCallback(async () => {
    if (!token()) return;
    setLoading(true); setError('');
    try {
      const [profileRes, videosRes, salesRes] = await Promise.all([
        fetch(`${API_URL}/api/creators/me`, { headers: headers() }),
        fetch(`${API_URL}/api/edits/mine`, { headers: headers() }),
        fetch(`${API_URL}/api/creators/sales`, { headers: headers() }),
      ]);
      const [profileData, videosData, salesData] = await Promise.all([readJson(profileRes), readJson(videosRes), readJson(salesRes)]);
      const nextProfile = profileData.user || profileData;
      setProfile(nextProfile);
      setTiktokUrl(nextProfile.tiktok_url || '');
      setVideos(Array.isArray(videosData.edits) ? videosData.edits : []);
      setSales(Array.isArray(salesData.sales) ? salesData.sales : []);
    } catch (e) {
      setError(e.message || 'Could not load Creator Studio.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open && user) loadStudio(); }, [open, user, loadStudio]);
  if (!open) return null;

  const verified = profile?.verification_status === 'verified' || profile?.role === 'admin';
  const pending = profile?.verification_status === 'pending';
  const pointsEarned = videos.reduce((sum, video) => sum + Number(video.points_earned || 0), 0);
  const totalSales = videos.reduce((sum, video) => sum + Number(video.sales || 0), 0);

  const submitVerification = async (event) => {
    event.preventDefault(); setRequesting(true); setError('');
    try {
      const response = await fetch(`${API_URL}/api/creators/verification-request`, {
        method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktokUrl: tiktokUrl.trim() }),
      });
      const data = await readJson(response);
      setProfile(data.user || { ...profile, tiktok_url: tiktokUrl.trim(), verification_status: 'pending' });
      onNotice?.(data.message || 'TikTok verification request submitted.');
      await loadStudio();
    } catch (e) { setError(e.message || 'Could not submit verification request.'); }
    finally { setRequesting(false); }
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!form.original) { setError('Choose a video file first.'); return; }
    setUploading(true); setError('');
    try {
      const body = new FormData();
      body.append('original', form.original);
      body.append('title', form.title.trim());
      body.append('description', form.description.trim());
      body.append('category', form.category);
      body.append('pricePoints', form.pricePoints);
      const response = await fetch(`${API_URL}/api/edits`, { method: 'POST', headers: headers(), body });
      await readJson(response);
      setForm(initialForm);
      const fileInput = document.getElementById('creator-original-video');
      if (fileInput) fileInput.value = '';
      onNotice?.('Video uploaded successfully.');
      await loadStudio();
    } catch (e) { setError(e.message || 'Video upload failed.'); }
    finally { setUploading(false); }
  };

  return <div className="creator-studio-backdrop" role="dialog" aria-modal="true" aria-label="Creator Studio">
    <section className="creator-studio">
      <header className="cs-header">
        <div className="cs-brand"><span className="cs-brand-icon"><Film size={22}/></span><div><div className="eyebrow">EDITVAULT / CREATOR TOOLS</div><h2>Creator <span>Studio</span></h2></div></div>
        <div className="cs-header-actions"><button className="cs-quiet-btn" onClick={loadStudio} disabled={loading}><RefreshCw size={15}/> Refresh</button><button className="cs-close" onClick={onClose} aria-label="Close Creator Studio"><X/></button></div>
      </header>
      <div className="cs-content">
        <div className="cs-welcome"><div><div className="eyebrow">YOUR CREATOR DASHBOARD</div><h3>Welcome back, {profile?.display_name || profile?.displayName || user?.email || 'creator'}.</h3><p>Manage your edits, track sales, and keep your creator verification up to date.</p></div><span className={`cs-status ${verified ? 'is-verified' : pending ? 'is-pending' : ''}`}>{verified ? <><BadgeCheck size={15}/> Verified creator</> : pending ? 'Verification pending' : 'Verification required'}</span></div>
        {error && <div className="cs-error">{error}</div>}
        <div className="cs-metrics"><article><span>VIDEOS</span><strong>{videos.length}</strong><small>Uploaded by you</small></article><article><span>TOTAL SALES</span><strong>{totalSales}</strong><small>Successful purchases</small></article><article><span>POINTS EARNED</span><strong>{pointsEarned.toLocaleString()}</strong><small>From your edits</small></article></div>
        <div className="cs-grid">
          <section className="cs-panel"><div className="cs-panel-heading"><div><div className="eyebrow">PUBLISH NEW WORK</div><h3>Upload an edit</h3></div><Upload size={20}/></div>
            {!verified ? <div className="cs-locked"><ShieldCheck size={24}/><strong>Verification needed</strong><p>Submit your TikTok profile below. Uploading is enabled after an admin verifies your account.</p></div> : <form className="cs-form" onSubmit={submitUpload}>
              <label>Video file <input id="creator-original-video" type="file" accept="video/mp4,video/quicktime,video/webm" required onChange={e=>setForm({...form,original:e.target.files?.[0] || null})}/><small>MP4, MOV or WebM. Server upload limit applies.</small></label>
              <label>Title<input required minLength={2} maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Neon after hours"/></label>
              <label>Description<textarea maxLength={2000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Tell buyers about this edit" rows={3}/></label>
              <div className="cs-form-row"><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Anime','Cinematic','Aesthetic','Gaming','AMV','Other'].map(c=><option key={c}>{c}</option>)}</select></label><label>Price (points)<input required type="number" min="1" max="100000" step="1" value={form.pricePoints} onChange={e=>setForm({...form,pricePoints:e.target.value})}/></label></div>
              <button className="primary-cta cs-submit" disabled={uploading}>{uploading ? 'Uploading video…' : 'Upload video'} <Upload size={16}/></button>
            </form>}
          </section>
          <section className="cs-panel"><div className="cs-panel-heading"><div><div className="eyebrow">CREATOR VERIFICATION</div><h3>TikTok profile</h3></div><ShieldCheck size={20}/></div>
            <p className="cs-panel-copy">Verification is reviewed manually. Use your public TikTok profile URL.</p>
            <form className="cs-form" onSubmit={submitVerification}><label>TikTok profile URL<input type="url" required value={tiktokUrl} onChange={e=>setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@username"/></label>
              {profile?.verification_note && <div className="cs-note">Admin note: {profile.verification_note}</div>}
              <button className="primary-cta cs-submit" disabled={requesting || pending || verified}>{verified ? 'Already verified' : pending ? 'Request pending review' : requesting ? 'Submitting…' : 'Request verification'} <ExternalLink size={15}/></button>
            </form><div className="cs-verification-hint">Status: <strong>{profile?.verification_status || 'not requested'}</strong></div>
          </section>
        </div>
        <section className="cs-panel cs-videos-panel"><div className="cs-panel-heading"><div><div className="eyebrow">YOUR CATALOG</div><h3>My videos</h3></div><span className="cs-count">{videos.length} total</span></div>
          {loading ? <p className="cs-empty">Loading your creator data…</p> : videos.length === 0 ? <div className="cs-empty"><Film size={25}/><strong>No videos yet</strong><span>Your uploaded videos will appear here.</span></div> : <div className="cs-video-list">{videos.map(video=><article className="cs-video-row" key={video.id}><div className="cs-video-icon"><Film size={20}/></div><div className="cs-video-info"><strong>{video.title}</strong><span>{video.category || 'Other'} · {Number(video.price_points || 0)} points</span><small>{video.status || 'published'} · {video.created_at ? new Date(video.created_at).toLocaleDateString() : ''}</small></div><div className="cs-video-stats"><span><b>{Number(video.sales || 0)}</b> sales</span><span><b>{Number(video.points_earned || 0).toLocaleString()}</b> pts earned</span></div></article>)}</div>}
        </section>
      </div>
      <footer className="cs-footer"><span><Coins size={15}/> Earnings are shown from completed purchase records.</span><button onClick={onClose}><ArrowLeft size={15}/> Back to marketplace</button></footer>
    </section>
  </div>;
}
'@
# CSS for the overlay/component.
$studioCss = @'

/* CREATOR STUDIO */
.creator-studio-backdrop{position:fixed;z-index:80;inset:0;overflow:auto;padding:24px;background:rgba(5,5,8,.88);backdrop-filter:blur(12px)}
.creator-studio{width:min(1120px,100%);min-height:calc(100vh - 48px);margin:0 auto;border:1px solid #ffffff1b;border-radius:20px;background:#111116;color:#f4f3f8;box-shadow:0 30px 100px #000a;overflow:hidden}
.cs-header{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:20px 28px;border-bottom:1px solid #ffffff12;background:#15151bf2;backdrop-filter:blur(12px)}
.cs-brand{display:flex;align-items:center;gap:13px}.cs-brand-icon{display:grid;place-items:center;width:46px;height:46px;border:1px solid #c6ff4d40;border-radius:13px;color:var(--lime);background:#c6ff4d0b}.cs-brand h2{margin:5px 0 0;font-size:25px;letter-spacing:-1px}.cs-brand h2 span{color:var(--lime)}.cs-header-actions{display:flex;align-items:center;gap:9px}.cs-quiet-btn,.cs-close{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border:1px solid #ffffff20;border-radius:9px;background:#ffffff06;color:#e8e6ef;font-size:11px}.cs-close{width:40px;height:40px;padding:0}.cs-content{padding:26px 28px}.cs-welcome{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:23px;border:1px solid #ffffff12;border-radius:15px;background:radial-gradient(ellipse at right,#c6ff4d0c,transparent 50%),#17171d}.cs-welcome h3{font-size:22px;letter-spacing:-.7px;margin:10px 0 7px}.cs-welcome p,.cs-panel-copy{margin:0;color:var(--muted);font-size:12px;line-height:1.7}.cs-status{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:9px 11px;border:1px solid #f59e0b40;border-radius:8px;color:#fbbf24;background:#f59e0b0c;font-size:10px;font-weight:800}.cs-status.is-verified{border-color:#c6ff4d45;color:var(--lime);background:#c6ff4d0c}.cs-status.is-pending{border-color:#a78bfa55;color:#c4b5fd;background:#a78bfa0c}.cs-error{margin-top:16px;padding:12px 14px;border:1px solid #f8717140;border-radius:9px;color:#fca5a5;background:#f871710b;font-size:12px}.cs-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:17px 0}.cs-metrics article{display:flex;flex-direction:column;gap:8px;padding:19px;border:1px solid #ffffff12;border-radius:13px;background:#17171d}.cs-metrics article>span{font:9px 'DM Mono',monospace;letter-spacing:1.3px;color:#a5a3b0}.cs-metrics strong{font:28px 'DM Mono',monospace;color:var(--lime)}.cs-metrics small{font-size:10px;color:var(--muted)}.cs-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:15px}.cs-panel{min-width:0;padding:22px;border:1px solid #ffffff12;border-radius:14px;background:#17171d}.cs-panel-heading{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:19px}.cs-panel-heading>svg{color:var(--lime)}.cs-panel-heading h3{font-size:18px;margin:7px 0 0;letter-spacing:-.5px}.cs-form{display:grid;gap:14px;margin-top:18px}.cs-form label{display:grid;gap:7px;color:#d4d2dd;font-size:11px;font-weight:700}.cs-form input,.cs-form textarea,.cs-form select{width:100%;min-width:0;border:1px solid #ffffff20;border-radius:8px;padding:11px 12px;outline:none;background:#101014;color:#f5f4f8;font:inherit;font-size:12px}.cs-form input:focus,.cs-form textarea:focus,.cs-form select:focus{border-color:#c6ff4d70}.cs-form input[type=file]{padding:10px}.cs-form input[type=file]::file-selector-button{margin-right:10px;border:0;border-radius:6px;padding:7px 9px;background:#c6ff4d;color:#15170f;font-size:10px;font-weight:800}.cs-form small{color:var(--muted);font-size:10px;font-weight:400}.cs-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-submit{width:100%;min-height:43px;border:0}.cs-locked{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:22px;border:1px dashed #ffffff20;border-radius:10px;color:var(--muted)}.cs-locked svg{color:var(--lime)}.cs-locked strong{color:#f5f4f8}.cs-locked p{font-size:11px;line-height:1.7;margin:0}.cs-note{padding:10px;border-radius:8px;background:#f59e0b0c;color:#fcd34d;font-size:11px;line-height:1.6}.cs-verification-hint{margin-top:14px;color:var(--muted);font-size:10px}.cs-verification-hint strong{color:#e8e6ef}.cs-videos-panel{margin-top:15px}.cs-count{padding:7px 9px;border:1px solid #ffffff16;border-radius:7px;color:var(--muted);font:10px 'DM Mono',monospace}.cs-empty{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;padding:34px 15px;color:var(--muted);text-align:center;font-size:11px}.cs-empty svg{color:var(--lime)}.cs-empty strong{color:#eee}.cs-video-list{display:grid;gap:9px}.cs-video-row{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid #ffffff10;border-radius:10px;background:#111116}.cs-video-icon{display:grid;place-items:center;flex-shrink:0;width:43px;height:43px;border-radius:10px;background:#c6ff4d0b;color:var(--lime)}.cs-video-info{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.cs-video-info strong{overflow-wrap:anywhere;font-size:12px}.cs-video-info span,.cs-video-info small{color:var(--muted);font-size:10px}.cs-video-stats{display:flex;gap:17px;flex-shrink:0}.cs-video-stats span{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:9px}.cs-video-stats b{color:var(--lime);font:13px 'DM Mono',monospace}.cs-footer{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:17px 28px;border-top:1px solid #ffffff12;color:var(--muted);font-size:10px}.cs-footer>span,.cs-footer button{display:flex;align-items:center;gap:7px}.cs-footer svg{color:var(--lime)}.cs-footer button{border:0;background:transparent;color:#eee;font-size:10px}
@media(max-width:720px){.creator-studio-backdrop{padding:0}.creator-studio{min-height:100vh;border-radius:0}.cs-header{padding:15px 17px}.cs-brand-icon{width:39px;height:39px}.cs-brand h2{font-size:21px}.cs-quiet-btn{font-size:0;padding:10px}.cs-quiet-btn svg{width:16px}.cs-content{padding:16px}.cs-welcome{align-items:flex-start;flex-direction:column;padding:17px}.cs-welcome h3{font-size:19px}.cs-metrics{gap:8px}.cs-metrics article{padding:12px;gap:7px}.cs-metrics article>span{font-size:7px;letter-spacing:.5px}.cs-metrics strong{font-size:22px}.cs-metrics small{font-size:9px}.cs-grid{grid-template-columns:1fr}.cs-panel{padding:17px}.cs-video-row{align-items:flex-start;flex-wrap:wrap}.cs-video-stats{width:100%;padding-left:57px}.cs-footer{align-items:flex-start;flex-direction:column;padding:16px 17px}.cs-form-row{grid-template-columns:1fr}}
/* END CREATOR STUDIO */
'@
if (!(Test-Path $componentPath)) { [IO.File]::WriteAllText($componentPath, $component.Replace("`r`n","`n"), (New-Object System.Text.UTF8Encoding($false))) }
elseif ((Read-Normalized $componentPath) -notmatch 'export default function CreatorStudio') { throw 'client/src/CreatorStudio.jsx already exists but does not look like this Creator Studio component. Backup your existing file and retry.' }
if ($css -notmatch '/\* CREATOR STUDIO \*/') { $css += $studioCss }

# Only write after every expected source marker has been validated.
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($mainPath, $main.Replace("`n","`r`n"), $utf8)
[IO.File]::WriteAllText($cssPath, $css.Replace("`n","`r`n"), $utf8)
[IO.File]::WriteAllText($editsPath, $edits.Replace("`n","`r`n"), $utf8)
[IO.File]::WriteAllText($creatorsPath, $creators.Replace("`n","`r`n"), $utf8)
Write-Host "Creator Studio patch applied. Backup folder: $backup" -ForegroundColor Green
Write-Host 'Next run: npm run build from the client folder, and restart the server.' -ForegroundColor Cyan
