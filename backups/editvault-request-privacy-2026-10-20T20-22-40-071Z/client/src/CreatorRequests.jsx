import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, Clock3, Coins, Inbox, LoaderCircle, MessageSquareText, RefreshCw, Send, Sparkles, UserRound, X } from 'lucide-react';
import './creator-requests.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const statusLabels = {
  requested: 'New request', quoted: 'Offer sent', accepted: 'Accepted', declined: 'Declined',
  in_progress: 'In progress', delivered: 'Delivered', cancelled: 'Cancelled',
};
const statusClasses = {
  requested: 'new', quoted: 'quoted', accepted: 'accepted', declined: 'declined',
  in_progress: 'progress', delivered: 'delivered', cancelled: 'cancelled',
};
const currency = (value) => Number(value || 0).toLocaleString();

export default function CreatorRequests({ user, activePage, onLoginRequest }) {
  const [view, setView] = useState('incoming');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [quotes, setQuotes] = useState({});
  const isArabic = localStorage.getItem('editvault_language') === 'ar';
  const t = (en, ar) => isArabic ? ar : en;

  const loadRequests = useCallback(async () => {
    const token = localStorage.getItem('editvault_token');
    if (!token || !user?.id) { setRequests([]); return; }
    setLoading(true); setLoadError('');
    try {
      const response = await fetch(`${API_URL}/api/custom-requests/mine`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load requests.');
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) { setLoadError(error.message || 'Could not load requests.'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { if (activePage === 'requests') loadRequests(); }, [activePage, loadRequests]);

  const incoming = useMemo(() => requests.filter((item) => item.creator_id === user?.id), [requests, user?.id]);
  const sent = useMemo(() => requests.filter((item) => item.requester_id === user?.id), [requests, user?.id]);
  const visible = view === 'incoming' ? incoming : sent;

  const updateRequest = async (request, status, quotePoints = null) => {
    const token = localStorage.getItem('editvault_token');
    if (!token) { onLoginRequest?.(); return; }
    setBusyId(request.id); setLoadError(''); setNotice('');
    try {
      const response = await fetch(`${API_URL}/api/custom-requests/${encodeURIComponent(request.id)}/status`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, quotePoints }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update this request.');
      setNotice(data.message || t('Request updated.', 'تم تحديث الطلب.'));
      await loadRequests();
    } catch (error) { setLoadError(error.message || 'Could not update this request.'); }
    finally { setBusyId(''); }
  };

  if (activePage !== 'requests') return null;
  if (!user) return <section className="ev-request-center"><div className="ev-request-hero"><span className="ev-request-kicker"><Sparkles size={15}/> EDITVAULT WORKFLOW</span><h1>{t('Creator requests', 'طلبات التعديل')}</h1><p>{t('Keep custom edit briefs, quotes, and delivery status in one place.', 'تابع تفاصيل طلبات التعديل والعروض وحالة التسليم في مكان واحد.')}</p><button className="ev-request-primary" onClick={() => onLoginRequest?.()}>{t('Log in to continue', 'سجّل الدخول للمتابعة')}</button></div></section>;

  return <section className="ev-request-center" aria-labelledby="ev-requests-title">
    <div className="ev-request-hero">
      <span className="ev-request-kicker"><Sparkles size={15}/> EDITVAULT WORKFLOW</span>
      <h1 id="ev-requests-title">{t('Custom edit requests', 'طلبات التعديل المخصصة')}</h1>
      <p>{t('Manage incoming briefs, send point-based offers, and keep every project status clear.', 'استقبل تفاصيل التعديلات، وابعت عروض بالنقاط، وتابع حالة كل مشروع بوضوح.')}</p>
      <div className="ev-request-stats"><div><Inbox size={17}/><span><b>{incoming.length}</b><small>{t('Incoming', 'واردة')}</small></span></div><div><Send size={17}/><span><b>{sent.length}</b><small>{t('Sent', 'مرسلة')}</small></span></div></div>
    </div>
    <div className="ev-request-toolbar">
      <div className="ev-request-tabs" role="tablist" aria-label={t('Request type', 'نوع الطلب')}>
        <button className={view === 'incoming' ? 'is-active' : ''} onClick={() => setView('incoming')} role="tab" aria-selected={view === 'incoming'}><Inbox size={16}/>{t('For me', 'طلبات الكريتور')}<span>{incoming.length}</span></button>
        <button className={view === 'sent' ? 'is-active' : ''} onClick={() => setView('sent')} role="tab" aria-selected={view === 'sent'}><Send size={16}/>{t('I requested', 'طلباتي')}<span>{sent.length}</span></button>
      </div>
      <button className="ev-request-refresh" onClick={loadRequests} disabled={loading}><RefreshCw size={15}/>{t('Refresh', 'تحديث')}</button>
    </div>
    {notice && <div className="ev-request-message success" role="status">{notice}</div>}
    {loadError && <div className="ev-request-message error" role="alert">{loadError}</div>}
    {loading ? <div className="ev-request-empty"><LoaderCircle className="ev-spin" size={25}/><strong>{t('Loading requests…', 'جارٍ تحميل الطلبات…')}</strong></div> : visible.length === 0 ? <div className="ev-request-empty"><MessageSquareText size={27}/><strong>{view === 'incoming' ? t('No incoming requests yet', 'لا توجد طلبات واردة حتى الآن') : t('No requests sent yet', 'لم ترسل أي طلبات حتى الآن')}</strong><p>{view === 'incoming' ? t('When a client requests a custom edit from your creator profile, it will appear here.', 'عندما يطلب عميل تعديلًا من بروفايلك، سيظهر الطلب هنا.') : t('Open a creator profile and choose “Request a custom edit” to start a project.', 'افتح بروفايل كريتور واضغط «اطلب تعديل مخصص» لبدء مشروع.')}</p></div> : <div className="ev-request-list">
      {visible.map((request) => {
        const isCreator = request.creator_id === user.id;
        const isBusy = busyId === request.id;
        const otherName = isCreator ? request.requester_name : request.creator_name;
        const quoteValue = quotes[request.id] ?? (request.quote_points ? String(request.quote_points) : '');
        return <article className="ev-request-card" key={request.id}>
          <div className="ev-request-card-top"><div className="ev-request-person"><span className="ev-request-person-icon"><UserRound size={18}/></span><div><small>{isCreator ? t('Requested by', 'العميل') : t('Creator', 'الكريتور')}</small><strong>{otherName || t('EditVault member', 'عضو EditVault')}</strong></div></div><span className={`ev-request-status ${statusClasses[request.status] || ''}`}>{t(statusLabels[request.status] || request.status, ({requested:'طلب جديد',quoted:'تم إرسال عرض',accepted:'تم القبول',declined:'مرفوض',in_progress:'قيد التنفيذ',delivered:'تم التسليم',cancelled:'ملغي'})[request.status] || request.status)}</span></div>
          <div className="ev-request-card-body"><h3>{request.title}</h3><p className="ev-request-brief">{request.brief}</p><div className="ev-request-meta"><span><CalendarDays size={14}/>{request.deadline ? new Date(`${request.deadline}T12:00:00`).toLocaleDateString() : t('Flexible deadline', 'موعد مرن')}</span><span><Coins size={14}/>{request.quote_points ? `${currency(request.quote_points)} pts ${t('offered', 'عرض')}` : request.budget_points ? `${currency(request.budget_points)} pts ${t('budget', 'ميزانية')}` : t('Budget not set', 'الميزانية غير محددة')}</span><span><Clock3 size={14}/>{new Date(request.created_at).toLocaleDateString()}</span></div>{request.reference_url && <a className="ev-request-reference" href={request.reference_url} target="_blank" rel="noreferrer">{t('Open reference link', 'افتح الرابط المرجعي')} ↗</a>}{request.creator_note && <p className="ev-request-note"><b>{t('Creator note:', 'ملاحظة الكريتور:')}</b> {request.creator_note}</p>}</div>
          <div className="ev-request-card-actions">
            {isCreator && request.status === 'requested' && <><button className="ev-request-primary" onClick={() => updateRequest(request, 'accepted')} disabled={isBusy}><Check size={15}/>{t('Accept request', 'قبول الطلب')}</button><button className="ev-request-secondary danger" onClick={() => updateRequest(request, 'declined')} disabled={isBusy}><X size={15}/>{t('Decline', 'رفض')}</button></>}
            {isCreator && ['requested','accepted'].includes(request.status) && <div className="ev-request-quote"><input type="number" min="1" max="1000000" value={quoteValue} onChange={(event) => setQuotes((old) => ({ ...old, [request.id]: event.target.value }))} placeholder={t('Offer in points', 'العرض بالنقاط')} aria-label={t('Quote in points', 'قيمة العرض بالنقاط')}/><button className="ev-request-secondary" onClick={() => { const n = Number(quoteValue); if (Number.isSafeInteger(n) && n > 0) updateRequest(request, 'quoted', n); else setLoadError(t('Enter a valid point offer.', 'اكتب قيمة نقاط صحيحة للعرض.')); }} disabled={isBusy}><Send size={14}/>{t('Send offer', 'إرسال العرض')}</button></div>}
            {isCreator && request.status === 'accepted' && <button className="ev-request-primary" onClick={() => updateRequest(request, 'in_progress')} disabled={isBusy}>{t('Start work', 'بدء التنفيذ')}</button>}
            {isCreator && request.status === 'in_progress' && <button className="ev-request-primary" onClick={() => updateRequest(request, 'delivered')} disabled={isBusy}><Check size={15}/>{t('Mark delivered', 'تحديد كمُسلّم')}</button>}
            {!isCreator && request.status === 'quoted' && <button className="ev-request-primary" onClick={() => updateRequest(request, 'accepted')} disabled={isBusy}><Check size={15}/>{t('Accept offer', 'قبول العرض')}</button>}
            {!isCreator && ['requested','quoted','accepted'].includes(request.status) && <button className="ev-request-secondary danger" onClick={() => updateRequest(request, 'cancelled')} disabled={isBusy}><X size={15}/>{t('Cancel request', 'إلغاء الطلب')}</button>}
            {isBusy && <span className="ev-request-saving"><LoaderCircle size={14} className="ev-spin"/>{t('Saving…', 'جارٍ الحفظ…')}</span>}
          </div>
        </article>;
      })}
    </div>}
    <p className="ev-request-footnote">{t('Point offers are recorded here, but points are not charged automatically. Confirm delivery terms with the client before starting work.', 'العرض بالنقاط بيتسجل هنا، لكن النقاط لا تُخصم تلقائيًا. اتفق مع العميل على تفاصيل التسليم قبل بدء التنفيذ.')}</p>
  </section>;
}
