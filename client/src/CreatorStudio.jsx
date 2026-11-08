import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Coins, ExternalLink, Film, RefreshCw, Scissors,
  ShieldCheck, Upload, X, Pencil, Trash2, Save, UserRound, Play,
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const CATEGORIES = ['Anime', 'Cinematic', 'Aesthetic', 'Gaming', 'AMV', 'Other'];
const EMPTY_FORM = {
  title: '', description: '', category: 'Anime', editingSoftware: '', pricePoints: '80',
  original: null, previewStartSeconds: '0', previewEndSeconds: '10',
};

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

function uploadWithProgress(url, formData, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading the video.'));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || data.message || `Upload failed (${xhr.status}).`));
    };
    xhr.send(formData);
  });
}

function secondsLabel(value) {
  const seconds = Math.max(0, Number(value) || 0);
  return `${seconds.toFixed(1)}s`;
}

export default function CreatorStudio({ open, onClose, user, onNotice, onOpenProfile }) {
  const [profile, setProfile] = useState(user || null);
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [profileForm, setProfileForm] = useState({ displayName: '', tiktokUrl: '', tiktokFollowers: '0' });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [originalDuration, setOriginalDuration] = useState(null);
  const [playingSegment, setPlayingSegment] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [trimEditor, setTrimEditor] = useState(null);
  const originalVideoRef = useRef(null);
  const trimVideoRef = useRef(null);

  const token = () => localStorage.getItem('editvault_token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });
  const verified = profile?.role === 'creator' || profile?.role === 'admin';
    const totalSales = videos.reduce((sum, item) => sum + Number(item.sales || 0), 0);
  const pointsEarned = videos.reduce((sum, item) => sum + Number(item.points_earned || 0), 0);
  const selectedDuration = Number(form.previewEndSeconds) - Number(form.previewStartSeconds);
  const rangeError = useMemo(() => {
    if (!form.original) return '';
    const start = Number(form.previewStartSeconds);
    const end = Number(form.previewEndSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return 'Choose a valid start and end time.';
    if (selectedDuration < 3) return 'A public preview must be at least 3 seconds.';
    if (selectedDuration > 60) return 'A public preview can be at most 60 seconds.';
    if (originalDuration && end > originalDuration) return 'The end time cannot exceed the video duration.';
    return '';
  }, [form.original, form.previewStartSeconds, form.previewEndSeconds, selectedDuration, originalDuration]);

  const loadStudio = useCallback(async () => {
    const currentToken = localStorage.getItem('editvault_token');
    if (!currentToken) return;
    setLoading(true);
    setError('');
    try {
      const authHeaders = { Authorization: `Bearer ${currentToken}` };
      const [profileResponse, editsResponse, salesResponse] = await Promise.all([
        fetch(`${API_URL}/api/studio/profile/me`, { headers: authHeaders }),
        fetch(`${API_URL}/api/studio/edits/mine`, { headers: authHeaders }),
        fetch(`${API_URL}/api/creators/sales`, { headers: authHeaders }),
      ]);
      const [profileData, editsData, salesData] = await Promise.all([
        readJson(profileResponse), readJson(editsResponse), readJson(salesResponse),
      ]);
      const nextProfile = profileData.user || profileData;
      setProfile(nextProfile);
      setProfileForm({
        displayName: nextProfile.display_name || nextProfile.displayName || '',
        tiktokUrl: nextProfile.tiktok_url || '',
        tiktokFollowers: String(nextProfile.tiktok_followers ?? 0),
      });
      setVideos(Array.isArray(editsData.edits) ? editsData.edits : []);
      // Sales are provided for compatibility with the existing creator dashboard.
      void salesData;
    } catch (requestError) {
      setError(requestError.message || 'Could not load Creator Studio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && user) loadStudio();
  }, [open, user, loadStudio]);

  useEffect(() => () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => () => {
    if (trimEditor?.url) URL.revokeObjectURL(trimEditor.url);
  }, [trimEditor?.url]);

  if (!open) return null;

  const refreshMarketplace = () => window.dispatchEvent(new CustomEvent('editvault:refresh-edits'));

  const submitProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/profile`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await readJson(response);
      setProfile(data.user || profile);
      setProfileForm({
        displayName: data.user?.display_name || profileForm.displayName,
        tiktokUrl: data.user?.tiktok_url || '',
        tiktokFollowers: String(data.user?.tiktok_followers ?? profileForm.tiktokFollowers),
      });
      onNotice?.(data.message || 'Public creator profile saved.');
      await loadStudio();
    } catch (requestError) {
      setError(requestError.message || 'Could not save the public profile.');
    } finally {
      setSavingProfile(false);
    }
  };


  const selectOriginal = (file) => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (!file) {
      setOriginalUrl('');
      setOriginalDuration(null);
      setForm((current) => ({ ...current, original: null, previewStartSeconds: '0', previewEndSeconds: '10' }));
      return;
    }
    setOriginalUrl(URL.createObjectURL(file));
    setOriginalDuration(null);
    setPlayingSegment(false);
    setForm((current) => ({ ...current, original: file, previewStartSeconds: '0', previewEndSeconds: '10' }));
  };

  const onOriginalLoaded = (event) => {
    const duration = event.currentTarget.duration;
    if (!Number.isFinite(duration)) return;
    setOriginalDuration(duration);
    setForm((current) => ({
      ...current,
      previewStartSeconds: String(Math.min(Number(current.previewStartSeconds) || 0, Math.max(0, duration - 3))),
      previewEndSeconds: String(Math.min(Math.max(Number(current.previewEndSeconds) || 10, 3), duration)),
    }));
  };

  const playSelectedSegment = () => {
    const video = originalVideoRef.current;
    if (!video || rangeError) return;
    video.currentTime = Number(form.previewStartSeconds);
    setPlayingSegment(true);
    const playback = video.play();
    if (playback?.catch) playback.catch(() => setPlayingSegment(false));
  };

  const onOriginalTimeUpdate = (event) => {
    const video = event.currentTarget;
    if (playingSegment && video.currentTime >= Number(form.previewEndSeconds)) {
      video.pause();
      setPlayingSegment(false);
    }
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!form.original) { setError('Choose the original video file first.'); return; }
    if (rangeError) { setError(rangeError); return; }
    setUploading(true);
    setUploadProgress(0);
    setError('');
    try {
      const body = new FormData();
      body.append('original', form.original);
      body.append('title', form.title.trim());
      body.append('description', form.description.trim());
      body.append('category', form.category);
      body.append('editingSoftware', form.editingSoftware.trim());
      body.append('pricePoints', form.pricePoints);
      body.append('previewStartSeconds', form.previewStartSeconds);
      body.append('previewEndSeconds', form.previewEndSeconds);
      const result = await uploadWithProgress(`${API_URL}/api/studio/edits`, body, token(), setUploadProgress);
      setForm(EMPTY_FORM);
      selectOriginal(null);
      const fileInput = document.getElementById('creator-original-video');
      if (fileInput) fileInput.value = '';
      onNotice?.(result.message || 'Edit uploaded with a public preview.');
      refreshMarketplace();
      await loadStudio();
    } catch (requestError) {
      setError(requestError.message || 'Video upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const beginEdit = (video) => {
    setEditingVideoId(video.id);
    setEditValues({
      title: video.title || '',
      description: video.description || '',
      category: video.category || 'Other',
      editingSoftware: video.editing_software || '',
      pricePoints: String(video.price_points || 1),
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingVideoId || !editValues) return;
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/edits/${editingVideoId}`, {
        method: 'PATCH',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues),
      });
      await readJson(response);
      setEditingVideoId(null);
      setEditValues(null);
      onNotice?.('Edit details updated.');
      refreshMarketplace();
      await loadStudio();
    } catch (requestError) {
      setError(requestError.message || 'Could not update this edit.');
    }
  };

  const deleteEdit = async (video) => {
    const confirmed = window.confirm(`Remove “${video.title}” from the public marketplace? Purchase records and downloads for previous buyers will be retained.`);
    if (!confirmed) return;
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/edits/${video.id}`, {
        method: 'DELETE', headers: headers(),
      });
      const data = await readJson(response);
      onNotice?.(data.message || 'Edit removed from public browsing.');
      refreshMarketplace();
      await loadStudio();
    } catch (requestError) {
      setError(requestError.message || 'Could not remove this edit.');
    }
  };

  const openTrimEditor = async (video) => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/edits/${video.id}/original`, { headers: headers() });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not load the original video for preview selection.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setTrimEditor({ video, url, duration: null, startSeconds: '0', endSeconds: '10', saving: false });
    } catch (requestError) {
      setError(requestError.message || 'Could not open the preview selector.');
    }
  };

  const closeTrimEditor = () => {
    if (trimEditor?.url) URL.revokeObjectURL(trimEditor.url);
    setTrimEditor(null);
  };

  const saveTrimEditor = async () => {
    if (!trimEditor) return;
    const start = Number(trimEditor.startSeconds);
    const end = Number(trimEditor.endSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start < 3 || end - start > 60 || (trimEditor.duration && end > trimEditor.duration)) {
      setError('Choose a valid preview range between 3 and 60 seconds, within the original video.');
      return;
    }
    setTrimEditor((current) => ({ ...current, saving: true }));
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/studio/edits/${trimEditor.video.id}/preview/trim`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ startSeconds: start, endSeconds: end }),
      });
      const data = await readJson(response);
      closeTrimEditor();
      onNotice?.(data.message || 'Public preview replaced.');
      refreshMarketplace();
      await loadStudio();
    } catch (requestError) {
      setError(requestError.message || 'Could not save the selected preview.');
      setTrimEditor((current) => current ? { ...current, saving: false } : null);
    }
  };

  if (!open) return null;

  return (
    <div className="creator-studio-backdrop" role="dialog" aria-modal="true" aria-label="Creator Studio">
      <section className="creator-studio">
        <header className="cs-header">
          <div className="cs-brand"><span className="cs-brand-icon"><Film size={22} /></span><div><div className="eyebrow">EDITVAULT / CREATOR TOOLS</div><h2>Creator <span>Studio</span></h2></div></div>
          <div className="cs-header-actions">
            <button className="cs-quiet-btn" onClick={loadStudio} disabled={loading}><RefreshCw size={15} /> Refresh</button>
            <button className="cs-close" onClick={onClose} aria-label="Close Creator Studio"><X /></button>
          </div>
        </header>

        <div className="cs-content">
          <div className="cs-welcome">
            <div><div className="eyebrow">YOUR CREATOR DASHBOARD</div><h3>Welcome back, {profile?.display_name || profile?.displayName || user?.email || 'creator'}.</h3><p>Manage your public page, select preview clips, and control your published edits.</p></div>
            <span className={`cs-status ${verified ? 'is-verified' : ''}`}>{verified ? <><BadgeCheck size={15} /> Creator access approved</> : 'Creator access required'}</span>
          </div>

          {error && <div className="cs-error" role="alert">{error}</div>}

          <div className="cs-metrics">
            <article><span>ACTIVE EDITS</span><strong>{videos.length}</strong><small>Currently in your catalog</small></article>
            <article><span>TOTAL SALES</span><strong>{totalSales}</strong><small>Completed purchases</small></article>
            <article><span>POINTS EARNED</span><strong>{pointsEarned.toLocaleString()}</strong><small>From your edit sales</small></article>
          </div>

          <div className="cs-grid">
            <section className="cs-panel">
              <div className="cs-panel-heading"><div><div className="eyebrow">PROFILE SETTINGS</div><h3>Public profile settings</h3></div><UserRound size={20} /></div>
              <p className="cs-panel-copy">Manage your public name, photo, and TikTok details from Profile. These settings are separate from your creator-access application.</p>
              <button type="button" className="primary-cta cs-submit" onClick={() => onOpenProfile?.()}>Open Profile Settings <ExternalLink size={15} /></button>
            </section>
            <section className="cs-panel">
              <div className="cs-panel-heading"><div><div className="eyebrow">PUBLISH NEW WORK</div><h3>Upload an edit</h3></div><Upload size={20} /></div>
              {!verified ? (
                <div className="cs-locked"><ShieldCheck size={24} /><strong>Creator access required</strong><p>Creator Studio tools are available after an administrator approves your separate creator application.</p></div>
              ) : (
                <form className="cs-form" onSubmit={submitUpload}>
                  <label>Original video<input id="creator-original-video" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" required onChange={(event) => selectOriginal(event.target.files?.[0] || null)} /><small>The original remains private to you and buyers who purchase the edit.</small></label>
                  {originalUrl && <div className="cs-clip-selector">
                    <video ref={originalVideoRef} src={originalUrl} controls playsInline preload="metadata" onLoadedMetadata={onOriginalLoaded} onTimeUpdate={onOriginalTimeUpdate} />
                    <div className="cs-form-row">
                      <label>Start (seconds)<input type="number" min="0" step="0.1" value={form.previewStartSeconds} onChange={(event) => { setPlayingSegment(false); setForm({ ...form, previewStartSeconds: event.target.value }); }} required /></label>
                      <label>End (seconds)<input type="number" min="0" step="0.1" value={form.previewEndSeconds} onChange={(event) => { setPlayingSegment(false); setForm({ ...form, previewEndSeconds: event.target.value }); }} required /></label>
                    </div>
                    <div className="cs-clip-summary"><span>Preview length <b>{secondsLabel(selectedDuration)}</b></span><span>Video length <b>{originalDuration ? secondsLabel(originalDuration) : 'Loading…'}</b></span></div>
                    {rangeError && <small className="cs-inline-error">{rangeError}</small>}
                    <button type="button" className="secondary-cta cs-submit" disabled={Boolean(rangeError) || !originalDuration} onClick={playSelectedSegment}><Play size={15} /> Play selected segment</button>
                    <small>The server will cut this range into a separate public MP4 preview. Only that preview is shown to everyone.</small>
                  </div>}
                  <label>Title<input required minLength={2} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Neon after hours" /></label>
                  <label>Description<textarea maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell buyers about this edit" rows={3} /></label>
                  <div className="cs-form-row">
                    <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
                    <label>Price (points)<input required type="number" min="1" max="100000" step="1" value={form.pricePoints} onChange={(event) => setForm({ ...form, pricePoints: event.target.value })} /></label>
                  </div>
                  <label>Editing software (optional)<input maxLength={80} value={form.editingSoftware} onChange={(event) => setForm({ ...form, editingSoftware: event.target.value })} placeholder="After Effects, Premiere Pro…" /></label>
                  {uploading && <div className="cs-progress"><div style={{ width: `${uploadProgress}%` }} /><span>{uploadProgress}% uploaded</span></div>}
                  <button className="primary-cta cs-submit" type="submit" disabled={uploading || !form.original || Boolean(rangeError)}>{uploading ? `Uploading ${uploadProgress}%…` : 'Publish edit with selected preview'} <Upload size={16} /></button>
                </form>
              )}
            </section>
          </div>

          <section className="cs-panel cs-videos-panel">
            <div className="cs-panel-heading"><div><div className="eyebrow">YOUR CATALOG</div><h3>My edits</h3></div><span className="cs-count">{videos.length} active</span></div>
            {loading ? <p className="cs-empty">Loading your creator data…</p> : videos.length === 0 ? <div className="cs-empty"><Film size={25} /><strong>No active edits</strong><span>Once creator access is approved, publish an edit and choose its preview segment.</span></div> : (
              <div className="cs-video-list">{videos.map((video) => (
                <article className="cs-video-row cs-video-row-expanded" key={video.id}>
                  {video.has_preview ? <video className="cs-row-preview" controls preload="metadata" src={`${API_URL}/api/edits/${video.id}/preview`} /> : <div className="cs-video-icon"><Film size={20} /></div>}
                  <div className="cs-video-info"><strong>{video.title}</strong><span>{video.category || 'Other'} · {Number(video.price_points || 0)} points</span><small>{video.has_preview ? 'Public preview ready' : 'Preview missing'} · {video.status || 'published'} · {video.created_at ? new Date(video.created_at).toLocaleDateString() : ''}</small></div>
                  <div className="cs-video-stats"><span><b>{Number(video.sales || 0)}</b> sales</span><span><b>{Number(video.points_earned || 0).toLocaleString()}</b> pts earned</span></div>
                  <div className="cs-video-actions"><button className="cs-small-btn" onClick={() => beginEdit(video)}><Pencil size={14} /> Edit</button><button className="cs-small-btn" onClick={() => openTrimEditor(video)}><Scissors size={14} /> Change preview</button><button className="cs-small-btn is-danger" onClick={() => deleteEdit(video)}><Trash2 size={14} /> Remove</button></div>
                  {editingVideoId === video.id && editValues && <form className="cs-edit-form" onSubmit={saveEdit}>
                    <label>Title<input required minLength={2} maxLength={120} value={editValues.title} onChange={(event) => setEditValues({ ...editValues, title: event.target.value })} /></label>
                    <label>Description<textarea maxLength={2000} rows={2} value={editValues.description} onChange={(event) => setEditValues({ ...editValues, description: event.target.value })} /></label>
                    <div className="cs-form-row"><label>Category<select value={editValues.category} onChange={(event) => setEditValues({ ...editValues, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Price (points)<input type="number" min="1" max="100000" step="1" required value={editValues.pricePoints} onChange={(event) => setEditValues({ ...editValues, pricePoints: event.target.value })} /></label></div>
                    <label>Editing software<input maxLength={80} value={editValues.editingSoftware} onChange={(event) => setEditValues({ ...editValues, editingSoftware: event.target.value })} /></label>
                    <div className="cs-inline-actions"><button className="primary-cta" type="submit"><Save size={14} /> Save changes</button><button className="secondary-cta" type="button" onClick={() => { setEditingVideoId(null); setEditValues(null); }}>Cancel</button></div>
                  </form>}
                </article>
              ))}</div>
            )}
          </section>
        </div>

        <footer className="cs-footer"><span><Coins size={15} /> Purchase records and original downloads are retained if an edit is removed from public browsing.</span><button onClick={onClose}><ArrowLeft size={15} /> Back to marketplace</button></footer>
      </section>

      {trimEditor && <div className="cs-trim-backdrop" onClick={closeTrimEditor}>
        <section className="cs-trim-modal" role="dialog" aria-modal="true" aria-label={`Change preview for ${trimEditor.video.title}`} onClick={(event) => event.stopPropagation()}>
          <button className="cs-close cs-trim-close" onClick={closeTrimEditor} aria-label="Close preview selector"><X /></button>
          <div className="eyebrow">CHANGE PUBLIC PREVIEW</div><h3>{trimEditor.video.title}</h3>
          <p>The original is loaded for your selection only. Saving creates a separate public clip; the original file remains private.</p>
<video
  ref={trimVideoRef}
  src={trimEditor.url}
  controls
  playsInline
  preload="metadata"
  onLoadedMetadata={(event) => {
    const duration = event.currentTarget.duration;

    setTrimEditor((current) =>
      current
        ? {
            ...current,
            duration,
            endSeconds: String(Math.min(10, duration)),
          }
        : null
    );
  }}
/>          <div className="cs-form-row"><label>Start (seconds)<input type="number" min="0" step="0.1" value={trimEditor.startSeconds} onChange={(event) => setTrimEditor({ ...trimEditor, startSeconds: event.target.value })} /></label><label>End (seconds)<input type="number" min="0" step="0.1" value={trimEditor.endSeconds} onChange={(event) => setTrimEditor({ ...trimEditor, endSeconds: event.target.value })} /></label></div>
          <div className="cs-clip-summary"><span>Selected length <b>{secondsLabel(Number(trimEditor.endSeconds) - Number(trimEditor.startSeconds))}</b></span><span>Original length <b>{trimEditor.duration ? secondsLabel(trimEditor.duration) : 'Loading…'}</b></span></div>
          <button className="primary-cta cs-submit" onClick={saveTrimEditor} disabled={trimEditor.saving}>{trimEditor.saving ? 'Creating preview…' : 'Save selected preview'} <Scissors size={15} /></button>
        </section>
      </div>}
    </div>
  );
}
