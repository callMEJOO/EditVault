import React, { useEffect, useRef, useState } from 'react';
import './compact-profile-settings.css';
import { X, UserRound, RefreshCw, Save, ExternalLink, Users, CheckCircle2, Camera, Trash2, BadgeCheck } from 'lucide-react';

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

async function compressProfilePhoto(file) {
  if (!file) throw new Error('Choose a photo first.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image could not be opened.'));
    });
    const maxSide = 360;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    if (dataUrl.length > 350000) {
      const fallbackScale = Math.min(1, 280 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * fallbackScale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * fallbackScale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    }
    if (dataUrl.length > 350000) throw new Error('This photo is too detailed to upload. Choose a smaller image.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}


async function compressProfileCover(file) {
  if (!file) throw new Error('Choose a cover image first.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = sourceUrl;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This cover image could not be opened.')); });
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this cover.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.78, result = canvas.toDataURL('image/jpeg', quality);
    while (result.length > 950000 && quality > 0.42) { quality -= 0.08; result = canvas.toDataURL('image/jpeg', quality); }
    if (result.length > 950000) throw new Error('This cover is too large after compression. Choose another image.');
    return result;
  } finally { URL.revokeObjectURL(sourceUrl); }
}

export default function ProfileSettings({ open, onClose, user, onNotice, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [coverDraft, setCoverDraft] = useState(null);
  const coverInputRef = useRef(null);
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);
  const [error, setError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!open || !user) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [response, mediaResponse, communityResponse] = await Promise.all([
          fetch(`${API_URL}/api/studio/profile/me`, { headers: authHeaders() }),
          fetch(`${API_URL}/api/profile/me`, { headers: authHeaders() }),
          fetch(`${API_URL}/api/community/me`, { headers: authHeaders() }),
        ]);
        const [data, mediaData, communityData] = await Promise.all([readJson(response), readJson(mediaResponse), readJson(communityResponse)]);
        if (cancelled) return;
        const next = { ...(data.user || data), ...(mediaData.user || {}), ...(communityData.user || {}) };
        setProfile(next);
        setUsername(next.username || '');
        setBio(next.bio || '');
        setProfileVisibility(next.profile_visibility || 'public');
        setCoverDraft(null);
        setAvatarDraft(null);
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
      const next = { ...profile, ...(data.user || data) };
      setProfile(next);
      onUserUpdate?.(next);
      onNotice?.(data.message || 'TikTok followers refreshed.');
    } catch (requestError) {
      setError(requestError.message || 'Could not refresh TikTok followers.');
    } finally {
      setRefreshing(false);
    }
  };

  const currentAvatar = avatarDraft !== null ? avatarDraft : (profile?.avatar_data_url || '');

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const compressed = await compressProfilePhoto(file);
      setAvatarDraft(compressed);
    } catch (photoError) {
      setError(photoError.message || 'Could not prepare this photo.');
    }
  };


  const handleCoverFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try { setCoverDraft(await compressProfileCover(file)); }
    catch (coverError) { setError(coverError.message || 'Could not prepare this cover.'); }
  };

  const saveAvatar = async () => {
    if (avatarDraft === null || avatarBusy) return;
    setAvatarBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/profile/avatar`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarDataUrl: avatarDraft || null }),
      });
      const data = await readJson(response);
      const next = { ...profile, ...(data.user || {}) };
      setProfile(next);
      setAvatarDraft(null);
      onUserUpdate?.(next);
      onNotice?.(data.message || 'Profile photo updated.');
    } catch (requestError) {
      setError(requestError.message || 'Could not save your profile photo.');
    } finally {
      setAvatarBusy(false);
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
      let next = { ...profile, ...(data.user || {}) };
      const communityResponse = await fetch(`${API_URL}/api/community/me`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          bio: bio.trim(),
          profileVisibility,
          ...(coverDraft !== null ? { coverDataUrl: coverDraft || null } : {}),
        }),
      });
      const communityData = await readJson(communityResponse);
      next = { ...next, ...(communityData.user || {}) };
      setProfile(next);
      setCoverDraft(null);
      setUsername(next.username || username);
      setBio(next.bio || bio);
      setProfileVisibility(next.profile_visibility || profileVisibility);
      onUserUpdate?.(next);

      onNotice?.(data.message || 'Profile saved.');
    } catch (requestError) {
      setError(requestError.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };


  const followers = profile?.tiktok_followers;
  const updatedAt = profile?.tiktok_followers_updated_at;
  const currentCover = coverDraft !== null ? coverDraft : (profile?.cover_data_url || '');
  const communityProfileUrl = `${window.location.origin}/u/${encodeURIComponent((username || 'your_username').trim().toLowerCase())}`;

  return (
    <div className="profile-settings-backdrop evcp-backdrop" onClick={onClose}>
      <section className="profile-settings-modal evcp-modal" role="dialog" aria-modal="true" aria-label="Edit profile" onClick={(event) => event.stopPropagation()}>
        <header className="evcp-header">
          <div className="evcp-header-avatar">
            {currentAvatar ? <img src={currentAvatar} alt="" /> : <UserRound size={22} />}
          </div>
          <div className="evcp-heading-copy">
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h2>Edit profile</h2>
            <p>Keep your public identity up to date.</p>
          </div>
          <button className="profile-settings-close evcp-close" type="button" onClick={onClose} aria-label="Close profile settings"><X size={18} /></button>
        </header>

        {loading ? <div className="profile-settings-state evcp-state">Loading profile…</div> : (
          <form className="profile-settings-form evcp-form" onSubmit={saveProfile}>
            <section className="evcp-photo-row">
              <div className="evcp-avatar">
                {currentAvatar ? <img src={currentAvatar} alt="Profile photo preview" /> : <UserRound size={26} />}
              </div>
              <div className="evcp-photo-copy">
                <strong>Profile photo</strong>
                <small>Square images work best.</small>
                <div className="evcp-actions-inline">
                  <label className="profile-photo-pick evcp-button">
                    Change
                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} aria-label="Choose profile photo" />
                  </label>
                  {currentAvatar && <button type="button" className="profile-photo-remove evcp-button" onClick={() => setAvatarDraft('')} disabled={avatarBusy}>Remove</button>}
                  {avatarDraft !== null && <button type="button" className="profile-photo-save evcp-button" onClick={saveAvatar} disabled={avatarBusy}>{avatarBusy ? 'Saving…' : 'Save photo'}</button>}
                </div>
              </div>
            </section>

            <div className="evcp-field-grid">
              <label className="evcp-field">Display name
                <input required minLength={2} maxLength={50} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
              </label>
              <label className="evcp-field">Username
                <input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24))} placeholder="your_username" />
              </label>
            </div>

            <section className="evcp-link-row" aria-label="Your profile link">
              <div className="evcp-link-copy">
                <span>PROFILE LINK</span>
                <code>{communityProfileUrl}</code>
              </div>
              <button type="button" className="evcp-small-button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(communityProfileUrl);
                  setLinkCopied(true);
                  onNotice?.('Profile link copied.');
                  window.setTimeout(() => setLinkCopied(false), 1800);
                } catch {
                  setError('Copy was blocked by the browser. Select the profile link and copy it manually.');
                }
              }}><ExternalLink size={13} /> {linkCopied ? 'Copied' : 'Copy link'}</button>
              {profileVisibility === 'private' && <small className="evcp-private-note">Private profile — other people cannot open this link.</small>}
            </section>

            <label className="evcp-field evcp-bio-field">Bio <span>{bio.length}/300</span>
              <textarea maxLength={300} rows={2} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short introduction…" />
            </label>

            <section className="evcp-cover-section">
              <div className="evcp-cover-top">
                <div><strong>Profile cover</strong><small>Optional · wide image recommended</small></div>
                <div className="evcp-actions-inline">
                  <label className="profile-photo-pick evcp-button">
                    {currentCover ? 'Change' : 'Add cover'}
                    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverFile} aria-label="Choose profile cover" />
                  </label>
                  {currentCover && <button type="button" className="profile-photo-remove evcp-button" onClick={() => setCoverDraft('')} disabled={saving}>Remove</button>}
                </div>
              </div>
              {currentCover ? <img className="evcp-cover-preview" src={currentCover} alt="Profile cover preview" /> :
                <div className="evcp-cover-empty"><span>No cover image</span></div>}
            </section>

            <div className="evcp-privacy-row">
              <div><strong>Profile visibility</strong><small>Choose who can see your profile.</small></div>
              <select value={profileVisibility} onChange={(event) => setProfileVisibility(event.target.value)} aria-label="Profile visibility">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            {(profile?.role === 'creator' || profile?.role === 'admin') && (
              <details className="evcp-advanced">
                <summary><span>Creator details</span><small>TikTok link and follower stats</small></summary>
                <div className="evcp-advanced-content">
                  <label className="evcp-field">TikTok profile URL
                    <input type="url" value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://www.tiktok.com/@username" />
                  </label>
                  <div className="evcp-followers-row">
                    <div><span>TikTok followers</span><strong>{followers === null || followers === undefined ? 'Not synced yet' : Number(followers).toLocaleString()}</strong><small>{updatedAt ? `Last synced ${new Date(updatedAt).toLocaleString()}` : 'No successful sync yet'}</small></div>
                    {updatedAt && <CheckCircle2 size={16} className="profile-settings-success-icon" />}
                    <button type="button" className="evcp-small-button" onClick={refreshFollowers} disabled={refreshing || saving || !profile?.tiktok_url}>
                      <RefreshCw size={13} className={refreshing ? 'profile-settings-spinning' : ''}/>{refreshing ? 'Refreshing' : 'Refresh'}
                    </button>
                  </div>
                </div>
              </details>
            )}

            {error && <div className="profile-settings-error evcp-error" role="alert">{error}</div>}

            <footer className="evcp-footer">
              <button className="evcp-cancel" type="button" onClick={onClose}>Cancel</button>
              <button className="primary-cta evcp-save" type="submit" disabled={saving || loading || !profile}>
                <Save size={15} /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
