import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, CheckCircle2, CloudUpload, RefreshCw, ShieldCheck } from 'lucide-react';
import './admin-watermark-queue.css';
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
function Queue() {
  const [items,setItems]=useState([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[msg,setMsg]=useState('');
  const token=localStorage.getItem('editvault_token');
  async function load(){setBusy('load');setError('');try{if(!token)throw Error('Sign in to EditVault as an administrator first.');
    const response=await fetch(`${API}/api/edits/admin/manual-watermarks`,{headers:{Authorization:`Bearer ${token}`}});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Administrator access required.');setItems(data.requests||[]);
  }catch(e){setError(e.message)}finally{setBusy('')}}
  useEffect(()=>{load()},[]);
  async function deliver(id,file){if(!file)return;setBusy(id);setMsg('');setError('');try{const form=new FormData();form.append('video',file);
    const response=await fetch(`${API}/api/edits/admin/manual-watermarks/${id}/deliver`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Delivery failed.');setMsg('Custom video delivered. The buyer can now download it from My Library.');await load();
  }catch(e){setError(e.message)}finally{setBusy('')}}
  return <main className="evm-admin"><nav><a href="/admin"><ArrowLeft size={16}/> Admin</a><span><ShieldCheck size={17}/> EDITVAULT / CUSTOM REQUESTS</span><button disabled={!!busy} onClick={load}><RefreshCw size={16}/> Refresh</button></nav>
    <header><p>CREATOR SERVICES</p><h1>Manual watermark <span>queue.</span></h1><div>Requests purchased for an additional 40 points. Upload the finished MP4, MOV or WebM video to mark each request as delivered.</div></header>
    {error&&<section className="evm-warning">{error}</section>}{msg&&<section className="evm-success">{msg}</section>}
    <div className="evm-count">{items.filter(x=>x.manual_watermark_status==='pending').length} PENDING · {items.length} TOTAL</div>
    <section className="evm-list">{items.map(x=><article key={x.purchase_id}><div><small>{x.created_at?new Date(x.created_at).toLocaleString():''}</small><h2>{x.title}</h2><p>Buyer: <strong>{x.buyer_name}</strong> · {x.buyer_email}</p><p>Name requested: <strong>{x.watermark_name}</strong></p><div className="evm-brief">{x.manual_watermark_note||'No additional instructions supplied.'}</div></div><div className="evm-actions"><strong className={x.manual_watermark_status==='completed'?'delivered':''}>{x.manual_watermark_status==='completed'?<><CheckCircle2 size={14}/> DELIVERED</>:'PENDING · 40 PTS'}</strong>{x.manual_watermark_status==='pending'&&<label className="evm-upload"><CloudUpload size={16}/>{busy===x.purchase_id?'Uploading…':'Upload finished video'}<input disabled={!!busy} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e=>{const file=e.target.files?.[0];if(file&&window.confirm('Deliver this video to '+x.buyer_name+'?'))deliver(x.purchase_id,file);e.target.value=''}}/></label>}</div></article>)}{!items.length&&!busy&&!error&&<div className="evm-empty">No manual customization requests yet.</div>}</section>
  </main>
}
createRoot(document.getElementById('root')).render(<Queue/>);
