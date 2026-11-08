import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, ExternalLink, Film, Users, X } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function PublicCreatorProfile({ creatorId, onClose, onPreview }) {
  const [profile, setProfile] = useState(null);
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!creatorId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);
    setEdits([]);
    fetch(`${API_URL}/api/studio/profile/${encodeURIComponent(creatorId)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load this creator page.');
        return data;
      })
      .then((data) => {
        setProfile(data.creator || null);
        setEdits(Array.isArray(data.edits) ? data.edits : []);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load this creator page.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [creatorId]);

  if (!creatorId) return null;

  return (
    <div className="public-creator-backdrop" role="dialog" aria-modal="true" aria-label="Public creator profile" onClick={onClose}>
      <section className="public-creator-page" onClick={(event) => event.stopPropagation()}>
        <button className="public-creator-close" onClick={onClose} aria-label="Close creator profile"><X size={19} /></button>
        {loading ? <div className="public-creator-state">Loading creator page…</div> : error ? <div className="public-creator-state is-error">{error}</div> : profile && <>
          <header className="public-creator-header">
            <div className="public-creator-avatar">{String(profile.display_name || 'C').trim().charAt(0).toUpperCase()}</div>
            <div className="public-creator-heading">
              <div className="eyebrow">CREATOR PROFILE</div>
              <h2>{profile.display_name}</h2>
              {profile.is_verified && <span className="public-creator-verified"><BadgeCheck size={15} /> Verified on EditVault</span>}
              <div className="public-creator-followers"><Users size={16} /><strong>{profile.tiktok_followers_updated_at ? Number(profile.tiktok_followers || 0).toLocaleString() : 'Not added'}</strong><span>TikTok followers <em>{profile.follower_count_source === 'public_profile_lookup' ? 'public-profile lookup' : 'creator-reported'}</em></span></div>
              {profile.tiktok_followers_updated_at && <small className="public-creator-updated">Follower count last updated {new Date(profile.tiktok_followers_updated_at).toLocaleDateString()}</small>}
            </div>
            {profile.tiktok_url && <a className="public-creator-tiktok" href={profile.tiktok_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> TikTok profile</a>}
          </header>

          <div className="public-creator-work-heading"><div><div className="eyebrow">ORIGINAL WORK</div><h3>Published edits <span>{edits.length}</span></h3></div></div>
          {edits.length === 0 ? <div className="public-creator-state"><Film size={24} /><strong>No public preview edits yet</strong><span>New edits appear here once a valid preview is published.</span></div> : (
            <div className="public-creator-grid">{edits.map((edit) => {
              const previewUrl = edit.previewUrl?.startsWith('http') ? edit.previewUrl : `${API_URL}${edit.previewUrl || `/api/edits/${edit.id}/preview`}`;
              return <article className="public-creator-edit" key={edit.id}>
                <button className="public-creator-video-button" onClick={() => onPreview?.({ ...edit, previewUrl, creator_id: profile.id, creator: profile.display_name, verified: profile.is_verified, price: Number(edit.price_points || 0) })} aria-label={`Play preview for ${edit.title}`}>
                  <video src={previewUrl} preload="metadata" muted playsInline onMouseEnter={(event) => { const playback = event.currentTarget.play(); if (playback?.catch) playback.catch(() => {}); }} onMouseLeave={(event) => { event.currentTarget.pause(); try { event.currentTarget.currentTime = 0; } catch { /* no-op */ } }} />
                  <span><Film size={15} /> Preview</span>
                </button>
                <div className="public-creator-edit-body"><strong>{edit.title}</strong><span>{edit.category || 'Other'}{edit.editing_software ? ` · ${edit.editing_software}` : ''}</span><div><b>{Number(edit.price_points || 0).toLocaleString()} pts</b><button onClick={() => onPreview?.({ ...edit, previewUrl, creator_id: profile.id, creator: profile.display_name, verified: profile.is_verified, price: Number(edit.price_points || 0) })}>Watch <ArrowUpRight size={14} /></button></div></div>
              </article>;
            })}</div>
          )}
          <p className="public-creator-disclaimer">{profile.follower_count_source === 'public_profile_lookup' ? 'Follower counts are retrieved from a third-party public-profile lookup, not through a TikTok account connection. Counts may be delayed.' : 'This follower count was supplied by the creator before automatic public-profile lookup was configured and has not been independently verified.'}</p>
        </>}
      </section>
    </div>
  );
}
