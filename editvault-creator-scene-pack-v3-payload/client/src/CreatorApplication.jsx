import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, ExternalLink, LoaderCircle, Send, ShieldCheck, X } from 'lucide-react';
import './creator-application.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  return data;
}

function authHeaders(json = false) {
  const token = localStorage.getItem('editvault_token');
  if (!token) throw new Error('Please log in first.');
  return { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}

export default function CreatorApplication({ open, onClose, user, onNotice, onUserUpdate }) {
  const [application, setApplication] = useState(null);
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open || !user || user.role === 'admin') return undefined;
    let cancelled = false;
    setLoading(true); setError(''); setSuccess('');
    fetch(`${API_URL}/api/creators/applications/mine`, { headers: authHeaders() })
      .then(readJson)
      .then((data) => {
        if (cancelled) return;
        const current = data.application || null;
        setApplication(current);
        if (current?.status === 'approved' && user.role !== 'creator') onUserUpdate?.({ id: user.id, role: 'creator' });
        setTiktokUrl(current?.tiktok_url || '');
        setPortfolioUrl(current?.portfolio_url || '');
        setMessage(current?.message || '');
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Could not load your application status.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, user?.id, user?.role, onUserUpdate]);

  if (!open) return null;

  const alreadyCreator = user?.role === 'creator' || application?.status === 'approved';
  const pending = application?.status === 'pending';
  const submit = async (event) => {
    event.preventDefault();
    if (submitting || pending || alreadyCreator || user?.role === 'admin') return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const data = await readJson(await fetch(`${API_URL}/api/creators/applications`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ tiktokUrl: tiktokUrl.trim(), portfolioUrl: portfolioUrl.trim(), message: message.trim() }),
      }));
      setApplication(data.application || data);
      setSuccess(data.message || 'Your creator application was sent to the admin.');
      onNotice?.(data.message || 'Creator application submitted.');
    } catch (e) {
      setError(e.message || 'Could not submit the creator application.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="ev-creator-app-backdrop" role="dialog" aria-modal="true" aria-labelledby="ev-creator-app-title" onClick={onClose}>
      <section className="ev-creator-app-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ev-creator-app-close" onClick={onClose} aria-label="Close creator application"><X size={19} /></button>
        <div className="ev-creator-app-icon"><ShieldCheck size={23} /></div>
        <span className="ev-creator-app-kicker">EDITVAULT / CREATOR ACCESS</span>
        <h2 id="ev-creator-app-title">Apply as a <span>creator</span></h2>
        <p className="ev-creator-app-intro">This is a separate application. It will not change your public profile or profile settings.</p>
        {loading ? <div className="ev-creator-app-state"><LoaderCircle className="ev-creator-app-spin" size={21}/> Loading application status…</div> : alreadyCreator ? (
          <div className="ev-creator-app-status is-approved"><BadgeCheck size={20}/><div><strong>Creator access approved</strong><span>Open Creator Studio to publish and manage your edits.</span></div><button type="button" onClick={onClose}>Done</button></div>
        ) : pending ? (
          <div className="ev-creator-app-status is-pending"><LoaderCircle size={19}/><div><strong>Application pending</strong><span>Your application was sent to the administrator and is waiting for review.</span>{application?.created_at && <small>Submitted {new Date(application.created_at).toLocaleDateString()}</small>}</div></div>
        ) : (
          <form className="ev-creator-app-form" onSubmit={submit}>
            <label>TikTok profile URL <span>Required</span><input type="url" required maxLength={1200} value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@username" /></label>
            <label>Portfolio / example edit <small>Optional</small><input type="url" maxLength={1200} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="Link to your best edit or portfolio" /></label>
            <label>Message to the admin <small>Optional</small><textarea maxLength={1000} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us briefly what kind of edits you make…" /></label>
            {application?.status === 'rejected' && <div className="ev-creator-app-status is-rejected"><X size={18}/><div><strong>Previous application declined</strong><span>{application.admin_note || 'You can submit a new application below.'}</span></div></div>}
            {error && <div className="ev-creator-app-error" role="alert">{error}</div>}
            {success && <div className="ev-creator-app-success" role="status">{success}</div>}
            <button className="ev-creator-app-submit" type="submit" disabled={submitting || !tiktokUrl.trim()}>{submitting ? 'Sending application…' : application?.status === 'rejected' ? 'Resubmit application' : 'Send creator application'} {submitting ? <LoaderCircle className="ev-creator-app-spin" size={16}/> : <Send size={16}/>}</button>
            <small className="ev-creator-app-footnote"><ExternalLink size={13}/> The admin reviews your application separately from your public profile.</small>
          </form>
        )}
      </section>
    </div>
  );
}
