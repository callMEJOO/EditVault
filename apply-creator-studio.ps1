$ErrorActionPreference = "Stop"
$root = Get-Location
$mainPath = Join-Path $root "client\src\main.jsx"
$cssPath = Join-Path $root "client\src\styles.css"
$editsPath = Join-Path $root "server\src\routes\edits.js"
$creatorsPath = Join-Path $root "server\src\routes\creators.js"

foreach ($p in @($mainPath,$cssPath,$editsPath,$creatorsPath)) {
  if (-not (Test-Path $p)) { throw "Missing required file: $p. Run this script from the project root." }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = ".\creator-studio-patch-backup-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item $mainPath (Join-Path $backup "main.jsx")
Copy-Item $cssPath (Join-Path $backup "styles.css")
Copy-Item $editsPath (Join-Path $backup "edits.js")
Copy-Item $creatorsPath (Join-Path $backup "creators.js")

function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
  $count = ([regex]::Matches($Text, [regex]::Escape($Old))).Count
  if ($count -ne 1) { throw "Expected exactly one match for '$Label'; found $count. No further files should be edited." }
  return $Text.Replace($Old, $New)
}

# --- Backend: creator-owned video list ---
$edits = [System.IO.File]::ReadAllText((Resolve-Path $editsPath))
$mineRoute = @'
// GET /api/edits/mine - edits uploaded by the signed-in creator.
router.get('/mine', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `
        SELECT
          e.id, e.title, e.description, e.category,
          e.price_points, e.status, e.created_at,
          COUNT(p.id)::int AS sales,
          COALESCE(SUM(p.price_points), 0)::int AS points_earned
        FROM edits e
        LEFT JOIN purchases p ON p.edit_id = e.id
        WHERE e.creator_id = $1
        GROUP BY e.id
        ORDER BY e.created_at DESC
      `,
      [req.user.id]
    );
    res.json({ edits: rows });
  } catch (error) {
    next(error);
  }
});

'@
$edits = Replace-Once $edits "// GET /api/edits/:id/preview" ($mineRoute + "// GET /api/edits/:id/preview") "insert creator-owned edits route"

# Enforce creator verification on the server before accepting a large upload.
$gate = @'
async function verifiedCreatorOnly(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT role, verification_status FROM users WHERE id = $1',
      [req.user.id]
    );
    const account = rows[0];
    if (!account) return res.status(401).json({ error: 'Account not found.' });
    if (account.role !== 'admin' &&
        (account.role !== 'creator' || account.verification_status !== 'verified')) {
      return res.status(403).json({
        error: 'Verify your TikTok profile before uploading videos.',
        verificationRequired: true
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

'@
$edits = Replace-Once $edits "// GET /api/edits/:id/preview" ($gate + "// GET /api/edits/:id/preview") "insert creator upload permission middleware"
$edits = Replace-Once $edits "  auth,
  upload.single('original')," "  auth,
  verifiedCreatorOnly,
  upload.single('original')," "protect video upload route"
[System.IO.File]::WriteAllText((Resolve-Path $editsPath), $edits, [System.Text.UTF8Encoding]::new($false))

# --- Backend: current creator verification profile ---
$creators = [System.IO.File]::ReadAllText((Resolve-Path $creatorsPath))
$profileRoute = @'
// GET /api/creators/me - current user's creator verification profile.
router.get('/me', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, display_name, role, tiktok_url,
              verification_status, verification_note
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});

'@
$creators = Replace-Once $creators "router.post('/verification-request'" ($profileRoute + "router.post('/verification-request'") "insert creator profile endpoint"
[System.IO.File]::WriteAllText((Resolve-Path $creatorsPath), $creators, [System.Text.UTF8Encoding]::new($false))

# --- Frontend: Creator Studio state ---
$main = [System.IO.File]::ReadAllText((Resolve-Path $mainPath))
$stateMarker = "  const [adminSaving, setAdminSaving] = useState(false);"
$stateInsert = @'
  const [creatorStudioOpen, setCreatorStudioOpen] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [creatorEdits, setCreatorEdits] = useState([]);
  const [creatorSales, setCreatorSales] = useState([]);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorSaving, setCreatorSaving] = useState(false);
  const [creatorMessage, setCreatorMessage] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [creatorForm, setCreatorForm] = useState({
    title: '', description: '', category: 'Anime', pricePoints: '50', file: null,
  });
'@
$main = Replace-Once $main $stateMarker ($stateMarker + "`r`n" + $stateInsert) "insert Creator Studio state"

$functions = @'
  const loadCreatorStudio = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!user || !token) {
      setCreatorMessage('Please log in to open Creator Studio.');
      openAuth('login');
      return;
    }
    setCreatorLoading(true);
    setCreatorMessage('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [profileResponse, editsResponse, salesResponse] = await Promise.all([
        fetch(`${API_URL}/api/creators/me`, { headers }),
        fetch(`${API_URL}/api/edits/mine`, { headers }),
        fetch(`${API_URL}/api/creators/sales`, { headers }),
      ]);
      const profileData = await profileResponse.json().catch(() => ({}));
      const editsData = await editsResponse.json().catch(() => ({}));
      const salesData = await salesResponse.json().catch(() => ({}));
      if (!profileResponse.ok) throw new Error(profileData.error || 'Could not load creator profile.');
      if (!editsResponse.ok) throw new Error(editsData.error || 'Could not load your videos.');
      if (!salesResponse.ok) throw new Error(salesData.error || 'Could not load sales.');
      setCreatorProfile(profileData.user || null);
      setTiktokUrl(profileData.user?.tiktok_url || '');
      setCreatorEdits(Array.isArray(editsData.edits) ? editsData.edits : []);
      setCreatorSales(Array.isArray(salesData.sales) ? salesData.sales : []);
    } catch (error) {
      setCreatorMessage(error.message || 'Could not load Creator Studio.');
    } finally {
      setCreatorLoading(false);
    }
  };

  const openCreatorStudio = async () => {
    if (!user) {
      openAuth('signup');
      return;
    }
    setCreatorStudioOpen(true);
    await loadCreatorStudio();
  };

  const submitTikTokVerification = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('editvault_token');
    if (!token) return openAuth('login');
    setCreatorSaving(true);
    setCreatorMessage('');
    try {
      const response = await fetch(`${API_URL}/api/creators/verification-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktokUrl: tiktokUrl.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not submit verification request.');
      setCreatorProfile((current) => ({ ...(current || {}), ...(data.user || {}) }));
      setCreatorMessage(data.message || 'TikTok verification request submitted.');
    } catch (error) {
      setCreatorMessage(error.message || 'Could not submit verification request.');
    } finally {
      setCreatorSaving(false);
    }
  };

  const submitCreatorVideo = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('editvault_token');
    if (!token) return openAuth('login');
    if (!creatorForm.file) {
      setCreatorMessage('Choose a video file first.');
      return;
    }
    setCreatorSaving(true);
    setCreatorMessage('');
    try {
      const body = new FormData();
      body.append('original', creatorForm.file);
      body.append('title', creatorForm.title.trim());
      body.append('description', creatorForm.description.trim());
      body.append('category', creatorForm.category);
      body.append('pricePoints', creatorForm.pricePoints);
      const response = await fetch(`${API_URL}/api/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Video upload failed.');
      setCreatorForm({ title: '', description: '', category: 'Anime', pricePoints: '50', file: null });
      const fileInput = document.getElementById('creator-video-file');
      if (fileInput) fileInput.value = '';
      setCreatorMessage('Video uploaded successfully.');
      await loadCreatorStudio();
      const publicResponse = await fetch(`${API_URL}/api/edits`);
      if (publicResponse.ok) {
        const publicData = await publicResponse.json();
        setEdits((publicData.edits || []).map((row, index) => ({
          ...row,
          id: row.id,
          previewUrl: row.has_preview ? `${API_URL}/api/edits/${row.id}/preview` : null,
          creator: row.creator_name || 'creator',
          verified: row.verification_status === 'verified',
          price: Number(row.price_points || 0),
          likes: '—',
          tone: ['violet', 'blue', 'pink', 'orange', 'green', 'lavender'][index % 6],
          tag: 'ORIGINAL EDIT',
          length: '--:--',
        })));
      }
    } catch (error) {
      setCreatorMessage(error.message || 'Video upload failed.');
    } finally {
      setCreatorSaving(false);
    }
  };

'@
$main = Replace-Once $main "  return (`r`n    <div className=""app-shell"">" ($functions + "  return (`r`n    {creatorStudioOpen ? (`r`n      <div className=""creator-studio-shell"">`r`n        <header className=""creator-studio-header"">`r`n          <a className=""brand"" href=""#top"" onClick={(e) => { e.preventDefault(); setCreatorStudioOpen(false); }}><span className=""brand-mark""><Clapperboard size={20} /></span><span>EDIT<span className=""brand-accent"">VAULT</span><small>CREATOR STUDIO</small></span></a>`r`n          <button className=""secondary-cta"" onClick={() => setCreatorStudioOpen(false)}>Back to marketplace</button>`r`n        </header>`r`n        <main className=""creator-studio-main"">`r`n          <div className=""creator-studio-title""><div><div className=""eyebrow"">YOUR CREATOR SPACE</div><h1>Creator <span>Studio.</span></h1><p>Publish original edits, track sales, and manage TikTok verification.</p></div><span className={`creator-status status-${creatorProfile?.verification_status || 'not_requested'}`}>{(creatorProfile?.verification_status || 'not_requested').replace('_', ' ')}</span></div>`r`n          {creatorMessage && <div className=""creator-message"" role=""status"">{creatorMessage}<button onClick={() => setCreatorMessage('')} aria-label=""Dismiss""><X size={15} /></button></div>}`r`n          {creatorLoading ? <div className=""creator-panel"">Loading your creator data...</div> : (`r`n            <>`r`n              <div className=""creator-metrics"">`r`n                <article><span>YOUR VIDEOS</span><strong>{creatorEdits.length}</strong></article>`r`n                <article><span>TOTAL SALES</span><strong>{creatorSales.reduce((sum, item) => sum + Number(item.sales || 0), 0)}</strong></article>`r`n                <article><span>POINTS EARNED</span><strong>{creatorSales.reduce((sum, item) => sum + Number(item.points_earned || 0), 0).toLocaleString()}</strong></article>`r`n              </div>`r`n              <section className=""creator-panel""><div className=""creator-panel-heading""><div><div className=""eyebrow"">STEP 01</div><h2>TikTok verification</h2><p>Submit your profile for manual review. Uploading videos is enabled after verification.</p></div><ShieldCheck size={25} /></div>`r`n                <form className=""creator-form"" onSubmit={submitTikTokVerification}><label>TikTok profile URL<input type=""url"" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder=""https://www.tiktok.com/@yourname"" required /></label><button className=""primary-cta"" type=""submit"" disabled={creatorSaving || creatorProfile?.verification_status === 'pending' || creatorProfile?.verification_status === 'verified'}>{creatorProfile?.verification_status === 'verified' ? 'Verified' : creatorProfile?.verification_status === 'pending' ? 'Request pending' : creatorSaving ? 'Submitting...' : 'Request verification'}</button></form>`r`n                {creatorProfile?.verification_note && <p className=""creator-review-note"">Review note: {creatorProfile.verification_note}</p>}`r`n              </section>`r`n              <section className=""creator-panel""><div className=""creator-panel-heading""><div><div className=""eyebrow"">STEP 02</div><h2>Upload a video</h2><p>MP4, MOV, or WebM · maximum size follows the server upload limit.</p></div><Video size={25} /></div>`r`n                {creatorProfile?.role === 'admin' || (creatorProfile?.role === 'creator' && creatorProfile?.verification_status === 'verified') ? (`r`n                  <form className=""creator-form creator-upload-form"" onSubmit={submitCreatorVideo}><label>Video title<input value={creatorForm.title} onChange={(e) => setCreatorForm({ ...creatorForm, title: e.target.value })} maxLength={120} required /></label><label>Category<select value={creatorForm.category} onChange={(e) => setCreatorForm({ ...creatorForm, category: e.target.value })}><option>Anime</option><option>Cinematic</option><option>Aesthetic</option><option>Gaming</option><option>Other</option></select></label><label>Description<textarea value={creatorForm.description} onChange={(e) => setCreatorForm({ ...creatorForm, description: e.target.value })} rows={3} maxLength={2000} /></label><label>Price (points)<input type=""number"" min=""1"" max=""100000"" value={creatorForm.pricePoints} onChange={(e) => setCreatorForm({ ...creatorForm, pricePoints: e.target.value })} required /></label><label className=""creator-file-label"">Original video<input id=""creator-video-file"" type=""file"" accept=""video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"" onChange={(e) => setCreatorForm({ ...creatorForm, file: e.target.files?.[0] || null })} required /></label><button className=""primary-cta"" type=""submit"" disabled={creatorSaving}>{creatorSaving ? 'Uploading...' : 'Publish video'} <ArrowUpRight size={16} /></button></form>`r`n                ) : <div className=""creator-gate""><ShieldCheck size={22} /><div><strong>Verification required</strong><p>Submit your TikTok profile above. Once an admin approves it, you can upload videos here.</p></div></div>}`r`n              </section>`r`n              <section className=""creator-panel""><div className=""creator-panel-heading""><div><div className=""eyebrow"">YOUR CATALOG</div><h2>My videos &amp; sales</h2></div></div>`r`n                {creatorEdits.length ? <div className=""creator-video-list"">{creatorEdits.map((item) => { const sales = creatorSales.find((row) => row.id === item.id) || item; return <article className=""creator-video-row"" key={item.id}><div className=""creator-video-icon""><Video size={19} /></div><div className=""creator-video-info""><strong>{item.title}</strong><span>{item.category} · {Number(item.price_points || 0)} points · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span></div><div className=""creator-video-stat""><strong>{Number(sales.sales || 0)}</strong><span>sales</span></div><div className=""creator-video-stat creator-earned""><strong>{Number(sales.points_earned || 0).toLocaleString()}</strong><span>points</span></div><span className={`creator-status status-${item.status || 'draft'}`}>{item.status || 'draft'}</span></article>; })}</div> : <div className=""creator-empty"">No videos uploaded yet. Once verified, upload your first edit above.</div>}`r`n              </section>`r`n            </>`r`n          )}`r`n        </main>`r`n      </div>`r`n    ) : (`r`n    <div className=""app-shell"">") "add Creator Studio page"

# Close conditional expression after existing app-shell JSX root.
$main = Replace-Once $main "    </div>`r`n  );`r`n}" "    </div>`r`n    )}`r`n  );`r`n}" "close Creator Studio conditional"

# Replace both placeholder actions with actual Studio opener.
$oldHero = @'
                onClick={() =>
                  user ? setNotice('Creator tools are coming soon.') : openAuth('signup')
                }
'@
$newHero = @'
                onClick={openCreatorStudio}
'@
$main = Replace-Once $main $oldHero $newHero "wire hero creator button"
$oldBanner = @'
            onClick={() =>
              user
                ? setNotice('Creator tools are coming soon.')
                : openAuth('signup')
            }
'@
$main = Replace-Once $main $oldBanner $newHero "wire creator banner button"
[System.IO.File]::WriteAllText((Resolve-Path $mainPath), $main, [System.Text.UTF8Encoding]::new($false))

# --- CSS ---
$css = [System.IO.File]::ReadAllText((Resolve-Path $cssPath))
$cssAppend = @'

/* Creator Studio */
.creator-studio-shell{max-width:1440px;min-height:100vh;margin:0 auto;padding:0 5.3%;color:#f3f1f8}
.creator-studio-header{height:86px;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #ffffff12}
.creator-studio-main{max-width:1000px;margin:0 auto;padding:54px 0 90px}
.creator-studio-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}
.creator-studio-title h1{font-size:clamp(36px,5vw,58px);letter-spacing:-2.5px;margin:14px 0 8px}
.creator-studio-title h1 span{color:var(--lime)}
.creator-studio-title p,.creator-panel-heading p{margin:0;color:var(--muted);font-size:12px;line-height:1.8}
.creator-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
.creator-metrics article{display:grid;gap:12px;padding:22px;border:1px solid #ffffff14;border-radius:14px;background:linear-gradient(145deg,#1d1c24,#151519)}
.creator-metrics article span{font:10px 'DM Mono',monospace;letter-spacing:1.2px;color:var(--muted)}
.creator-metrics article strong{font-size:32px;color:var(--lime)}
.creator-panel{margin-top:18px;padding:clamp(18px,3vw,28px);border:1px solid #ffffff14;border-radius:16px;background:#17171c}
.creator-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}
.creator-panel-heading>svg{color:var(--lime);flex-shrink:0}
.creator-panel-heading h2{margin:9px 0;font-size:22px;letter-spacing:-.7px}
.creator-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.creator-form label{display:grid;gap:8px;min-width:0;color:#d7d4e0;font-size:11px;font-weight:700}
.creator-form input,.creator-form textarea,.creator-form select{width:100%;min-width:0;padding:12px;border:1px solid #ffffff20;border-radius:8px;background:#101014;color:#f6f5fa;font:inherit;font-size:12px;outline:none}
.creator-form input:focus,.creator-form textarea:focus,.creator-form select:focus{border-color:#c6ff4d80}
.creator-form textarea{resize:vertical}
.creator-form button{align-self:end;justify-self:start}
.creator-upload-form .creator-file-label,.creator-upload-form>button{grid-column:1/-1}
.creator-form input[type=file]{padding:10px}
.creator-status{display:inline-flex;align-items:center;justify-content:center;padding:7px 9px;border:1px solid #ffffff1a;border-radius:7px;background:#ffffff08;color:#b8b6c2;font:9px 'DM Mono',monospace;text-transform:uppercase;white-space:nowrap}
.status-verified,.status-published{color:#c6ff4d;border-color:#c6ff4d45}
.status-pending{color:#f6c96b;border-color:#f6c96b45}
.status-rejected,.status-removed{color:#ff9a9a;border-color:#ff9a9a45}
.creator-message{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 18px;padding:13px 15px;border:1px solid #c6ff4d35;border-radius:9px;background:#c6ff4d0b;color:#e7e5ee;font-size:12px;line-height:1.6}
.creator-message button{display:flex;border:0;background:transparent;color:#aaa8b5}
.creator-gate{display:flex;align-items:flex-start;gap:13px;padding:17px;border:1px solid #f6c96b35;border-radius:10px;background:#f6c96b08}
.creator-gate>svg{color:#f6c96b;flex-shrink:0}
.creator-gate strong{font-size:13px}
.creator-gate p,.creator-review-note{margin:6px 0 0;color:var(--muted);font-size:11px;line-height:1.8}
.creator-video-list{display:grid;gap:10px}
.creator-video-row{display:flex;align-items:center;gap:14px;min-width:0;padding:14px;border:1px solid #ffffff10;border-radius:11px;background:#111114}
.creator-video-icon{display:grid;place-items:center;flex-shrink:0;width:40px;height:40px;border-radius:10px;background:#c6ff4d0c;color:var(--lime)}
.creator-video-info{display:grid;gap:6px;flex:1;min-width:0}
.creator-video-info strong{font-size:12px;overflow-wrap:anywhere}
.creator-video-info span,.creator-video-stat span{font-size:10px;color:var(--muted)}
.creator-video-stat{display:grid;gap:4px;text-align:right;min-width:48px}
.creator-video-stat strong{font-size:14px}
.creator-earned strong{color:var(--lime)}
.creator-empty{padding:28px 15px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed #ffffff20;border-radius:10px}
@media(max-width:700px){.creator-studio-shell{padding:0 18px}.creator-studio-header{height:70px}.creator-studio-main{padding:35px 0 60px}.creator-studio-title{align-items:flex-start;flex-direction:column}.creator-metrics{grid-template-columns:1fr;gap:9px}.creator-metrics article{padding:16px;gap:8px}.creator-metrics article strong{font-size:26px}.creator-form{grid-template-columns:1fr}.creator-upload-form .creator-file-label,.creator-upload-form>button{grid-column:auto}.creator-video-row{align-items:flex-start;flex-wrap:wrap}.creator-video-info{flex-basis:calc(100% - 60px)}.creator-video-stat{text-align:left}.creator-video-row>.creator-status{margin-left:auto}}
'@
$css += $cssAppend
[System.IO.File]::WriteAllText((Resolve-Path $cssPath), $css, [System.Text.UTF8Encoding]::new($false))

Write-Host "Creator Studio patch applied." -ForegroundColor Green
Write-Host "Backup: $backup" -ForegroundColor Cyan
Write-Host "Next run: node --check .\server\src\routes\edits.js; node --check .\server\src\routes\creators.js; npm run build --prefix .\client" -ForegroundColor Yellow
