import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, ExternalLink, Film, Users, X, Star, Send, ShieldCheck } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function PublicCreatorProfile({ creatorId, onClose, onPreview, user, onLoginRequest }) {
  const [profile, setProfile] = useState(null);
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ average_rating: 0, review_count: 0 });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [myReview, setMyReview] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestBrief, setRequestBrief] = useState('');
  const [requestCategory, setRequestCategory] = useState('Gaming');
  const [requestReference, setRequestReference] = useState('');
  const [requestDeadline, setRequestDeadline] = useState('');
  const [requestBudget, setRequestBudget] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestError, setRequestError] = useState('');
  const isArabicRequestUi = localStorage.getItem('editvault_language') === 'ar';
  const requestText = (en, ar) => isArabicRequestUi ? ar : en;

  useEffect(() => {
    if (!creatorId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);
    setEdits([]);
    Promise.all([
      fetch(`${API_URL}/api/studio/profile/${encodeURIComponent(creatorId)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Could not load this creator page.');
          return data;
        }),
      fetch(`${API_URL}/api/profile/creator/${encodeURIComponent(creatorId)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return null;
          const data = await response.json().catch(() => ({}));
          return data.user || data;
        })
        .catch(() => null),
    ])
      .then(([data, mediaUser]) => {
        setProfile(data.creator ? { ...data.creator, avatar_data_url: mediaUser?.avatar_data_url || null } : null);
        setEdits(Array.isArray(data.edits) ? data.edits : []);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load this creator page.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [creatorId]);

  useEffect(() => {
    if (!creatorId) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    const token = localStorage.getItem('editvault_token');
    setReviewLoading(true);
    setReviewError('');
    setReviewMessage('');
    setReviews([]);
    setReviewSummary({ average_rating: 0, review_count: 0 });
    setCanReview(false);
    setMyReview(null);
    setReviewText('');
    setReviewRating(5);
    fetch(`${API_URL}/api/creator-reviews/${encodeURIComponent(creatorId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load reviews.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setReviewSummary(data.summary || { average_rating: 0, review_count: 0 });
        setCanReview(Boolean(data.canReview));
        setMyReview(data.myReview || null);
        if (data.myReview) {
          setReviewRating(Number(data.myReview.rating) || 5);
          setReviewText(data.myReview.review_text || '');
        }
      })
      .catch((requestError) => {
        if (!cancelled && requestError.name !== 'AbortError') setReviewError(requestError.message || 'Could not load creator reviews.');
      })
      .finally(() => { if (!cancelled) setReviewLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [creatorId, user?.id]);

  const submitReview = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('editvault_token');
    if (!token) {
      onLoginRequest?.();
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    setReviewMessage('');
    try {
      const response = await fetch(`${API_URL}/api/creator-reviews/${encodeURIComponent(creatorId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, reviewText: reviewText.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your review.');
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setReviewSummary(data.summary || { average_rating: 0, review_count: 0 });
      setCanReview(Boolean(data.canReview));
      setMyReview(data.myReview || data.review || null);
      setReviewText((data.myReview || data.review)?.review_text || reviewText.trim());
      setReviewMessage(data.message || 'Your review was saved.');
    } catch (requestError) {
      setReviewError(requestError.message || 'Could not save your review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const submitCustomRequest = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('editvault_token');
    if (!token) { onLoginRequest?.(); return; }
    setRequestSubmitting(true); setRequestError(''); setRequestMessage('');
    try {
      const response = await fetch(`${API_URL}/api/custom-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, title: requestTitle.trim(), brief: requestBrief.trim(), category: requestCategory, referenceUrl: requestReference.trim(), deadline: requestDeadline, budgetPoints: requestBudget === '' ? null : Number(requestBudget) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || requestText('Could not send request.', 'تعذر إرسال الطلب.'));
      setRequestMessage(data.message || requestText('Request sent successfully.', 'تم إرسال الطلب بنجاح.'));
      setRequestTitle(''); setRequestBrief(''); setRequestCategory('Gaming'); setRequestReference(''); setRequestDeadline(''); setRequestBudget('');
      setRequestOpen(false);
    } catch (error) { setRequestError(error.message || requestText('Could not send request.', 'تعذر إرسال الطلب.')); }
    finally { setRequestSubmitting(false); }
  };

  if (!creatorId) return null;

  return (
    <div className="public-creator-backdrop" role="dialog" aria-modal="true" aria-label="Public creator profile" onClick={onClose}>
      <section className="public-creator-page" onClick={(event) => event.stopPropagation()}>
        <button className="public-creator-close" onClick={onClose} aria-label="Close creator profile"><X size={19} /></button>
        {loading ? <div className="public-creator-state">Loading creator page…</div> : error ? <div className="public-creator-state is-error">{error}</div> : profile && <>
          <header className="public-creator-header">
            <div className="public-creator-avatar">{profile.avatar_data_url ? <img src={profile.avatar_data_url} alt={`${profile.display_name || 'Creator'} profile`} /> : <span>{String(profile.display_name || 'C').trim().charAt(0).toUpperCase()}</span>}</div>
            <div className="public-creator-heading">
              <div className="eyebrow">CREATOR PROFILE</div>
              <h2>{profile.display_name}</h2>
              {profile.is_verified && <span className="public-creator-verified"><BadgeCheck size={15} /> Verified on EditVault</span>}
              <div className="public-creator-followers"><Users size={16} /><strong>{profile.tiktok_followers_updated_at ? Number(profile.tiktok_followers || 0).toLocaleString() : 'Not added'}</strong><span>TikTok followers <em>auto-synced</em></span></div>
              {profile.tiktok_followers_updated_at && <small className="public-creator-updated">Follower count last updated {new Date(profile.tiktok_followers_updated_at).toLocaleDateString()}</small>}
            </div>
            {profile.tiktok_url && <a className="public-creator-tiktok" href={profile.tiktok_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> TikTok profile</a>}
          </header>

          <section className="ev-custom-request-box" dir={isArabicRequestUi ? 'rtl' : 'ltr'} aria-labelledby="ev-custom-request-title">
            <h3 id="ev-custom-request-title">{requestText('Need a custom edit?', 'محتاج تعديل مخصوص؟')}</h3>
            <p>{requestText('Tell this creator what you have in mind. They can review your brief and send you an offer in points.', 'اشرح للكريتور التعديل اللي محتاجه. هيقدر يراجع التفاصيل ويبعتلك عرض بالنقاط.')}</p>
            {user?.id === profile.id ? <p>{requestText('This is your creator profile. Open Requests from the main navigation to manage client briefs.', 'ده بروفايلك. افتح «طلبات التعديل» من القائمة لإدارة طلبات العملاء.')}</p> : <button className="ev-custom-request-toggle" type="button" onClick={() => { if (!user) { onLoginRequest?.(); return; } setRequestOpen((value) => !value); setRequestError(''); setRequestMessage(''); }}><Send size={15}/>{requestText('Request a custom edit', 'اطلب تعديل مخصص')}</button>}
            {requestOpen && user && user.id !== profile.id && <form className="ev-custom-request-form" onSubmit={submitCustomRequest}>
              <label>{requestText('Project title', 'عنوان الطلب')}<input required minLength={3} maxLength={120} value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder={requestText('e.g. 30-second gaming montage', 'مثال: مونتاج جيمينج 30 ثانية')}/></label>
              <label>{requestText('Edit type', 'نوع التعديل')}<select value={requestCategory} onChange={(event) => setRequestCategory(event.target.value)}><option>Gaming</option><option>AMV</option><option>Cinematic</option><option>TikTok / Reels</option><option>CC / Color grading</option><option>Other</option></select></label>
              <label className="ev-custom-wide">{requestText('Describe what you need', 'اشرح التعديل المطلوب')}<textarea required minLength={15} maxLength={4000} value={requestBrief} onChange={(event) => setRequestBrief(event.target.value)} placeholder={requestText('Style, duration, music, format, references, and anything the creator should know…', 'الستايل والمدة والموسيقى والمقاس والمراجع وأي تفاصيل مهمة…')}/></label>
              <label>{requestText('Reference link (optional)', 'رابط مرجعي (اختياري)')}<input type="url" maxLength={1200} value={requestReference} onChange={(event) => setRequestReference(event.target.value)} placeholder="https://…"/></label>
              <label>{requestText('Preferred deadline (optional)', 'موعد التسليم (اختياري)')}<input type="date" value={requestDeadline} onChange={(event) => setRequestDeadline(event.target.value)}/></label>
              <label>{requestText('Expected budget in points (optional)', 'الميزانية المتوقعة بالنقاط (اختياري)')}<input type="number" min="0" max="1000000" step="1" value={requestBudget} onChange={(event) => setRequestBudget(event.target.value)} placeholder="e.g. 500"/></label>
              <button className="ev-custom-request-toggle" type="submit" disabled={requestSubmitting}><Send size={15}/>{requestSubmitting ? requestText('Sending…', 'جارٍ الإرسال…') : requestText('Send request', 'إرسال الطلب')}</button>
            </form>}
            {requestError && <p className="ev-custom-request-message error" role="alert">{requestError}</p>}
            {requestMessage && <p className="ev-custom-request-message success" role="status">{requestMessage}</p>}
          </section>

          
          <section className="public-creator-insights" aria-label="Creator overview">
            <article className="public-creator-insight">
              <span>{document.documentElement.dir === 'rtl' ? 'حالة الحساب' : 'PROFILE STATUS'}</span>
              <strong>{profile.is_verified ? (document.documentElement.dir === 'rtl' ? 'مبدع موثّق' : 'Verified creator') : (document.documentElement.dir === 'rtl' ? 'مبدع' : 'Creator')}</strong>
              <small>{profile.is_verified ? (document.documentElement.dir === 'rtl' ? 'تم توثيق الحساب على EditVault' : 'Verified on EditVault') : (document.documentElement.dir === 'rtl' ? 'الملف العام للمبدع' : 'Public creator profile')}</small>
            </article>
            <article className="public-creator-insight">
              <span>{document.documentElement.dir === 'rtl' ? 'الإيديتات المنشورة' : 'PUBLISHED EDITS'}</span>
              <strong>{edits.length.toLocaleString()}</strong>
              <small>{document.documentElement.dir === 'rtl' ? 'إيديتات من هذا المبدع' : 'Original edits from this creator'}</small>
            </article>
            <article className="public-creator-insight">
              <span>{document.documentElement.dir === 'rtl' ? 'متابعو تيك توك' : 'TIKTOK FOLLOWERS'}</span>
              <strong>{profile.tiktok_followers_updated_at ? Number(profile.tiktok_followers || 0).toLocaleString() : '—'}</strong>
              <small>{profile.tiktok_followers_updated_at ? (document.documentElement.dir === 'rtl' ? 'بيانات الملف العام' : 'Public profile data') : (document.documentElement.dir === 'rtl' ? 'لم تتم المزامنة بعد' : 'Not synced yet')}</small>
            </article>
          </section>
          <div className="public-creator-work-heading"><div><div className="eyebrow">{document.documentElement.dir === 'rtl' ? 'أعمال أصلية' : 'ORIGINAL WORK'}</div><h3>{document.documentElement.dir === 'rtl' ? 'إيديتات المبدع' : "Creator’s edits"} <span>{edits.length}</span></h3></div></div>
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
          <section className="creator-reviews-section" aria-labelledby="creator-reviews-title">
            <div className="creator-reviews-heading">
              <div><div className="eyebrow">COMMUNITY FEEDBACK</div><h3 id="creator-reviews-title">Reviews from buyers</h3><p>Only members who purchased this creator’s edits can leave a review.</p></div>
              <div className="creator-review-score"><strong>{Number(reviewSummary.average_rating || 0).toFixed(1)}</strong><span className="creator-review-stars" aria-label={`${Number(reviewSummary.average_rating || 0).toFixed(1)} out of 5 stars`}>{[1,2,3,4,5].map((star) => <Star key={star} size={14} fill={star <= Math.round(Number(reviewSummary.average_rating || 0)) ? 'currentColor' : 'none'} />)}</span><small>{Number(reviewSummary.review_count || 0)} {Number(reviewSummary.review_count || 0) === 1 ? 'review' : 'reviews'}</small></div>
            </div>
            {reviewLoading ? <div className="creator-review-empty">Loading reviews…</div> : reviews.length === 0 ? <div className="creator-review-empty"><Star size={20}/><strong>Be the first to leave feedback</strong><span>Verified buyers can share their experience here.</span></div> : <div className="creator-review-list">
              {reviews.map((review) => <article className="creator-review-card" key={review.id}>
                <div className="creator-review-avatar">{String(review.reviewer_name || 'B').trim().charAt(0).toUpperCase()}</div>
                <div className="creator-review-content"><div className="creator-review-meta"><strong>{review.reviewer_name || 'Buyer'}</strong><span>{review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}</span></div><div className="creator-review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map((star) => <Star key={star} size={13} fill={star <= Number(review.rating) ? 'currentColor' : 'none'} />)}</div><p>{review.review_text}</p>{review.updated_at && review.created_at && new Date(review.updated_at).getTime() > new Date(review.created_at).getTime() + 1000 && <small className="creator-review-edited">Updated</small>}</div>
              </article>)}
            </div>}
            {reviewError && <div className="creator-review-error" role="alert">{reviewError}</div>}
            {reviewMessage && <div className="creator-review-success" role="status">{reviewMessage}</div>}
            {!user ? <div className="creator-review-cta"><span>Sign in and purchase an edit from this creator to share your experience.</span><button type="button" className="secondary-cta" onClick={() => onLoginRequest?.()}>Log in to review</button></div> : canReview ? <form className="creator-review-form" onSubmit={submitReview}>
              <div className="creator-review-form-heading"><strong>{myReview ? 'Update your review' : 'Share your experience'}</strong><span>Be helpful and respectful.</span></div>
              <div className="creator-review-rating-picker" role="group" aria-label="Choose a rating">{[1,2,3,4,5].map((star) => <button type="button" key={star} className={star <= reviewRating ? 'is-selected' : ''} onClick={() => setReviewRating(star)} aria-label={`${star} star${star === 1 ? '' : 's'}`}><Star size={20} fill={star <= reviewRating ? 'currentColor' : 'none'} /></button>)}</div>
              <label htmlFor="creator-review-text">Your review</label><textarea id="creator-review-text" minLength={8} maxLength={1000} required value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="What did you like about the edit and creator?" rows={4}/>
              <div className="creator-review-form-footer"><small>{reviewText.trim().length}/1000 characters</small><button type="submit" className="primary-cta" disabled={reviewSubmitting || reviewText.trim().length < 8}><Send size={15}/>{reviewSubmitting ? 'Saving…' : myReview ? 'Update review' : 'Publish review'}</button></div>
            </form> : <div className="creator-review-locked"><ShieldCheck size={17}/><span><strong>Buyer reviews</strong><small>Purchase at least one edit from this creator to unlock the review form. Reviews help other members choose with confidence.</small></span></div>}
          </section>

          <p className="public-creator-disclaimer">TikTok follower counts are fetched from public profile data and may be delayed or unavailable.</p>
        </>}
      </section>
    </div>
  );
}
