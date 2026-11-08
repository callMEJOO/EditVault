import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Download, LibraryBig, LoaderCircle, MessageSquareText, Star } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

function getToken() {
  return localStorage.getItem('editvault_token') || '';
}

function StarRating({ value = 0, count = 0 }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <div className="ev-library-rating-summary" aria-label={`${Number(value || 0).toFixed(1)} out of 5, ${count} reviews`}>
      <span className="ev-library-stars" aria-hidden="true">{'★'.repeat(rounded)}{'☆'.repeat(5 - rounded)}</span>
      <span className="ev-library-rating-number">{count ? Number(value || 0).toFixed(1) : 'New'}</span>
      <span className="ev-library-rating-count">{count ? `(${count})` : 'No ratings yet'}</span>
    </div>
  );
}

export default function EditVaultLibrary({ active, user, onLogin, onNotice, onReviewSaved }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [openReviewId, setOpenReviewId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingReviewId, setSavingReviewId] = useState('');

  const loadLibrary = useCallback(async () => {
    if (!user || !getToken()) {
      setItems([]);
      setPageError('');
      return;
    }
    setLoading(true);
    setPageError('');
    try {
      const response = await fetch(`${API_URL}/api/edits/mine/library`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load your library.');
      const library = Array.isArray(data.library) ? data.library : [];
      setItems(library);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of library) {
          if (!next[item.id]) next[item.id] = { rating: Number(item.my_rating || 5), comment: item.my_comment || '' };
        }
        return next;
      });
    } catch (error) {
      setPageError(error.message || 'Could not load your library.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (active) loadLibrary();
  }, [active, loadLibrary]);

  const downloadItem = async (item, personalized = false, manual = false) => {
    const token = getToken();
    if (!token) {
      onNotice?.('Please log in again to download your edit.');
      onLogin?.();
      return;
    }
    setDownloadingId(`${item.id}:${manual ? 'manual' : personalized ? 'personalized' : 'original'}`);
    try {
      const response = await fetch(`${API_URL}/api/edits/${item.id}/${manual ? "download-manual" : personalized ? "download-personalized" : "download"}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed. Please try again.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
      const filename = match ? decodeURIComponent(match[1].replace(/^"|"$/g, '')) : `${String(item.title || 'edit').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'edit'}.mp4`;
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      onNotice?.(personalized ? `Downloading your personalized copy of “${item.title}”.` : `Downloading “${item.title}”.`);
    } catch (error) {
      onNotice?.(error.message || 'Download failed.');
    } finally {
      setDownloadingId('');
    }
  };

  const updateDraft = (id, patch) => {
    setDrafts((current) => ({
      ...current,
      [id]: { rating: 5, comment: '', ...(current[id] || {}), ...patch },
    }));
  };

  const submitReview = async (item) => {
    const token = getToken();
    if (!token) {
      onLogin?.();
      return;
    }
    const draft = drafts[item.id] || { rating: 5, comment: '' };
    const rating = Number(draft.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      onNotice?.('Choose a rating from 1 to 5 stars.');
      return;
    }
    setSavingReviewId(item.id);
    try {
      const response = await fetch(`${API_URL}/api/edits/${item.id}/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, comment: String(draft.comment || '').trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your rating.');
      setItems((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        my_rating: rating,
        my_comment: String(draft.comment || '').trim(),
        avg_rating: Number(data.avgRating ?? entry.avg_rating ?? rating),
        rating_count: Number(data.ratingCount ?? entry.rating_count ?? 1),
      } : entry));
      onReviewSaved?.(item.id, Number(data.avgRating ?? rating), Number(data.ratingCount ?? 1));
      setOpenReviewId('');
      onNotice?.('Thanks! Your rating has been saved.');
    } catch (error) {
      onNotice?.(error.message || 'Could not save your rating.');
    } finally {
      setSavingReviewId('');
    }
  };

  return (
    <section className="ev-library-page" aria-labelledby="ev-library-title">
      <div className="ev-library-topline">
        <div>
          <div className="ev-library-eyebrow">YOUR COLLECTION / PRIVATE ACCESS</div>
          <h1 id="ev-library-title">My <span>Library</span></h1>
          <p>Every edit you own, ready to download in original quality.</p>
        </div>
        <div className="ev-library-count">
          <LibraryBig size={19} />
          <span><strong>{items.length}</strong><small>Owned edits</small></span>
        </div>
      </div>

      {!user ? (
        <div className="ev-library-empty">
          <div className="ev-library-empty-icon"><LibraryBig size={28} /></div>
          <h2>Your collection starts here.</h2>
          <p>Log in to see your purchases, download original files, and rate the edits you own.</p>
          <button type="button" className="ev-library-primary" onClick={onLogin}>Log in to continue</button>
        </div>
      ) : loading ? (
        <div className="ev-library-state"><LoaderCircle className="ev-library-spinner" size={22} /> Loading your library…</div>
      ) : pageError ? (
        <div className="ev-library-state ev-library-error"><p>{pageError}</p><button type="button" className="ev-library-secondary" onClick={loadLibrary}>Try again</button></div>
      ) : items.length === 0 ? (
        <div className="ev-library-empty">
          <div className="ev-library-empty-icon"><LibraryBig size={28} /></div>
          <h2>No edits here yet.</h2>
          <p>When you buy a one-of-one edit, it will be saved here permanently.</p>
        </div>
      ) : (
        <div className="ev-library-grid">
          {items.map((item) => {
            const draft = drafts[item.id] || { rating: 5, comment: '' };
            const hasRated = Boolean(item.my_rating);
            return (
              <article className="ev-library-card" key={item.id}>
                <div className="ev-library-card-accent"><span>EDITVAULT ORIGINAL</span><BadgeCheck size={16} /></div>
                <div className="ev-library-card-main">
                  <div className="ev-library-card-meta">
                    <span>{item.category || 'Edit'}</span>
                    <span>{item.price_points} PTS</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p className="ev-library-creator">by {item.creator_name || 'Creator'}</p>
                  <StarRating value={item.avg_rating} count={item.rating_count} />
                  <div className="ev-library-owned-tag"><span className="ev-library-owned-dot" /> OWNED · PURCHASED {item.purchased_at ? new Date(item.purchased_at).toLocaleDateString() : ''}</div>
                  <button type="button" className="ev-library-download" disabled={Boolean(downloadingId)} onClick={() => downloadItem(item)}>
                    {downloadingId === `${item.id}:original` ? <LoaderCircle className="ev-library-spinner" size={17} /> : <Download size={17} />}
                    {downloadingId === `${item.id}:original` ? 'Preparing download…' : 'Download original'}
                  </button>
                  {item.watermark_mode === 'manual' && (
                    <div className="evwm-manual-status">
                      <strong>HANDCRAFTED DESIGN · 40 PTS</strong>
                      {item.manual_watermark_status === 'completed' ? (
                        <button type="button" className="evwm-library-button" disabled={Boolean(downloadingId)} onClick={() => downloadItem(item, false, true)}>
                          {downloadingId === `${item.id}:manual` ? 'Downloading…' : 'Download handmade copy'}
                        </button>
                      ) : <span>Pending manual delivery · your original is available above.</span>}
                    </div>
                  )}
                  {item.watermark_name && item.watermark_style && (
                    <div className="evwm-library-download">
                      <div className="evwm-library-label">PERSONALIZED COPY <span>{item.watermark_name} · {item.watermark_style}</span></div>
                      <button type="button" className="evwm-library-button" disabled={Boolean(downloadingId)} onClick={() => downloadItem(item, true)}>
                        {downloadingId === `${item.id}:personalized` ? <LoaderCircle className="ev-library-spinner" size={16} /> : <Download size={16} />}
                        {downloadingId === `${item.id}:personalized` ? 'Rendering your watermark…' : 'Download with my name'}
                      </button>
                    </div>
                  )}
                  <div className="ev-library-review-block">
                    <div className="ev-library-review-heading"><MessageSquareText size={16} /><strong>Your review</strong></div>
                    {hasRated && openReviewId !== item.id ? (
                      <div className="ev-library-existing-review">
                        <span className="ev-library-stars">{'★'.repeat(Number(item.my_rating))}{'☆'.repeat(5 - Number(item.my_rating))}</span>
                        {item.my_comment ? <p>{item.my_comment}</p> : <p className="ev-library-muted">Thanks for rating this edit.</p>}
                        <button type="button" className="ev-library-text-btn" onClick={() => { setOpenReviewId(item.id); updateDraft(item.id, { rating: Number(item.my_rating), comment: item.my_comment || '' }); }}>Edit rating</button>
                      </div>
                    ) : (
                      <div className="ev-library-review-form">
                        <div className="ev-library-star-picker" role="radiogroup" aria-label={`Rate ${item.title}`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} type="button" role="radio" aria-checked={Number(draft.rating) === star} aria-label={`${star} star${star === 1 ? '' : 's'}`} className={Number(draft.rating) >= star ? 'selected' : ''} onClick={() => updateDraft(item.id, { rating: star })}><Star size={21} fill={Number(draft.rating) >= star ? 'currentColor' : 'none'} /></button>
                          ))}
                        </div>
                        <textarea maxLength={600} value={draft.comment || ''} onChange={(event) => updateDraft(item.id, { comment: event.target.value })} placeholder="Share a quick note (optional)…" aria-label="Review comment" />
                        <div className="ev-library-review-actions">
                          <button type="button" className="ev-library-primary" disabled={savingReviewId === item.id} onClick={() => submitReview(item)}>{savingReviewId === item.id ? 'Saving…' : hasRated ? 'Update rating' : 'Submit rating'}</button>
                          {hasRated && <button type="button" className="ev-library-text-btn" onClick={() => setOpenReviewId('')}>Cancel</button>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
