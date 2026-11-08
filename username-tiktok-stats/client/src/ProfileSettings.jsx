import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Save, UserRound, X, Users } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  return data;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export default function ProfileSettings({ open, onClose, user, onNotice, onUserUpdate }) {
  const [form, setForm] = useState({ displayName: '', tiktokUrl: '' });
  const [followerCount, setFollowerCount] = useState(null);
  const [savedTikTokUrl, setSavedTikTokUrl] = useState('');
  const [followersUpdatedAt, setFollowersUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statsMessage, setStatsMessage] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('not requested');

  useEffect(() => {
    if (!open || !user) return undefined;
    const controller = new AbortController();
    const loadProfile = async () => {
      setLoading(true);
      setError('');
      setStatsMessage('');
      try {
        const token = localStorage.getItem('editvault_token');
        if (!token) throw new Error('Sign in again to edit your profile.');
        const response = await fetch(`${API_URL}/api/studio/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await readJson(response);
        const profile = data.user || data;
        setForm({
          displayName: profile.display_name || profile.displayName || '',
          tiktokUrl: profile.tiktok_url || '',
        });
        setSavedTikTokUrl(profile.tiktok_url || '');
        setFollowerCount(profile.tiktok_followers_updated_at ? Number(profile.tiktok_followers || 0) : null);
        setFollowersUpdatedAt(profile.tiktok_followers_updated_at || null);
        setVerificationStatus(profile.verification_status || 'not requested');
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load your profile.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadProfile();
    return () => controller.abort();
  }, [open, user]);

  if (!open) return null;

  const getToken = () => {
    const token = localStorage.getItem('editvault_token');
    if (!token) throw new Error('Sign in again to edit your profile.');
    return token;
  };

  const fetchFollowerStats = async ({ silent = false } = {}) => {
    setStatsLoading(true);
    setStatsMessage('');
    setError('');
    try {
      if (!form.tiktokUrl.trim()) throw new Error('Add your TikTok profile URL and save it first.');
      const response = await fetch(`${API_URL}/api/studio/profile/refresh-tiktok`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await readJson(response);
      const profile = data.user || {};
      setFollowerCount(Number(profile.tiktok_followers || 0));
      setFollowersUpdatedAt(profile.tiktok_followers_updated_at || null);
      onUserUpdate?.({ ...user, ...profile, displayName: profile.display_name || form.displayName });
      setStatsMessage(data.message || 'Follower count updated from the public profile.');
      if (!silent) onNotice?.(data.message || 'TikTok follower count updated.');
      return true;
    } catch (requestError) {
      const message = requestError.message || 'Could not look up TikTok follower stats.';
      setStatsMessage(message);
      if (!silent) onNotice?.(message);
      return false;
    } finally {
      setStatsLoading(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setStatsMessage('');
    try {
      const response = await fetch(`${API_URL}/api/studio/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          tiktokUrl: form.tiktokUrl.trim(),
        }),
      });
      const data = await readJson(response);
      const profile = data.user || {};
      setForm({
        displayName: profile.display_name || form.displayName.trim(),
        tiktokUrl: profile.tiktok_url || '',
      });
      setSavedTikTokUrl(profile.tiktok_url || '');
      setFollowerCount(profile.tiktok_followers_updated_at ? Number(profile.tiktok_followers || 0) : null);
      setFollowersUpdatedAt(profile.tiktok_followers_updated_at || null);
      setVerificationStatus(profile.verification_status || verificationStatus);
      onUserUpdate?.({ ...user, ...profile, displayName: profile.display_name || form.displayName.trim() });
      onNotice?.(data.message || 'Profile saved.');
      if (profile.tiktok_url) {
        // Automatically try the username lookup after saving the public profile URL.
        await fetchFollowerStats({ silent: true });
      } else {
        setStatsMessage('Profile saved. Add a public TikTok URL to look up followers automatically.');
      }
    } catch (requestError) {
      const message = requestError.message || 'Could not save your profile.';
      setError(message);
      onNotice?.(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-settings-backdrop" role="dialog" aria-modal="true" aria-label="Profile settings" onClick={onClose}>
      <section className="profile-settings-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="profile-settings-close" onClick={onClose} aria-label="Close profile settings"><X size={19} /></button>
        <div className="profile-settings-icon"><UserRound size={22} /></div>
        <div className="eyebrow">EDITVAULT / YOUR ACCOUNT</div>
        <h2>Profile <span>settings</span></h2>
        <p className="profile-settings-copy">Set the public name and TikTok profile URL shown on your creator page. Your TikTok account is not connected, and visitors never need to log in with TikTok. Follower stats are looked up from the public profile through a third-party provider.</p>

        {error && <div className="profile-settings-error" role="alert">{error}</div>}
        {loading ? <div className="profile-settings-loading">Loading your profile…</div> : (
          <form className="profile-settings-form" onSubmit={saveProfile}>
            <label>
              Public page name
              <input required minLength={2} maxLength={50} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Your creator name" />
            </label>
            <label>
              TikTok username or profile URL
              <input type="text" value={form.tiktokUrl} onChange={(event) => setForm({ ...form, tiktokUrl: event.target.value })} placeholder="@username or https://www.tiktok.com/@username" />
              <small>Public accounts only. No TikTok login, password, or account permissions are requested.</small>
            </label>

            <div className="profile-settings-followers-card">
              <div className="profile-settings-followers-title"><Users size={17} /> TikTok followers</div>
              <strong className="profile-settings-followers-count">{followerCount === null ? 'Not fetched yet' : Number(followerCount).toLocaleString()}</strong>
              <small>{followersUpdatedAt ? `Last fetched ${formatDate(followersUpdatedAt)}.` : 'The follower count will be fetched from the username after you save your profile.'}</small>
              <button type="button" className="profile-settings-refresh" disabled={saving || statsLoading || !form.tiktokUrl.trim() || form.tiktokUrl.trim() !== savedTikTokUrl} onClick={() => fetchFollowerStats()}>
                <RefreshCw size={15} className={statsLoading ? 'is-spinning' : ''} />
                {statsLoading ? 'Looking up followers…' : 'Fetch / refresh followers'}
              </button>
              <small className="profile-settings-provider-note">Save the profile URL before fetching. To control API usage, refresh is limited to once every 6 hours. Counts can be delayed or unavailable if the provider cannot read the public profile.</small>
              {statsMessage && <div className="profile-settings-stats-message" role="status">{statsMessage}</div>}
            </div>

            <div className="profile-settings-status">TikTok verification status on EditVault: <strong>{verificationStatus}</strong></div>
            {form.tiktokUrl.trim() && /^https?:\/\//i.test(form.tiktokUrl.trim()) && <a className="profile-settings-tiktok-link" href={form.tiktokUrl.trim()} target="_blank" rel="noreferrer">Open TikTok profile <ExternalLink size={14} /></a>}
            <button type="submit" className="primary-cta profile-settings-save" disabled={saving || loading}>{saving ? 'Saving profile…' : 'Save profile'} <Save size={16} /></button>
          </form>
        )}
      </section>
    </div>
  );
}
