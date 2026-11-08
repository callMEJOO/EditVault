import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, UserRound } from 'lucide-react';
import './community-profile.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function CommunityProfile({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return undefined;
    const controller = new AbortController();
    setLoading(true); setError(''); setProfile(null);
    fetch(`${API_URL}/api/community/u/${encodeURIComponent(username)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load profile.');
        return data.user;
      })
      .then(setProfile)
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message || 'Could not load profile.'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [username]);

  if (!username) return null;
  return (
    <div className="ev-community-backdrop" role="dialog" aria-modal="true" aria-label="Community profile">
      <section className="ev-community-card">
        <button type="button" className="ev-community-back" onClick={onClose}><ArrowLeft size={16}/> Back</button>
        {loading ? <p className="ev-community-state">Loading profile…</p> : error ? <p className="ev-community-state is-error">{error}</p> : profile && <>
          <div className="ev-community-cover" style={profile.cover_data_url ? { backgroundImage: `url("${profile.cover_data_url}")` } : undefined}/>
          <div className="ev-community-identity">
            <div className="ev-community-avatar">{profile.avatar_data_url ? <img src={profile.avatar_data_url} alt="Profile avatar"/> : <UserRound size={34}/>}</div>
            <div className="ev-community-names">
              <h1>{profile.display_name || profile.username}</h1>
              <p>@{profile.username}</p>
              {profile.role === 'creator' && profile.verification_status === 'verified' && <span className="ev-community-badge"><BadgeCheck size={14}/> Verified creator</span>}
            </div>
          </div>
          <div className="ev-community-bio">{profile.bio || 'This user has not added a bio yet.'}</div>
          <div className="ev-community-meta">Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'EditVault member'}</div>
        </>}
      </section>
    </div>
  );
}
