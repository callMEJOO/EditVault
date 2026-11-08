import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BadgeCheck, Coins, FileVideo, LayoutDashboard, RefreshCw, Search, ShieldAlert, ShoppingBag, Users, Eye, EyeOff, RotateCcw, LoaderCircle, MessageSquareWarning, Wallet, Plus, CheckCircle2 } from 'lucide-react';
import './admin-control.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const number = (value) => new Intl.NumberFormat().format(Number(value || 0));
const date = (value) => value ? new Date(value).toLocaleString() : '—';

export default function AdminControlPanel({ active, user, onNotice, onLogin }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [users, setUsers] = useState([]);
  const [edits, setEdits] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [pointForm, setPointForm] = useState({ userId: '', direction: 'credit', amount: '', note: '' });
  const [payoutForm, setPayoutForm] = useState({ creatorId: '', amount: '', currency: 'USD', method: 'PayPal', reference: '', note: '' });
  const [ticketResponses, setTicketResponses] = useState({});
  const [actionBusy, setActionBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyEdit, setBusyEdit] = useState('');
  const [error, setError] = useState('');

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem('editvault_token');
    if (!token) throw new Error('Your session has expired. Please log in again.');
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }, []);

  const load = useCallback(async () => {
    if (!active) return;
    if (!user || user.role !== 'admin') { setError('This area is restricted to administrators.'); return; }
    setLoading(true); setError('');
    try {
      if (tab === 'overview') {
        const data = await request('/api/admin/control/overview');
        setStats(data.stats || null); setRecentPurchases(data.recentPurchases || []);
      } else if (tab === 'users') {
        const data = await request(`/api/admin/control/users?search=${encodeURIComponent(search)}`);
        setUsers(data.users || []);
      } else if (tab === 'content') {
        const params = new URLSearchParams(); if (search.trim()) params.set('search', search.trim()); if (status) params.set('status', status);
        const data = await request(`/api/admin/control/edits?${params.toString()}`); setEdits(data.edits || []);
      } else if (tab === 'ledger') {
        const data = await request('/api/admin/control/ledger'); setLedger(data.entries || []);
      } else if (tab === 'complaints') {
        const data = await request('/api/admin/control/complaints'); setComplaints(data.complaints || []);
      } else if (tab === 'payouts') {
        const data = await request('/api/admin/control/payouts'); setPayouts(data.payouts || []); setCreators(data.creators || []);
      }
    } catch (err) {
      setError(err.message || 'Could not load control panel data.');
    } finally { setLoading(false); }
  }, [active, user, tab, search, status, request]);

  useEffect(() => { load(); }, [load]);

  const moderateEdit = async (edit, nextStatus) => {
    if (!window.confirm(`${nextStatus === 'removed' ? 'Remove' : nextStatus === 'draft' ? 'Move to draft' : 'Restore'} “${edit.title}”?`)) return;
    setBusyEdit(edit.id);
    try {
      await request(`/api/admin/control/edits/${encodeURIComponent(edit.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      onNotice?.(`Content status updated to ${nextStatus}.`);
      await load();
    } catch (err) { setError(err.message || 'Could not update content.'); }
    finally { setBusyEdit(''); }
  };

  const adjustPoints = async (event) => {
    event.preventDefault(); setActionBusy(true); setError('');
    try {
      const result = await request('/api/admin/control/points-adjust', { method: 'POST', body: JSON.stringify({ ...pointForm, amount: Number(pointForm.amount) }) });
      onNotice?.(`Points updated. New balance: ${number(result.balance)}.`);
      setPointForm(v => ({ ...v, amount: '', note: '' }));
      await load();
    } catch (err) { setError(err.message || 'Could not adjust points.'); }
    finally { setActionBusy(false); }
  };
  const updateComplaint = async (ticket, status) => {
    setActionBusy(true); setError('');
    try {
      await request(`/api/admin/control/complaints/${encodeURIComponent(ticket.id)}`, { method: 'PATCH', body: JSON.stringify({ status, adminResponse: ticketResponses[ticket.id] ?? ticket.admin_response ?? '' }) });
      onNotice?.('Complaint updated.'); await load();
    } catch (err) { setError(err.message || 'Could not update complaint.'); }
    finally { setActionBusy(false); }
  };
  const createPayout = async (event) => {
    event.preventDefault(); setActionBusy(true); setError('');
    try {
      await request('/api/admin/control/payouts', { method: 'POST', body: JSON.stringify({ ...payoutForm, amount: Number(payoutForm.amount) }) });
      onNotice?.('Payout record created. Mark it paid only after the transfer is complete.');
      setPayoutForm(v => ({ ...v, amount: '', reference: '', note: '' })); await load();
    } catch (err) { setError(err.message || 'Could not create payout.'); }
    finally { setActionBusy(false); }
  };
  const updatePayout = async (payout, status) => {
    const message = status === 'paid' ? 'Confirm that you have actually sent this payout.' : `Change payout status to ${status}?`;
    if (!window.confirm(message)) return;
    setActionBusy(true); setError('');
    try {
      await request(`/api/admin/control/payouts/${encodeURIComponent(payout.id)}`, { method: 'PATCH', body: JSON.stringify({ status, reference: payout.reference || '', note: payout.admin_note || '' }) });
      onNotice?.(`Payout marked ${status}.`); await load();
    } catch (err) { setError(err.message || 'Could not update payout.'); }
    finally { setActionBusy(false); }
  };

  const statCards = useMemo(() => stats ? [
    { label: 'Total users', value: stats.users, icon: Users },
    { label: 'Creators', value: stats.creators, icon: BadgeCheck },
    { label: 'All edits', value: stats.edits, icon: FileVideo },
    { label: 'Published', value: stats.publishedEdits, icon: Eye },
    { label: 'Purchases', value: stats.purchases, icon: ShoppingBag },
    { label: 'Points in wallets', value: stats.pointsInWallets, icon: Coins },
    { label: 'Pending premium orders', value: stats.pendingPremiumOrders, icon: Activity },
    { label: 'Open complaints', value: stats.openComplaints, icon: MessageSquareWarning },
    { label: 'Pending payouts', value: stats.pendingPayouts, icon: Wallet },
  ] : [], [stats]);

  if (!active) return null;
  if (!user || user.role !== 'admin') return <section className="ev-admin-page"><div className="ev-admin-empty"><ShieldAlert size={28}/><h1>Admin access required</h1><p>Sign in with an administrator account to open EditVault Control.</p><button onClick={() => onLogin?.()}>Sign in</button></div></section>;

  return <section className="ev-admin-page">
    <div className="ev-admin-heading">
      <div><span className="ev-admin-kicker"><span/> EDITVAULT / CONTROL</span><h1>Control <em>Center</em></h1><p>Monitor platform activity and manage published content.</p></div>
      <button className="ev-admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'ev-admin-spin' : ''}/> Refresh</button>
    </div>
    <div className="ev-admin-layout">
      <aside className="ev-admin-sidebar">
        {[['overview','Overview',LayoutDashboard],['users','Users',Users],['content','Content',FileVideo],['ledger','Points ledger',Coins],['points','Adjust points',Coins],['complaints','Complaints',MessageSquareWarning],['payouts','Creator payouts',Wallet]].map(([key,label,Icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setSearch(''); setStatus(''); }}><Icon size={17}/><span>{label}</span></button>)}
        <div className="ev-admin-sidebar-note"><ShieldAlert size={15}/><span>Admin actions are sent to the server and checked against your account role.</span></div>
      </aside>
      <div className="ev-admin-content">
        {error && <div className="ev-admin-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {tab === 'overview' && <>
          <div className="ev-admin-section-title"><div><h2>Platform overview</h2><p>Live counts from the database, not browser estimates.</p></div><span className="ev-admin-live">DATABASE SNAPSHOT</span></div>
          {loading && !stats ? <div className="ev-admin-loading"><LoaderCircle className="ev-admin-spin"/> Loading overview…</div> : <div className="ev-admin-stat-grid">{statCards.map(({label,value,icon:Icon}) => <article className="ev-admin-stat" key={label}><span className="ev-admin-stat-icon"><Icon size={17}/></span><span className="ev-admin-stat-label">{label}</span><strong>{number(value)}</strong></article>)}</div>}
          <div className="ev-admin-table-card"><div className="ev-admin-table-heading"><div><h3>Recent purchases</h3><p>Latest completed edit unlocks recorded in the database.</p></div></div>
            {recentPurchases.length ? <div className="ev-admin-table-wrap"><table><thead><tr><th>EDIT</th><th>BUYER</th><th>POINTS</th><th>DATE</th></tr></thead><tbody>{recentPurchases.map((p) => <tr key={p.id}><td><strong>{p.edit_title}</strong><small>{String(p.id).slice(0,8)}</small></td><td>{p.buyer_name || p.buyer_email}<small>{p.buyer_email}</small></td><td><b className="ev-admin-points">{number(p.price_points)}</b></td><td>{date(p.created_at)}</td></tr>)}</tbody></table></div> : <div className="ev-admin-empty-inline">No edit purchases recorded yet.</div>}
          </div>
        </>}
        {tab === 'users' && <><div className="ev-admin-section-title"><div><h2>User directory</h2><p>Search accounts and inspect their points, purchases and uploads.</p></div></div><div className="ev-admin-toolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Search name or email…"/></label><button onClick={load} disabled={loading}>Search</button></div>{loading ? <div className="ev-admin-loading">Loading users…</div> : <div className="ev-admin-table-card"><div className="ev-admin-table-wrap"><table><thead><tr><th>USER / ID</th><th>ROLE</th><th>POINTS</th><th>PURCHASES</th><th>EDITS</th><th>JOINED</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><strong>{u.display_name || 'Unnamed user'}</strong><small>{u.email}</small><small className="ev-admin-uuid">{u.id}</small></td><td><span className={`ev-admin-role role-${u.role}`}>{u.role}</span></td><td>{number(u.points_balance)}</td><td>{number(u.purchase_count)}</td><td>{number(u.edit_count)}</td><td>{date(u.created_at)}</td></tr>)}</tbody></table></div>{!users.length&&<div className="ev-admin-empty-inline">No users match that search.</div>}</div>}</>}
        {tab === 'content' && <><div className="ev-admin-section-title"><div><h2>Content moderation</h2><p>Review marketplace edits and remove or restore listings.</p></div></div><div className="ev-admin-toolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Search edit or creator…"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="removed">Removed</option></select><button onClick={load} disabled={loading}>Filter</button></div>{loading ? <div className="ev-admin-loading">Loading content…</div> : <div className="ev-admin-table-card"><div className="ev-admin-table-wrap"><table><thead><tr><th>EDIT</th><th>CREATOR</th><th>PRICE</th><th>SALES</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{edits.map(e=><tr key={e.id}><td><strong>{e.title}</strong><small>{e.category} · {date(e.created_at)}</small></td><td>{e.creator_name || e.creator_email}<small>{e.creator_email}</small></td><td>{number(e.price_points)} pts</td><td>{number(e.purchase_count)}</td><td><span className={`ev-admin-role status-${e.status}`}>{e.status}</span></td><td>{busyEdit===e.id?<span>Saving…</span>:e.status==='removed'?<button className="ev-admin-action" onClick={()=>moderateEdit(e,'published')}><RotateCcw size={14}/> Restore</button>:<button className="ev-admin-action danger" onClick={()=>moderateEdit(e,'removed')}><EyeOff size={14}/> Remove</button>}</td></tr>)}</tbody></table></div>{!edits.length&&<div className="ev-admin-empty-inline">No content found.</div>}</div>}</>}
        {tab === 'points' && <>
          <div className="ev-admin-section-title"><div><h2>Manual points adjustment</h2><p>Add or deduct points with a mandatory audit reason. The balance cannot go below zero.</p></div></div>
          <form className="ev-admin-form-card" onSubmit={adjustPoints}>
            <label>User ID<input required value={pointForm.userId} onChange={e=>setPointForm(v=>({...v,userId:e.target.value}))} placeholder="Paste the user's UUID from the Users table"/></label>
            <label>Action<select value={pointForm.direction} onChange={e=>setPointForm(v=>({...v,direction:e.target.value}))}><option value="credit">Add points</option><option value="debit">Deduct points</option></select></label>
            <label>Points amount<input type="number" min="1" max="10000000" step="1" required value={pointForm.amount} onChange={e=>setPointForm(v=>({...v,amount:e.target.value}))} placeholder="e.g. 100"/></label>
            <label className="wide">Reason / audit note<textarea required minLength="3" maxLength="500" value={pointForm.note} onChange={e=>setPointForm(v=>({...v,note:e.target.value}))} placeholder="Why are you adjusting this user's points?"/></label>
            <button className="ev-admin-submit" disabled={actionBusy}>{actionBusy?'Saving…':<><Plus size={15}/> Confirm adjustment</>}</button>
          </form>
          <div className="ev-admin-hint">Tip: copy the user's UUID from the Users table via the user details/ID if shown. Every adjustment is saved to the points ledger with the administrator and reason.</div>
        </>}
        {tab === 'complaints' && <>
          <div className="ev-admin-section-title"><div><h2>Support inbox</h2><p>Review complaints, reply to users, and track resolution.</p></div><button className="ev-admin-refresh" onClick={load} disabled={loading}>Refresh inbox</button></div>
          {loading ? <div className="ev-admin-loading">Loading complaints…</div> : complaints.length ? <div className="ev-admin-ticket-list">{complaints.map(t=><article className="ev-admin-ticket" key={t.id}>
            <div className="ev-admin-ticket-top"><div><strong>{t.subject}</strong><small>{t.user_name || 'User'} · {t.email} · {date(t.created_at)}</small></div><span className={`ev-admin-role status-${t.status}`}>{t.status.replace('_',' ')}</span></div>
            <div className="ev-admin-ticket-meta">{t.category} · Ticket {String(t.id).slice(0,8)}</div><p>{t.message}</p>
            <label>Reply to user<textarea value={ticketResponses[t.id] ?? t.admin_response ?? ''} onChange={e=>setTicketResponses(v=>({...v,[t.id]:e.target.value}))} maxLength={4000} placeholder="Write a reply or resolution note…"/></label>
            <div className="ev-admin-ticket-actions"><button className="ev-admin-action" disabled={actionBusy} onClick={()=>updateComplaint(t,'in_progress')}>In progress</button><button className="ev-admin-action" disabled={actionBusy} onClick={()=>updateComplaint(t,'resolved')}><CheckCircle2 size={14}/> Resolve</button><button className="ev-admin-action danger" disabled={actionBusy} onClick={()=>updateComplaint(t,'closed')}>Close</button></div>
          </article>)}</div> : <div className="ev-admin-empty-inline">No complaints have been submitted yet.</div>}
        </>}
        {tab === 'payouts' && <>
          <div className="ev-admin-section-title"><div><h2>Creator payouts</h2><p>Record creator payments. This panel does not send money automatically.</p></div></div>
          <form className="ev-admin-form-card" onSubmit={createPayout}>
            <label>Creator<select required value={payoutForm.creatorId} onChange={e=>setPayoutForm(v=>({...v,creatorId:e.target.value}))}><option value="">Select creator…</option>{creators.map(c=><option key={c.id} value={c.id}>{c.display_name} — {c.email}</option>)}</select></label>
            <label>Amount<input type="number" min="0.01" max="1000000" step="0.01" required value={payoutForm.amount} onChange={e=>setPayoutForm(v=>({...v,amount:e.target.value}))} placeholder="0.00"/></label>
            <label>Currency<select value={payoutForm.currency} onChange={e=>setPayoutForm(v=>({...v,currency:e.target.value}))}><option>USD</option><option>EUR</option><option>EGP</option><option>GBP</option></select></label>
            <label>Payment method<input required value={payoutForm.method} onChange={e=>setPayoutForm(v=>({...v,method:e.target.value}))} placeholder="PayPal, bank transfer, Vodafone Cash…"/></label>
            <label>Transaction reference<input value={payoutForm.reference} onChange={e=>setPayoutForm(v=>({...v,reference:e.target.value}))} placeholder="Optional transaction ID"/></label>
            <label>Admin note<input value={payoutForm.note} onChange={e=>setPayoutForm(v=>({...v,note:e.target.value}))} placeholder="Optional note"/></label>
            <button className="ev-admin-submit" disabled={actionBusy}>{actionBusy?'Saving…':<><Plus size={15}/> Create payout record</>}</button>
          </form>
          <div className="ev-admin-table-card"><div className="ev-admin-table-heading"><h3>Creator sales context</h3><p>Lifetime sale points are a reference only, not a cash-conversion calculation.</p></div><div className="ev-admin-table-wrap"><table><thead><tr><th>CREATOR</th><th>LIFETIME SALE POINTS</th></tr></thead><tbody>{creators.map(c=><tr key={c.id}><td><strong>{c.display_name}</strong><small>{c.email}</small></td><td>{number(c.lifetime_sale_points)} pts</td></tr>)}</tbody></table></div></div>
          <div className="ev-admin-table-card ev-admin-payout-table"><div className="ev-admin-table-heading"><h3>Payout history</h3></div><div className="ev-admin-table-wrap"><table><thead><tr><th>CREATOR</th><th>AMOUNT</th><th>METHOD / REFERENCE</th><th>STATUS</th><th>DATE</th><th>ACTION</th></tr></thead><tbody>{payouts.map(p=><tr key={p.id}><td><strong>{p.creator_name}</strong><small>{p.email}</small></td><td>{Number(p.amount).toFixed(2)} {p.currency}</td><td>{p.method}<small>{p.reference || 'No reference yet'}</small></td><td><span className={`ev-admin-role status-${p.status}`}>{p.status}</span></td><td>{date(p.created_at)}</td><td>{p.status==='pending'?<><button className="ev-admin-action" disabled={actionBusy} onClick={()=>updatePayout(p,'paid')}>Mark paid</button> <button className="ev-admin-action danger" disabled={actionBusy} onClick={()=>updatePayout(p,'rejected')}>Reject</button></>:<span>—</span>}</td></tr>)}</tbody></table></div>{!payouts.length&&<div className="ev-admin-empty-inline">No payout records yet.</div>}</div>
        </>}
        {tab === 'ledger' && <><div className="ev-admin-section-title"><div><h2>Points ledger</h2><p>Read-only audit view of recent point movements.</p></div></div>{loading ? <div className="ev-admin-loading">Loading ledger…</div> : <div className="ev-admin-table-card"><div className="ev-admin-table-wrap"><table><thead><tr><th>USER</th><th>AMOUNT</th><th>REASON</th><th>REFERENCE / NOTE</th><th>DATE</th></tr></thead><tbody>{ledger.map(l=><tr key={l.id}><td><strong>{l.display_name || 'User'}</strong><small>{l.email}</small></td><td><b className={Number(l.amount)>=0?'ev-admin-positive':'ev-admin-negative'}>{Number(l.amount)>0?'+':''}{number(l.amount)}</b></td><td>{l.reason}</td><td><small>{l.reference_id || '—'}</small>{l.admin_note && <small>{l.admin_note} · by {l.admin_name || 'admin'}</small>}</td><td>{date(l.created_at)}</td></tr>)}</tbody></table></div>{!ledger.length&&<div className="ev-admin-empty-inline">No point transactions recorded yet.</div>}</div>}</>}
      </div>
    </div>
  </section>;
}
