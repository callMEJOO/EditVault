import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, CalendarDays, Copy, ExternalLink, Link2, ShieldCheck, UserRound } from 'lucide-react';
import './community-profile.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function CommunityProfile({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return undefined;
    const controller = new AbortController();
    setLoading(true); setError(''); setProfile(null); setCopied(false);
    fetch(`${API_URL}/api/community/u/${encodeURIComponent(username)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load this profile.');
        return data.user;
      })
      .then(setProfile)
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message || 'Could not load profile.'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [username]);

  if (!username) return null;
  const profileUrl = `${window.location.origin}/u/${encodeURIComponent(profile?.username || username)}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the link automatically. Copy it from the address bar.');
    }
  };

  return (
    <div className="ev-community-backdrop" role="dialog" aria-modal="true" aria-label="Community profile">
      <section className="ev-community-card">
        <div className="ev-community-topbar">
          <button type="button" className="ev-community-back" onClick={onClose}><ArrowLeft size={16}/> Back to EditVault</button>
          <span className="ev-community-brand"><span className="ev-community-brand-dot">E</span> EDIT<span>VAULT</span></span>
        </div>
        {loading ? <div className="ev-community-state"><span className="ev-community-loader" />Loading profile…</div> :
          error && !profile ? <div className="ev-community-state is-error">{error}<button type="button" onClick={onClose}>Close</button></div> :
          profile && <>
            <div className="ev-community-cover-wrap">
              <div className="ev-community-cover" style={profile.cover_data_url ? { backgroundImage: `url("${profile.cover_data_url}")` } : undefined}>
                <div className="ev-community-cover-shade" />
                <span className="ev-community-cover-label">COMMUNITY PROFILE</span>
              </div>
            </div>
            <div className="ev-community-identity">
              <div className="ev-community-avatar">{profile.avatar_data_url ? <img src={profile.avatar_data_url} alt={`${profile.display_name || profile.username} avatar`} /> : <UserRound size={38}/>}</div>
              <div className="ev-community-names">
                <h1>{profile.display_name || profile.username}</h1>
                <p className="ev-community-handle">@{profile.username}</p>
                {profile.role === 'creator' && profile.verification_status === 'verified' &&
                  <span className="ev-community-badge"><BadgeCheck size={14}/> Verified creator</span>}
              </div>
              <div className="ev-community-actions">
                <button type="button" onClick={copyLink} className="ev-community-action-primary"><Copy size={15}/>{copied ? 'Copied link' : 'Copy profile link'}</button>
                <button type="button" onClick={() => { window.location.href = profileUrl; }} className="ev-community-action-secondary"><ExternalLink size={15}/> Open full link</button>
              </div>
            </div>
            <div className="ev-community-content">
              <section className="ev-community-about">
                <div className="ev-community-section-title"><span className="ev-community-section-icon"><UserRound size={16}/></span><div><h2>About</h2><p>A little introduction</p></div></div>
                <p className="ev-community-bio">{profile.bio || 'This member has not added a bio yet.'}</p>
              </section>
              <aside className="ev-community-info">
                <div className="ev-community-info-row"><ShieldCheck size={17}/><span><strong>Profile status</strong><small>Public EditVault profile</small></span></div>
                <div className="ev-community-info-row"><CalendarDays size={17}/><span><strong>Member since</strong><small>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'EditVault member'}</small></span></div>
                <div className="ev-community-info-row"><Link2 size={17}/><span><strong>Profile address</strong><small className="ev-community-url">{profileUrl}</small></span></div>
              </aside>
            </div>
            {error && <p className="ev-community-inline-error">{error}</p>}
            <footer className="ev-community-footer"><span>Made for creators and the people who support them.</span><span>EDITVAULT · COMMUNITY</span></footer>
          </>}
      </section>
    </div>
  );
}
