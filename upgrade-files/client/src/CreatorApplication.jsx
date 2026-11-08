import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Clock3, ExternalLink, Send, ShieldCheck, X } from 'lucide-react';
import './creator-application.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || data.message || 'Request failed.'), { payload: data });
  return data;
}

function getToken() {
  return localStorage.getItem('editvault_token');
}

export default function CreatorApplication({ open, onClose, user, onApplicationChange, onNotice }) {
  const [application, setApplication] = useState(null);
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [applicantNote, setApplicantNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadApplication = useCallback(async () => {
    const token = getToken();
    if (!token || !user?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await readJson(await fetch(`${API_URL}/api/creators/applications/mine`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }));
      const next = data.application || null;
      setApplication(next);
      setTiktokUrl(next?.tiktok_url || '');
      setApplicantNote(next?.applicant_note || '');
      onApplicationChange?.(next);
    } catch (requestError) {
      setError(requestError.message || 'Could not load your creator application.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, onApplicationChange]);

  useEffect(() => {
    if (open && user?.id) loadApplication();
  }, [open, user?.id, loadApplication]);

  if (!open) return null;

  const submitApplication = async (event) => {
    event.preventDefault();
    const token = getToken();
    if (!token) { setError('Please log in again.'); return; }
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await readJson(await fetch(`${API_URL}/api/creators/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktokUrl: tiktokUrl.trim(), applicantNote: applicantNote.trim() }),
      }));
      const next = data.application || null;
      setApplication(next);
      onApplicationChange?.(next);
      onNotice?.(data.message || 'Creator application submitted.');
    } catch (requestError) {
      if (requestError.payload?.application) {
        setApplication(requestError.payload.application);
        onApplicationChange?.(requestError.payload.application);
      }
      setError(requestError.message || 'Could not submit the creator application.');
    } finally {
      setSubmitting(false);
    }
  };

  const isApproved = application?.status === 'approved' || (user?.role === 'creator' && user?.verification_status === 'verified');
  const isPending = application?.status === 'pending';

  return (
    <div className="creator-application-backdrop" role="presentation" onClick={onClose}>
      <section className="creator-application-modal" role="dialog" aria-modal="true" aria-labelledby="creator-application-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="creator-application-close" onClick={onClose} aria-label="Close creator application"><X size={19} /></button>
        <div className="creator-application-icon"><ShieldCheck size={23} /></div>
        <div className="eyebrow">EDITVAULT · CREATOR ACCESS</div>
        <h2 id="creator-application-title">Apply as a <span>creator.</span></h2>
        <p className="creator-application-intro">This is a separate access request, not a profile edit. Your public profile settings will stay unchanged.</p>

        {loading ? <div className="creator-application-state">Checking your application…</div> : isApproved ? (
          <div className="creator-application-status is-approved"><BadgeCheck size={20} /><div><strong>Application approved</strong><span>Your creator tools are active. Open Creator Studio to publish work.</span></div><button type="button" onClick={onClose}>Done</button></div>
        ) : isPending ? (
          <div className="creator-application-status is-pending"><Clock3 size={20} /><div><strong>Application under review</strong><span>Your request was sent to the administrator. You can close this window and keep using EditVault while you wait.</span>{application?.tiktok_url && <a href={application.tiktok_url} target="_blank" rel="noreferrer">Submitted TikTok profile <ExternalLink size={13} /></a>}</div><button type="button" onClick={onClose}>Close</button></div>
        ) : (
          <form className="creator-application-form" onSubmit={submitApplication}>
            {application?.status === 'rejected' && <div className="creator-application-rejected"><strong>Previous request declined</strong><span>{application.admin_note || 'You can submit a new application with updated information.'}</span></div>}
            <label>TikTok profile URL<input type="url" required maxLength={1200} value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://www.tiktok.com/@username"/><small>This link is saved with the application only. It will not overwrite your public profile.</small></label>
            <label>About your edits <span>(optional)</span><textarea rows={3} maxLength={700} value={applicantNote} onChange={(event) => setApplicantNote(event.target.value)} placeholder="What kind of edits do you make?" /></label>
            {error && <div className="creator-application-error" role="alert">{error}</div>}
            <button className="creator-application-submit" type="submit" disabled={submitting || !tiktokUrl.trim()}>{submitting ? 'Sending request…' : 'Send application'} <Send size={16} /></button>
          </form>
        )}
        {!loading && error && (isApproved || isPending) && <div className="creator-application-error" role="alert">{error}</div>}
        <div className="creator-application-footnote"><ArrowUpRight size={14} /> Administrator approval is required before upload tools are enabled.</div>
      </section>
    </div>
  );
}
