$ErrorActionPreference = 'Stop'

$projectRoot = (Get-Location).Path
$mainPath = Join-Path $projectRoot 'client\src\main.jsx'
$studioPath = Join-Path $projectRoot 'server\src\routes\studio.js'
$creatorStudioPath = Join-Path $projectRoot 'client\src\CreatorStudio.jsx'
$publicProfilePath = Join-Path $projectRoot 'client\src\PublicCreatorProfile.jsx'
$profileComponentPath = Join-Path $projectRoot 'client\src\ProfileSettings.jsx'
$stylesPath = Join-Path $projectRoot 'client\src\styles.css'

foreach ($path in @($mainPath, $studioPath, $creatorStudioPath, $publicProfilePath, $stylesPath)) {
  if (-not (Test-Path $path)) { throw "Required file not found: $path. Run this script from the EditVault project root." }
}

$main = [System.IO.File]::ReadAllText($mainPath)
$studio = [System.IO.File]::ReadAllText($studioPath)
$creatorStudio = [System.IO.File]::ReadAllText($creatorStudioPath)
$publicProfile = [System.IO.File]::ReadAllText($publicProfilePath)
$styles = [System.IO.File]::ReadAllText($stylesPath)
# Normalize line endings so exact matching works with both Windows and Unix-formatted source files.
$main = $main.Replace("`r`n", "`n")
$studio = $studio.Replace("`r`n", "`n")
$creatorStudio = $creatorStudio.Replace("`r`n", "`n")
$publicProfile = $publicProfile.Replace("`r`n", "`n")
$styles = $styles.Replace("`r`n", "`n")

# Prepare main.jsx changes, failing safely if the source differs from the expected project version.
$old = "import CreatorStudio from './CreatorStudio.jsx';"
if (-not $main.Contains($old)) { throw 'Could not find the CreatorStudio import in main.jsx; no files have been changed.' }
$main = $main.Replace($old, "$old`nimport ProfileSettings from './ProfileSettings.jsx';")

$old = '  const [creatorStudioOpen, setCreatorStudioOpen] = useState(false);'
if (-not $main.Contains($old)) { throw 'Could not find creatorStudioOpen state in main.jsx; no files have been changed.' }
$main = $main.Replace($old, "$old`n  const [profileOpen, setProfileOpen] = useState(false);")

$old = '      <CreatorStudio open={creatorStudioOpen} onClose={() => setCreatorStudioOpen(false)} user={user} onNotice={setNotice} />'
if (-not $main.Contains($old)) { throw 'Could not find the CreatorStudio render in main.jsx; no files have been changed.' }
$new = '      <ProfileSettings open={profileOpen} onClose={() => setProfileOpen(false)} user={user} onNotice={setNotice} onUserUpdate={(updatedUser) => setUser((current) => ({ ...current, ...updatedUser }))} />' + "`n" + $old.Replace('onNotice={setNotice} />', 'onNotice={setNotice} onOpenProfile={() => setProfileOpen(true)} />')
$main = $main.Replace($old, $new)

$old = @'
              </span>

              <button className="login-btn" onClick={logout}>
'@
if (-not $main.Contains($old)) { throw 'Could not find the signed-in topbar block in main.jsx; no files have been changed.' }
$new = @'
              </span>

              <button className="login-btn" onClick={() => setProfileOpen(true)}>
                Profile
              </button>

              <button className="login-btn" onClick={logout}>
'@
$main = $main.Replace($old, $new)

# Move the public profile controls out of Creator Studio while retaining a link and verification status.
$oldProps = 'export default function CreatorStudio({ open, onClose, user, onNotice }) {'
if (-not $creatorStudio.Contains($oldProps)) { throw 'Could not find CreatorStudio component props; no files have been changed.' }
$creatorStudio = $creatorStudio.Replace($oldProps, 'export default function CreatorStudio({ open, onClose, user, onNotice, onOpenProfile }) {')
$startMarker = '            <section className="cs-panel">'
$publishMarker = '<div className="eyebrow">PUBLISH NEW WORK</div><h3>Upload an edit</h3>'
$publishAt = $creatorStudio.IndexOf($publishMarker)
if ($publishAt -lt 0) { throw 'Could not find the Publish New Work panel in CreatorStudio.jsx; no files have been changed.' }
$firstPanelStart = $creatorStudio.IndexOf($startMarker)
$secondPanelStart = $creatorStudio.LastIndexOf($startMarker, $publishAt)
if ($firstPanelStart -lt 0 -or $secondPanelStart -le $firstPanelStart) { throw 'Could not safely locate the public-profile panel in CreatorStudio.jsx; no files have been changed.' }
$profilePanel = @'
            <section className="cs-panel">
              <div className="cs-panel-heading"><div><div className="eyebrow">PROFILE SETTINGS</div><h3>Public profile & verification</h3></div><UserRound size={20} /></div>
              <p className="cs-panel-copy">Your public name and TikTok details are now managed from Profile.</p>
              {profile?.verification_note && <div className="cs-note">Admin note: {profile.verification_note}</div>}
              <div className="cs-verification-hint">Verification status: <strong>{profile?.verification_status || 'not requested'}</strong></div>
              <button type="button" className="primary-cta cs-submit" onClick={() => onOpenProfile?.()}>Open Profile Settings <ExternalLink size={15} /></button>
            </section>

'@
$creatorStudio = $creatorStudio.Substring(0, $firstPanelStart) + $profilePanel + $creatorStudio.Substring($secondPanelStart)

# Do not mark a profile count as synced merely because the profile was saved; only successful Apify syncs set this timestamp.
$oldTimestampSql = @'
           tiktok_followers_updated_at = CASE
             WHEN tiktok_followers IS DISTINCT FROM $3::bigint OR tiktok_followers_updated_at IS NULL THEN NOW()
             ELSE tiktok_followers_updated_at
           END,
'@
$newTimestampSql = @'
           tiktok_followers_updated_at = CASE
             WHEN tiktok_followers IS DISTINCT FROM $3::bigint THEN NOW()
             ELSE tiktok_followers_updated_at
           END,
'@
if (-not $studio.Contains($oldTimestampSql)) { throw 'Could not find the follower timestamp SQL block in studio.js; no files have been changed.' }
$studio = $studio.Replace($oldTimestampSql, $newTimestampSql)

# Add the Apify-backed refresh endpoint at the end of studio.js.
$marker = 'module.exports = router;'
if (-not $studio.Contains($marker)) { throw 'Could not find module.exports = router; in server/src/routes/studio.js; no files have been changed.' }
if ($studio.Contains("'/profile/refresh-followers'")) { throw 'The TikTok follower refresh route already exists in studio.js. No files have been changed to avoid duplicating it.' }
$route = @'

// Fetch public TikTok profile follower data via Apify. APIFY_API_TOKEN must stay server-side.
const apifyFollowerRefreshTimes = new Map();
router.post('/profile/refresh-followers', auth, async (req, res, next) => {
  try {
    const apifyToken = String(process.env.APIFY_API_TOKEN || '').trim();
    if (!apifyToken) {
      return res.status(503).json({ error: 'Apify is not configured. Add APIFY_API_TOKEN to server/.env and restart the API.' });
    }
    const refreshKey = String(req.user.id);
    const lastRefreshAt = apifyFollowerRefreshTimes.get(refreshKey) || 0;
    if (Date.now() - lastRefreshAt < 30000) {
      return res.status(429).json({ error: 'Please wait 30 seconds before refreshing TikTok followers again.' });
    }
    apifyFollowerRefreshTimes.set(refreshKey, Date.now());

    const { rows: accountRows } = await db.query(
      `SELECT id, tiktok_url FROM users WHERE id = $1`,
      [req.user.id]
    );
    const account = accountRows[0];
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    if (!account.tiktok_url) return res.status(400).json({ error: 'Save your TikTok profile URL in Profile first.' });

    let username = '';
    try {
      const parsedUrl = new URL(account.tiktok_url);
      const match = parsedUrl.pathname.match(/^\/@([^/]+)/);
      if (match) username = decodeURIComponent(match[1]).replace(/^@/, '').trim();
    } catch { /* handled by the validation below */ }
    if (!username) return res.status(400).json({ error: 'The saved TikTok URL does not contain a valid username.' });

    const apifyUrl = new URL('https://api.apify.com/v2/acts/webdatatools~tiktok-profile-scraper/run-sync-get-dataset-items');
    apifyUrl.searchParams.set('token', apifyToken);
    apifyUrl.searchParams.set('timeout', '120');

    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ profiles: [username] }),
      signal: AbortSignal.timeout(180000),
    });
    const apifyBody = await apifyResponse.json().catch(() => null);
    if (!apifyResponse.ok) {
      console.error('Apify TikTok profile request failed with status:', apifyResponse.status);
      return res.status(502).json({ error: `Apify request failed (${apifyResponse.status}). Check the API token, Actor access, and Apify usage limits.` });
    }

    const items = Array.isArray(apifyBody) ? apifyBody : (Array.isArray(apifyBody?.items) ? apifyBody.items : []);
    const normalizedUsername = username.toLowerCase();
    const usableItems = items.filter((item) => item && item.followers !== null && item.followers !== undefined && Number.isSafeInteger(Number(item.followers)) && Number(item.followers) >= 0);
    const result = usableItems.find((item) => String(item.username || '').replace(/^@/, '').toLowerCase() === normalizedUsername)
      || (usableItems.length === 1 ? usableItems[0] : null);
    if (!result) {
      return res.status(502).json({ error: 'Apify returned no usable follower count for this TikTok profile. Check the username, account visibility, and Actor output.' });
    }

    const followers = Number(result.followers);
    const { rows } = await db.query(
      `UPDATE users
       SET tiktok_followers = $1, tiktok_followers_updated_at = NOW()
       WHERE id = $2
       RETURNING id, display_name, role, tiktok_url, tiktok_followers,
                 tiktok_followers_updated_at, verification_status, verification_note`,
      [followers, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found after updating follower count.' });

    return res.json({
      user: { ...rows[0], tiktok_followers: Number(rows[0].tiktok_followers || 0) },
      message: `TikTok followers refreshed: ${followers.toLocaleString('en-US')}.`,
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Apify took too long to respond. Try refreshing again later.' });
    }
    next(error);
  }
});
'@
$studio = $studio.Replace($marker, $route + "`n" + $marker)

# Update public creator labels to describe automatically fetched data when these strings are present.
$publicProfile = $publicProfile.Replace('<em>creator-reported</em>', '<em>auto-synced</em>')
$publicProfile = $publicProfile.Replace('TikTok follower counts on this page are entered by the creator and are not independently verified by TikTok.', 'TikTok follower counts are fetched from public profile data and may be delayed or unavailable.')
$publicProfile = $publicProfile.Replace("follower_count_source: 'creator_reported',", "follower_count_source: profileRows[0].tiktok_followers_updated_at ? 'apify_synced' : 'not_synced',")

# Profile component: editable profile name/link, auto-sync status and manual refresh button.
$component = @'
import React, { useEffect, useState } from 'react';
import { X, UserRound, RefreshCw, Save, ExternalLink, Users, CheckCircle2 } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  return data;
}

function authHeaders() {
  const token = localStorage.getItem('editvault_token');
  if (!token) throw new Error('Your session has expired. Log in again.');
  return { Authorization: `Bearer ${token}` };
}

export default function ProfileSettings({ open, onClose, user, onNotice, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/studio/profile/me`, { headers: authHeaders() });
        const data = await readJson(response);
        if (cancelled) return;
        const next = data.user || data;
        setProfile(next);
        setDisplayName(next.display_name || next.displayName || '');
        setTiktokUrl(next.tiktok_url || '');
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Could not load your profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  if (!open) return null;

  const refreshFollowers = async () => {
    setRefreshing(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/profile/refresh-followers`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await readJson(response);
      const next = data.user || data;
      setProfile(next);
      onUserUpdate?.(next);
      onNotice?.(data.message || 'TikTok followers refreshed.');
    } catch (requestError) {
      setError(requestError.message || 'Could not refresh TikTok followers.');
    } finally {
      setRefreshing(false);
    }
  };

  const requestVerification = async () => {
    setRequesting(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/creators/verification-request`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktokUrl: tiktokUrl.trim() }),
      });
      const data = await readJson(response);
      const next = { ...profile, ...(data.user || {}), tiktok_url: data.user?.tiktok_url || tiktokUrl.trim() };
      setProfile(next);
      onUserUpdate?.(next);
      onNotice?.(data.message || 'TikTok verification request submitted.');
    } catch (requestError) {
      setError(requestError.message || 'Could not submit TikTok verification request.');
    } finally {
      setRequesting(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/profile`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          tiktokUrl: tiktokUrl.trim(),
          // The API still expects this field; the user no longer edits it manually.
          tiktokFollowers: Number(profile?.tiktok_followers || 0),
        }),
      });
      const data = await readJson(response);
      let next = data.user || profile;
      setProfile(next);
      onUserUpdate?.(next);

      if (next?.tiktok_url) {
        setRefreshing(true);
        try {
          const refreshResponse = await fetch(`${API_URL}/api/studio/profile/refresh-followers`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          });
          const refreshData = await readJson(refreshResponse);
          next = refreshData.user || next;
          setProfile(next);
          onUserUpdate?.(next);
          onNotice?.(refreshData.message || 'Profile saved and TikTok followers refreshed.');
        } catch (refreshError) {
          setError(`Profile saved, but follower refresh failed: ${refreshError.message}`);
          onNotice?.('Profile saved. TikTok follower refresh failed; check the message in Profile.');
        } finally {
          setRefreshing(false);
        }
      } else {
        onNotice?.(data.message || 'Profile saved.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const followers = profile?.tiktok_followers;
  const updatedAt = profile?.tiktok_followers_updated_at;

  return (
    <div className="profile-settings-backdrop" onClick={onClose}>
      <section className="profile-settings-modal" role="dialog" aria-modal="true" aria-label="Profile settings" onClick={(event) => event.stopPropagation()}>
        <header className="profile-settings-header">
          <div className="profile-settings-title-icon"><UserRound size={21} /></div>
          <div><div className="eyebrow">YOUR ACCOUNT</div><h2>Profile settings</h2><p>Manage the public identity shown on your creator page.</p></div>
          <button className="profile-settings-close" type="button" onClick={onClose} aria-label="Close profile settings"><X size={19} /></button>
        </header>

        {loading ? <div className="profile-settings-state">Loading profile…</div> : (
          <form className="profile-settings-form" onSubmit={saveProfile}>
            <label>Public page name
              <input required minLength={2} maxLength={50} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your creator name" />
            </label>
            <label>TikTok profile URL
              <input type="url" value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://www.tiktok.com/@username" />
              <small>Use the public profile URL, not a video link.</small>
            </label>

            <div className="profile-settings-followers">
              <div className="profile-settings-followers-icon"><Users size={19} /></div>
              <div className="profile-settings-followers-copy">
                <span>TikTok followers</span>
                <strong>{!updatedAt ? 'Not synced yet' : Number(followers || 0).toLocaleString()}</strong>
                <small>{updatedAt ? `Last synced ${new Date(updatedAt).toLocaleString()}` : 'No successful sync yet'}</small>
              </div>
              {updatedAt && <CheckCircle2 className="profile-settings-success-icon" size={18} />}
            </div>
            <p className="profile-settings-help">Follower count is fetched from the public TikTok profile using Apify. It can be delayed or unavailable if TikTok or the Actor blocks the request.</p>

            <div className="profile-settings-verification">
              <div><span>Creator verification</span><strong>{profile?.verification_status || 'not requested'}</strong></div>
              {profile?.verification_note && <p>Admin note: {profile.verification_note}</p>}
              <button className="secondary-cta" type="button" onClick={requestVerification} disabled={requesting || refreshing || saving || !tiktokUrl.trim() || profile?.verification_status === 'pending' || profile?.verification_status === 'verified' || profile?.role === 'admin' || tiktokUrl.trim() !== (profile?.tiktok_url || '')}>
                {profile?.verification_status === 'verified' || profile?.role === 'admin' ? 'TikTok profile verified' : profile?.verification_status === 'pending' ? 'Request pending review' : requesting ? 'Submitting request…' : 'Request TikTok verification'}
              </button>
            </div>

            {error && <div className="profile-settings-error" role="alert">{error}</div>}

            <div className="profile-settings-actions">
              <button className="primary-cta" type="submit" disabled={saving || loading || !profile}>
                <Save size={16} /> {saving ? 'Saving…' : 'Save profile'}
              </button>
              <button className="secondary-cta" type="button" onClick={refreshFollowers} disabled={refreshing || saving || !profile?.tiktok_url}>
                <RefreshCw size={16} className={refreshing ? 'profile-settings-spinning' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh followers'}
              </button>
            </div>
            {profile?.tiktok_url && <a className="profile-settings-tiktok-link" href={profile.tiktok_url} target="_blank" rel="noreferrer">Open TikTok profile <ExternalLink size={14} /></a>}
          </form>
        )}
      </section>
    </div>
  );
}
'@

$cssBlock = @'

/* Profile settings modal */
.profile-settings-backdrop {
  position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center;
  padding: 22px; background: rgba(5, 7, 12, .76); backdrop-filter: blur(9px);
}
.profile-settings-modal {
  width: min(100%, 560px); max-height: min(90vh, 760px); overflow: auto;
  padding: 26px; color: #f4f5fb; background: #151720; border: 1px solid #303341;
  border-radius: 22px; box-shadow: 0 28px 100px rgba(0,0,0,.5);
}
.profile-settings-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 25px; }
.profile-settings-title-icon, .profile-settings-followers-icon {
  display: grid; place-items: center; flex: 0 0 42px; width: 42px; height: 42px;
  border-radius: 13px; color: #c1b5ff; background: rgba(124, 92, 255, .16);
}
.profile-settings-header h2 { margin: 3px 0 5px; font-size: 25px; letter-spacing: -.6px; }
.profile-settings-header p { margin: 0; color: #a7abba; font-size: 13px; line-height: 1.5; }
.profile-settings-close { margin-left: auto; display: grid; place-items: center; width: 36px; height: 36px; color: #b9bdcb; background: #20232e; border: 1px solid #353847; border-radius: 11px; cursor: pointer; }
.profile-settings-form { display: grid; gap: 17px; }
.profile-settings-form label { display: grid; gap: 8px; color: #e5e7f0; font-size: 13px; font-weight: 600; }
.profile-settings-form input { width: 100%; box-sizing: border-box; min-height: 45px; padding: 11px 13px; color: #f6f7fc; background: #0e1016; border: 1px solid #363948; border-radius: 11px; outline: none; }
.profile-settings-form input:focus { border-color: #8e78ff; box-shadow: 0 0 0 3px rgba(142,120,255,.12); }
.profile-settings-form small { color: #9297a9; font-size: 11px; font-weight: 400; }
.profile-settings-followers { display: flex; align-items: center; gap: 12px; padding: 15px; background: #1c1f2a; border: 1px solid #343747; border-radius: 15px; }
.profile-settings-followers-copy { display: grid; gap: 3px; min-width: 0; }
.profile-settings-followers-copy span { color: #bfc3d1; font-size: 12px; }
.profile-settings-followers-copy strong { font-size: 25px; line-height: 1.2; letter-spacing: -.4px; }
.profile-settings-success-icon { margin-left: auto; color: #6ee7b7; }
.profile-settings-help { margin: -8px 0 0; color: #9297a9; font-size: 12px; line-height: 1.55; }
.profile-settings-verification { display: grid; gap: 10px; padding: 14px; background: #171a23; border: 1px solid #333746; border-radius: 13px; }
.profile-settings-verification > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.profile-settings-verification span { color: #bfc3d1; font-size: 12px; }
.profile-settings-verification strong { color: #e7e4ff; font-size: 12px; text-transform: capitalize; }
.profile-settings-verification p { margin: 0; color: #e5b9b9; font-size: 12px; line-height: 1.45; }
.profile-settings-verification button { width: 100%; min-height: 40px; }
.profile-settings-error { padding: 11px 13px; color: #ffc4c4; background: rgba(220, 65, 80, .10); border: 1px solid rgba(220, 65, 80, .34); border-radius: 10px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.profile-settings-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 2px; }
.profile-settings-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; }
.profile-settings-tiktok-link { display: inline-flex; align-items: center; gap: 7px; width: fit-content; color: #c3b8ff; font-size: 12px; text-decoration: none; }
.profile-settings-state { padding: 28px 10px; color: #a7abba; text-align: center; }
.profile-settings-spinning { animation: profile-settings-spin 1s linear infinite; }
@keyframes profile-settings-spin { to { transform: rotate(360deg); } }
@media (max-width: 520px) {
  .profile-settings-backdrop { padding: 10px; }
  .profile-settings-modal { padding: 19px; border-radius: 17px; }
  .profile-settings-actions { display: grid; }
  .profile-settings-actions button { width: 100%; }
}
'@

# Don't overwrite a manually-created component.
if (Test-Path $profileComponentPath) { throw 'client/src/ProfileSettings.jsx already exists. No files have been changed; inspect that file before re-running.' }

# Back up changed files, then write all prepared changes.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($path in @($mainPath, $studioPath, $creatorStudioPath, $publicProfilePath, $stylesPath)) {
  Copy-Item $path "$path.bak-$stamp"
}
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($mainPath, $main, $utf8NoBom)
[System.IO.File]::WriteAllText($studioPath, $studio, $utf8NoBom)
[System.IO.File]::WriteAllText($creatorStudioPath, $creatorStudio, $utf8NoBom)
[System.IO.File]::WriteAllText($publicProfilePath, $publicProfile, $utf8NoBom)
[System.IO.File]::WriteAllText($stylesPath, ($styles + $cssBlock), $utf8NoBom)
[System.IO.File]::WriteAllText($profileComponentPath, $component, $utf8NoBom)

Write-Host ''
Write-Host 'Profile UI and Apify refresh route added.' -ForegroundColor Green
Write-Host "Backups created with suffix: .bak-$stamp" -ForegroundColor Cyan
Write-Host ''
Write-Host 'NEXT: Add APIFY_API_TOKEN=your_token to server/.env (do not put it in client/.env), then restart the API.' -ForegroundColor Yellow
Write-Host 'Actor configured: webdatatools/tiktok-profile-scraper (input: profiles, output: followers).' -ForegroundColor Yellow
