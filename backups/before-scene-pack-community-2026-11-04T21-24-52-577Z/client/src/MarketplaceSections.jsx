import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight, Box, CheckCircle2, Clock3, Download, ExternalLink, Film,
  Layers, Package, Plus, RefreshCw, Scissors, Send, ShieldCheck, Sparkles, Upload,
} from 'lucide-react';
import './marketplace-workflow.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TEXT = {
  en: {
    packsEyebrow: 'ASSETS FOR YOUR NEXT CUT', packsTitleA: 'Scene packs.', packsTitleB: 'Instant inspiration.', packsDesc: 'Curated visual assets and footage packs for your next edit.', available: 'AVAILABLE', emptyPacks: 'The next drop is being prepared.', emptyPacksSub: 'New scene packs will appear here when they are published.', adminPacks: 'Scene pack management', addPack: 'Upload a scene pack', loginToUpload: 'Log in to upload a scene pack.', coverImage: 'Required cover image', coverHelp: 'JPG, PNG or WebP · maximum 5 MB', uploadedBy: 'Uploaded by', title: 'Pack name', quality: 'Quality', category: 'Category', price: 'Price in points', coverUrl: 'Cover image URL (optional)', assetUrl: 'External download link', uploadFile: 'Upload archive', linkInstead: 'Use a download link instead', uploadInstead: 'Upload a file instead', fileHelp: 'ZIP, 7Z or RAR · maximum 500 MB', description: 'Description (optional)', savePack: 'Publish pack', saving: 'Saving…', buyPack: 'Unlock pack', opening: 'Opening…', managePacks: 'Manage published packs', hide: 'Hide', publish: 'Publish', packPublished: 'Scene pack published.', packPurchase: 'Pack unlocked. Opening your download…', clipEyebrow: 'FROM CLIPS TO A FINISHED CUT', clipTitleA: 'Your idea.', clipTitleB: 'Your montage.', clipDesc: 'Send a short brief. You can agree on style, length, and details with the editor after they reply.', clipTitle: 'Project name', sources: 'Reference links (optional)', sourcesPlaceholder: 'Paste a reference link or source links (optional)', budget: 'Budget in points (optional)', notes: 'What video do you want?', notesPlaceholder: 'A short description is enough. Explain the main idea and attach a link if you have one…', sendRequest: 'Send assembly request', sending: 'Sending request…', myRequests: 'Assembly requests', noRequests: 'No assembly requests yet.', adminRequests: 'Incoming clip-assembly requests', submitted: 'Submitted', reviewing: 'Reviewing', quoted: 'Quote ready', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', update: 'Update', signInRequest: 'Log in to submit and track a request.', requestSent: 'Assembly request sent.', refresh: 'Refresh', points: 'PTS', animationNote: 'Smooth by design. Reduced-motion preferences are respected.',
  },
  ar: {
    packsEyebrow: 'موارد لمونتاجك القادم', packsTitleA: 'Scene Packs.', packsTitleB: 'إلهام جاهز.', packsDesc: 'حزم لقطات وموارد بصرية منتقاة لمشروعك القادم.', available: 'متاح', emptyPacks: 'نجهّز الدفعة القادمة.', emptyPacksSub: 'ستظهر حزم المشاهد الجديدة هنا بمجرد نشرها.', adminPacks: 'إدارة حزم المشاهد', addPack: 'ارفع Scene Pack', loginToUpload: 'سجّل الدخول لرفع Scene Pack.', coverImage: 'صورة الغلاف (إلزامية)', coverHelp: 'JPG أو PNG أو WebP · بحد أقصى 5 ميجابايت', uploadedBy: 'رفعها', title: 'اسم الحزمة', quality: 'الجودة', category: 'التصنيف', price: 'السعر بالنقاط', coverUrl: 'رابط الغلاف (اختياري)', assetUrl: 'رابط التحميل الخارجي', uploadFile: 'ارفع ملف الحزمة', linkInstead: 'استخدم رابط تحميل بدلًا من الملف', uploadInstead: 'ارفع ملفًا بدلًا من الرابط', fileHelp: 'ZIP أو 7Z أو RAR · بحد أقصى 500 ميجابايت', description: 'الوصف (اختياري)', savePack: 'نشر الحزمة', saving: 'جارٍ الحفظ…', buyPack: 'فتح الحزمة', opening: 'جارٍ الفتح…', managePacks: 'إدارة الحزم المنشورة', hide: 'إخفاء', publish: 'نشر', packPublished: 'تم نشر الحزمة.', packPurchase: 'تم فتح الحزمة. جارٍ فتح رابط التحميل…', clipEyebrow: 'من المقاطع إلى مونتاج جاهز', clipTitleA: 'فكرتك.', clipTitleB: 'مونتاجك.', clipDesc: 'ابعت وصفًا مختصرًا للفيديو؛ تقدر تتفق مع المونتير على الستايل والمدة وباقي التفاصيل بعد الرد.', clipTitle: 'اسم المشروع', sources: 'روابط مرجعية (اختياري)', sourcesPlaceholder: 'ضع رابطًا مرجعيًا أو روابط المصادر (اختياري)', budget: 'الميزانية بالنقاط (اختياري)', notes: 'الفيديو المطلوب', notesPlaceholder: 'اكتب الفكرة الأساسية باختصار، وأضف رابطًا لو عندك…', sendRequest: 'إرسال طلب التجميع', sending: 'جارٍ إرسال الطلب…', myRequests: 'طلبات التجميع', noRequests: 'لا توجد طلبات تجميع حتى الآن.', adminRequests: 'طلبات تجميع المقاطع الواردة', submitted: 'مُرسل', reviewing: 'قيد المراجعة', quoted: 'تم تجهيز العرض', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي', update: 'تحديث', signInRequest: 'سجّل الدخول لإرسال الطلب ومتابعته.', requestSent: 'تم إرسال طلب التجميع.', refresh: 'تحديث', points: 'نقطة', animationNote: 'حركة سلسة مع احترام إعداد تقليل الحركة.',
  },
  es: {
    packsEyebrow: 'RECURSOS PARA TU PRÓXIMO CORTE', packsTitleA: 'Scene packs.', packsTitleB: 'Inspiración inmediata.', packsDesc: 'Recursos visuales y paquetes de clips seleccionados para tu próxima edición.', available: 'DISPONIBLES', emptyPacks: 'Estamos preparando el próximo lanzamiento.', emptyPacksSub: 'Los nuevos paquetes aparecerán aquí cuando se publiquen.', adminPacks: 'Gestión de scene packs', addPack: 'Subir scene pack', loginToUpload: 'Inicia sesión para subir un scene pack.', coverImage: 'Imagen de portada obligatoria', coverHelp: 'JPG, PNG o WebP · máximo 5 MB', uploadedBy: 'Subido por', title: 'Nombre del paquete', quality: 'Calidad', category: 'Categoría', price: 'Precio en puntos', coverUrl: 'URL de portada (opcional)', assetUrl: 'Enlace de descarga externo', uploadFile: 'Subir archivo', linkInstead: 'Usar un enlace en su lugar', uploadInstead: 'Subir archivo en lugar del enlace', fileHelp: 'ZIP, 7Z o RAR · máximo 500 MB', description: 'Descripción (opcional)', savePack: 'Publicar paquete', saving: 'Guardando…', buyPack: 'Desbloquear paquete', opening: 'Abriendo…', managePacks: 'Gestionar paquetes', hide: 'Ocultar', publish: 'Publicar', packPublished: 'Paquete publicado.', packPurchase: 'Paquete desbloqueado. Abriendo la descarga…', clipEyebrow: 'DE CLIPS A UN MONTAJE FINAL', clipTitleA: 'Tu idea.', clipTitleB: 'Tu montaje.', clipDesc: 'Envía una descripción breve. El estilo y la duración se pueden acordar después con el editor.', clipTitle: 'Nombre del proyecto', sources: 'Enlaces de referencia (opcional)', sourcesPlaceholder: 'Pega un enlace de referencia o de origen (opcional)', budget: 'Presupuesto en puntos (opcional)', notes: '¿Qué video necesitas?', notesPlaceholder: 'Describe brevemente la idea principal y añade un enlace si tienes uno…', sendRequest: 'Enviar solicitud', sending: 'Enviando…', myRequests: 'Solicitudes de montaje', noRequests: 'Todavía no hay solicitudes.', adminRequests: 'Solicitudes de montaje recibidas', submitted: 'Enviada', reviewing: 'En revisión', quoted: 'Presupuesto listo', in_progress: 'En progreso', completed: 'Completada', cancelled: 'Cancelada', update: 'Actualizar', signInRequest: 'Inicia sesión para enviar y seguir solicitudes.', requestSent: 'Solicitud enviada.', refresh: 'Actualizar', points: 'PTS', animationNote: 'Animaciones suaves; se respeta reducir movimiento.',
  },
};

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

function ScenePackCard({ pack, user, onUnlock, busy, t }) {
  const coverUrl = pack.cover_url ? (String(pack.cover_url).startsWith('/') ? `${API_URL}${pack.cover_url}` : pack.cover_url) : '';
  return (
    <article className="evx-pack-card">
      <div className="evx-pack-art" style={coverUrl ? { backgroundImage: `linear-gradient(180deg, transparent 25%, rgba(9,8,15,.78)), url("${coverUrl.replace(/"/g, '%22')}")` } : undefined}>
        {!pack.cover_url && <><span className="evx-art-orb evx-art-orb-one"/><span className="evx-art-orb evx-art-orb-two"/><Layers size={34}/></>}
        <span className="evx-pack-chip"><Package size={12}/>{pack.quality || '1080p'}</span>
        <span className="evx-pack-number">SCENE DROP</span>
      </div>
      <div className="evx-pack-content">
        <div><h3>{pack.title}</h3><p>{pack.description || 'A curated visual pack for your next creative project.'}</p></div>
        <div className="evx-pack-footer"><span className="evx-pack-price"><Box size={15}/><strong>{Number(pack.price_points).toLocaleString()}</strong><small>{t.points}</small></span>
          <button type="button" className="evx-action-btn" disabled={Boolean(busy)} onClick={() => onUnlock(pack)}>{busy ? t.opening : t.buyPack}<ArrowUpRight size={14}/></button>
        </div>
      </div>
    </article>
  );
}

export default function MarketplaceSections({ user, language = 'en', onNotice, onLoginRequest, onPointsChange }) {
  const t = TEXT[language] || TEXT.en;
  const [packs, setPacks] = useState([]);
  const [adminPacks, setAdminPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [savingPack, setSavingPack] = useState(false);
  const [packBusy, setPackBusy] = useState('');
  const [packForm, setPackForm] = useState({ title: '', quality: '1080p', pricePoints: '25', sourceMode: 'upload', assetUrl: '', assetFile: null, coverFile: null, description: '' });
  const [clipForm, setClipForm] = useState({ title: '', sourceLinks: '', budgetPoints: '', description: '' });
  const [clipRequests, setClipRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [updatingRequest, setUpdatingRequest] = useState('');

  const loadPacks = useCallback(async () => {
    setLoadingPacks(true);
    try {
      const data = await readJson(await fetch(`${API_URL}/api/marketplace/scene-packs`));
      setPacks(Array.isArray(data.packs) ? data.packs : []);
    } catch (error) {
      onNotice?.(error.message || 'Could not load scene packs.');
    } finally { setLoadingPacks(false); }
  }, [onNotice]);

  const loadAdminPacks = useCallback(async () => {
    if (user?.role !== 'admin' || !localStorage.getItem('editvault_token')) { setAdminPacks([]); return; }
    try {
      const data = await readJson(await fetch(`${API_URL}/api/marketplace/scene-packs/admin`, { headers: authHeaders() }));
      setAdminPacks(Array.isArray(data.packs) ? data.packs : []);
    } catch (error) { onNotice?.(error.message || 'Could not load scene pack management.'); }
  }, [user?.id, user?.role, onNotice]);

  const loadClipRequests = useCallback(async () => {
    if (!user || !localStorage.getItem('editvault_token')) { setClipRequests([]); return; }
    setLoadingRequests(true);
    try {
      const data = await readJson(await fetch(`${API_URL}/api/marketplace/clip-requests`, { headers: authHeaders() }));
      setClipRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) { onNotice?.(error.message || 'Could not load clip assembly requests.'); }
    finally { setLoadingRequests(false); }
  }, [user?.id, user?.role, onNotice]);

  useEffect(() => { loadPacks(); }, [loadPacks]);
  useEffect(() => { loadAdminPacks(); }, [loadAdminPacks]);
  useEffect(() => { loadClipRequests(); }, [loadClipRequests]);

  const updatePoints = async () => {
    const token = localStorage.getItem('editvault_token');
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); onPointsChange?.(Number(data.balance || 0)); }
    } catch { /* wallet update is helpful but does not block the UI */ }
  };

  const unlockPack = async (pack) => {
    if (!user) { onLoginRequest?.(); return; }
    if (packBusy) return;
    const popup = window.open('about:blank', '_blank');
    if (!popup) { onNotice?.('Allow pop-ups for this site before unlocking a scene pack.'); return; }
    popup.opener = null;
    setPackBusy(String(pack.id));
    try {
      const purchased = await readJson(await fetch(`${API_URL}/api/marketplace/scene-packs/${encodeURIComponent(pack.id)}/purchase`, { method: 'POST', headers: authHeaders(true), body: '{}' }));
      await updatePoints();
      const download = await readJson(await fetch(`${API_URL}/api/marketplace/scene-packs/${encodeURIComponent(pack.id)}/download`, { headers: authHeaders() }));
      if (!download.downloadUrl) throw new Error('The package download URL is not available.');
      popup.location.href = download.downloadUrl;
      onNotice?.(purchased.message || t.packPurchase);
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      onNotice?.(error.message || 'Could not unlock this scene pack.');
    } finally { setPackBusy(''); }
  };

  const createPack = async (event) => {
    event.preventDefault();
    if (!user) { onLoginRequest?.(); return; }
    if (!packForm.coverFile) return onNotice?.('Upload a cover image first (JPG, PNG, or WebP).');
    if (packForm.coverFile.size > 5 * 1024 * 1024) return onNotice?.('Cover image must be 5 MB or smaller.');
    if (packForm.sourceMode === 'upload' && !packForm.assetFile) return onNotice?.('Choose a ZIP, 7Z, or RAR archive first.');
    if (packForm.sourceMode === 'link' && !packForm.assetUrl.trim()) return onNotice?.('Enter a download link.');
    setSavingPack(true);
    try {
      const formData = new FormData();
      formData.append('title', packForm.title.trim());
      formData.append('quality', packForm.quality);
      formData.append('category', 'Scene Pack');
      formData.append('pricePoints', String(Number(packForm.pricePoints)));
      formData.append('cover', packForm.coverFile);
      formData.append('description', packForm.description.trim());
      if (packForm.sourceMode === 'upload') formData.append('asset', packForm.assetFile);
      else formData.append('assetUrl', packForm.assetUrl.trim());
      const data = await readJson(await fetch(`${API_URL}/api/marketplace/scene-packs`, {
        method: 'POST', headers: authHeaders(), body: formData,
      }));
      setPackForm({ title: '', quality: '1080p', pricePoints: '25', sourceMode: 'upload', assetUrl: '', assetFile: null, coverFile: null, description: '' });
      const fileInput = document.getElementById('evx-pack-file');
      const coverInput = document.getElementById('evx-pack-cover');
      if (fileInput) fileInput.value = '';
      if (coverInput) coverInput.value = '';
      onNotice?.(data.message || t.packPublished);
      await Promise.all([loadPacks(), loadAdminPacks()]);
    } catch (error) { onNotice?.(error.message || 'Could not publish the scene pack.'); }
    finally { setSavingPack(false); }
  };

  const setPackStatus = async (pack) => {
    const status = pack.status === 'hidden' ? 'available' : 'hidden';
    try {
      await readJson(await fetch(`${API_URL}/api/marketplace/scene-packs/admin/${encodeURIComponent(pack.id)}`, {
        method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ status }),
      }));
      await Promise.all([loadPacks(), loadAdminPacks()]);
    } catch (error) { onNotice?.(error.message || 'Could not update scene pack.'); }
  };

  const submitClipRequest = async (event) => {
    event.preventDefault();
    if (!user) { onLoginRequest?.(); return; }
    if (sendingRequest) return;
    setSendingRequest(true);
    try {
      const data = await readJson(await fetch(`${API_URL}/api/marketplace/clip-requests`, {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({ title: clipForm.title.trim(), style: '', targetDuration: '', sourceLinks: clipForm.sourceLinks.trim(), budgetPoints: clipForm.budgetPoints.trim() ? Number(clipForm.budgetPoints) : null, description: clipForm.description.trim() }),
      }));
      setClipForm({ title: '', sourceLinks: '', budgetPoints: '', description: '' });
      onNotice?.(data.message || t.requestSent);
      await loadClipRequests();
    } catch (error) { onNotice?.(error.message || 'Could not send clip assembly request.'); }
    finally { setSendingRequest(false); }
  };

  const changeClipStatus = async (request, status) => {
    setUpdatingRequest(String(request.id));
    try {
      await readJson(await fetch(`${API_URL}/api/marketplace/clip-requests/${encodeURIComponent(request.id)}`, {
        method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ status }),
      }));
      await loadClipRequests();
      onNotice?.('Clip assembly status updated.');
    } catch (error) { onNotice?.(error.message || 'Could not update the request.'); }
    finally { setUpdatingRequest(''); }
  };

  return (
    <div className={`evx-marketplace-sections evx-lang-${language}`}>
      <section className="evx-section evx-scene-packs" id="scene-packs">
        <div className="evx-section-heading"><div><div className="eyebrow"><span className="evx-spark-dot"/>{t.packsEyebrow}</div><h2>{t.packsTitleA} <span>{t.packsTitleB}</span></h2><p>{t.packsDesc}</p></div><span className="evx-live-count"><Package size={15}/>{packs.length} {t.available}</span></div>
        {loadingPacks ? <div className="evx-loading-grid">{[0,1,2].map((n)=><div className="evx-pack-skeleton" key={n}/>)}</div> : packs.length ? <div className="evx-pack-grid">{packs.map((pack)=><ScenePackCard key={pack.id} pack={pack} user={user} onUnlock={unlockPack} busy={packBusy===String(pack.id)} t={t}/>)}</div> : <div className="evx-empty-state"><div className="evx-empty-icon"><Layers size={25}/></div><strong>{t.emptyPacks}</strong><span>{t.emptyPacksSub}</span><div className="evx-empty-orbit"/></div>}
        {user ? <div className="evx-admin-panel evx-reveal"><div className="evx-admin-heading"><div><span className="eyebrow">COMMUNITY MARKETPLACE</span><h3>{t.addPack}</h3><p>Share a pack with the community. Every pack needs its own cover image.</p></div><Upload size={21}/></div>
          <form className="evx-pack-form" onSubmit={createPack}>
            <label>{t.title}<input required minLength={2} maxLength={120} value={packForm.title} onChange={(e)=>setPackForm({...packForm,title:e.target.value})} placeholder="e.g. Anime fight scenes"/></label>
            <label>{t.quality}<select value={packForm.quality} onChange={(e)=>setPackForm({...packForm,quality:e.target.value})}>{['720p','1080p','1440p','4K','Mixed','Other'].map(q=><option key={q} value={q}>{q}</option>)}</select></label>
            <label className="evx-wide-field">{t.coverImage}<input id="evx-pack-cover" type="file" required accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e)=>setPackForm({...packForm,coverFile:e.target.files?.[0] || null})}/><small>{t.coverHelp}</small></label>
            <label>{t.price}<input type="number" required min="1" max="100000" value={packForm.pricePoints} onChange={(e)=>setPackForm({...packForm,pricePoints:e.target.value})}/></label>
            <div className="evx-pack-source-toggle evx-wide-field" role="group" aria-label="Scene pack source">
              <button type="button" className={packForm.sourceMode==='upload'?'is-active':''} onClick={()=>setPackForm({...packForm,sourceMode:'upload',assetUrl:''})}><Upload size={15}/>{t.uploadFile}</button>
              <button type="button" className={packForm.sourceMode==='link'?'is-active':''} onClick={()=>setPackForm({...packForm,sourceMode:'link',assetFile:null})}><ExternalLink size={15}/>{t.linkInstead}</button>
            </div>
            {packForm.sourceMode === 'upload' ? <label className="evx-wide-field">{t.uploadFile}<input id="evx-pack-file" type="file" required accept=".zip,.7z,.rar,application/zip,application/x-7z-compressed,application/vnd.rar,application/x-rar-compressed,application/octet-stream" onChange={(e)=>setPackForm({...packForm,assetFile:e.target.files?.[0] || null})}/><small>{t.fileHelp}</small></label> : <label className="evx-wide-field">{t.assetUrl}<input type="url" required maxLength={2000} value={packForm.assetUrl} onChange={(e)=>setPackForm({...packForm,assetUrl:e.target.value})} placeholder="https://…"/><small>The link stays private until the buyer unlocks this pack.</small></label>}
            <details className="evx-pack-optional-fields evx-wide-field"><summary>Optional details</summary>
              <label>{t.description}<textarea rows="2" maxLength="2000" value={packForm.description} onChange={(e)=>setPackForm({...packForm,description:e.target.value})}/></label>
            </details>
            <button className="evx-action-btn" type="submit" disabled={savingPack}>{savingPack ? t.saving : t.savePack}<Plus size={16}/></button>
          </form>
        </div> : <div className="evx-signin-note"><span className="evx-lock-mark" aria-hidden="true">⌑</span><span>{t.loginToUpload}</span><button type="button" onClick={onLoginRequest}>Log in <ArrowUpRight size={14}/></button></div>}
        {user?.role === 'admin' && <div className="evx-admin-panel evx-reveal"><div className="evx-admin-heading"><div><span className="eyebrow">ADMIN WORKSPACE</span><h3>{t.managePacks}</h3><p>Review uploads and hide or republish any scene pack.</p></div><ShieldCheck size={21}/></div>
          {adminPacks.length>0 ? <div className="evx-admin-pack-list">{adminPacks.map(pack=><div className="evx-admin-pack-row" key={pack.id}><div><strong>{pack.title}</strong><small>{pack.creator_name ? `${t.uploadedBy}: ${pack.creator_name} · ` : ''}{pack.quality || '1080p'} · {pack.price_points} {t.points} · {pack.source_mode || 'link'} · {pack.status}</small></div><button type="button" onClick={()=>setPackStatus(pack)}>{pack.status==='hidden'?t.publish:t.hide}</button></div>)}</div> : <p className="evx-request-empty">No scene packs to manage yet.</p>}
        </div>}
        <div className="evx-section-footnote"><Sparkles size={14}/><span>{t.animationNote}</span></div>
      </section>


    </div>
  );
}

function LockIconFallback() {
  return <span className="evx-lock-mark" aria-hidden="true">⌑</span>;
}
