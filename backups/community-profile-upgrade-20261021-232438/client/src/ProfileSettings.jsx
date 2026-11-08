import React, { useEffect, useRef, useState } from 'react';
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

export default function ProfileSettings({ open, onClose, user, onNotice, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [response, mediaResponse] = await Promise.all([
          fetch(`${API_URL}/api/studio/profile/me`, { headers: authHeaders() }),
          fetch(`${API_URL}/api/profile/me`, { headers: authHeaders() }),
        ]);
        const [data, mediaData] = await Promise.all([readJson(response), readJson(mediaResponse)]);
        if (cancelled) return;
        const next = { ...(data.user || data), ...(mediaData.user || {}) };
        setProfile(next);
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
          next = { ...next, ...(refreshData.user || {}) };
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

        {loading ? <div className="profile-settings-state">Loading profileâ€¦</div> : (
          <form className="profile-settings-form" onSubmit={saveProfile}>
            <section className="profile-photo-card" aria-label="Profile photo">
              <div className="profile-photo-preview">
                {currentAvatar ? <img src={currentAvatar} alt="Profile preview" /> : <span>{String(displayName || user?.email || 'U').trim().charAt(0).toUpperCase()}</span>}
                <span className="profile-photo-camera"><Camera size={15} /></span>
              </div>
              <div className="profile-photo-main">
                <strong>Profile photo</strong>
                <small>Shown beside your name and on your public creator page after approval.</small>
                <div className="profile-photo-actions">
                  <label className="profile-photo-pick">Choose photo
                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} aria-label="Choose profile photo" />
                  </label>
                  {currentAvatar && <button type="button" className="profile-photo-remove" onClick={() => setAvatarDraft('')} disabled={avatarBusy}><Trash2 size={13} /> Remove</button>}
                  {avatarDraft !== null && <button type="button" className="profile-photo-save" onClick={saveAvatar} disabled={avatarBusy}>{avatarBusy ? 'Saving…' : <><Save size={13} /> Save photo</>}</button>}
                </div>
              </div>
            </section>

            {profile?.role === 'creator' && <div className="profile-role-notice is-creator"><BadgeCheck size={16} /><span><strong>Creator access approved</strong><small>Your public profile settings are managed separately from creator access.</small></span></div>}

            <label>Public page name
              <input required minLength={2} maxLength={50} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your creator name" />
            </label>
            <label>TikTok profile URL
              <input type="url" value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://www.tiktok.com/@username" />
              <small>This URL and follower information belong to your public profile only.</small>
            </label>

            <div className="profile-settings-followers">
              <div className="profile-settings-followers-icon"><Users size={19} /></div>
              <div className="profile-settings-followers-copy">
                <span>TikTok followers</span>
                <strong>{followers === null || followers === undefined ? 'Not synced yet' : Number(followers).toLocaleString()}</strong>
                <small>{updatedAt ? `Last synced ${new Date(updatedAt).toLocaleString()}` : 'No successful sync yet'}</small>
              </div>
              {updatedAt && <CheckCircle2 className="profile-settings-success-icon" size={18} />}
            </div>
            <p className="profile-settings-help">Follower count is fetched from the public TikTok profile using Apify. It can be delayed or unavailable if TikTok or the Actor blocks the request.</p>

            <div className="profile-settings-help profile-settings-profile-note">Creator applications are handled separately from these public profile settings. Changing this name, photo, or TikTok link will not submit or change an application.</div>

            {error && <div className="profile-settings-error" role="alert">{error}</div>}

            <div className="profile-settings-actions">
              <button className="primary-cta" type="submit" disabled={saving || loading || !profile}>
                <Save size={16} /> {saving ? 'Savingâ€¦' : 'Save profile'}
              </button>
              <button className="secondary-cta" type="button" onClick={refreshFollowers} disabled={refreshing || saving || !profile?.tiktok_url}>
                <RefreshCw size={16} className={refreshing ? 'profile-settings-spinning' : ''} /> {refreshing ? 'Refreshingâ€¦' : 'Refresh followers'}
              </button>
            </div>
            {profile?.tiktok_url && <a className="profile-settings-tiktok-link" href={profile.tiktok_url} target="_blank" rel="noreferrer">Open TikTok profile <ExternalLink size={14} /></a>}
          </form>
        )}
      </section>
    </div>
  );
}