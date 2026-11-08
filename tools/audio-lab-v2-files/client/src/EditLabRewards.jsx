import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine, ArrowRight, BadgeCheck, Check, CheckCircle2, CircleHelp,
  Clipboard, Clock3, Coins, Copy, Film, Gift, Image as ImageIcon, Gauge, Link2, LoaderCircle,
  LockKeyhole, Scissors, Sparkles, Upload, Users, WandSparkles, Zap,
  SlidersHorizontal, Languages, Eye, FileVideo2,
} from 'lucide-react';
import './editlab-rewards.css';
import CreativeStudioDashboard, { CreativeStudioIntro, isStudioSoundMuted, setStudioSoundMuted, playStudioEntrySound } from './CreativeStudio.jsx';
import AudioLab from './AudioLab.jsx';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const MAX_FILE_BYTES = 250 * 1024 * 1024;
const PROCESSING_BASE_POINTS = 10;
const PROCESSING_POINT_COSTS = {
  quality: { smaller: 0, balanced: 2, higher: 5 },
  resolution: { source: 0, '720p': 2, '1080p': 5, '1440p': 9, '4k': 15 },
  sharpness: { off: 0, light: 1, medium: 2, strong: 3 },
  denoise: { off: 0, light: 1, medium: 2, strong: 3 },
  frameRate: { source: 0, '24': 1, '30': 2, '48': 4, '60': 6 },
};
function calculateProcessingCost(options) {
  return PROCESSING_BASE_POINTS + PROCESSING_POINT_COSTS.quality[options.quality]
    + PROCESSING_POINT_COSTS.resolution[options.resolution]
    + PROCESSING_POINT_COSTS.sharpness[options.sharpness]
    + PROCESSING_POINT_COSTS.denoise[options.denoise]
    + PROCESSING_POINT_COSTS.frameRate[options.frameRate];
}

const PRESETS = [
  { id: 'clean', en: 'Clean', ar: 'طبيعي', descEn: 'Natural contrast', descAr: 'ألوان طبيعية', filter: 'none', swatch: 'linear-gradient(135deg,#637381,#cad2d8)' },
  { id: 'cinematic', en: 'Cinematic', ar: 'سينمائي', descEn: 'Deep contrast', descAr: 'تباين سينمائي', filter: 'contrast(1.12) saturate(1.12) brightness(.97)', swatch: 'linear-gradient(135deg,#162b42,#c49a6c)' },
  { id: 'warm', en: 'Golden hour', ar: 'ذهبي دافئ', descEn: 'Warm highlights', descAr: 'إضاءة دافئة', filter: 'sepia(.17) saturate(1.13) contrast(1.04) brightness(1.02)', swatch: 'linear-gradient(135deg,#72462d,#e9b975)' },
  { id: 'cool', en: 'Cool tone', ar: 'بارد', descEn: 'Blue shadows', descAr: 'ظلال مائلة للأزرق', filter: 'saturate(.92) hue-rotate(8deg) contrast(1.08)', swatch: 'linear-gradient(135deg,#1d4261,#9abed5)' },
  { id: 'moody', en: 'Moody', ar: 'غامق', descEn: 'Muted and dark', descAr: 'ألوان هادئة وداكنة', filter: 'brightness(.91) contrast(1.16) saturate(.78)', swatch: 'linear-gradient(135deg,#171c2b,#6f6b83)' },
  { id: 'vibrant', en: 'Vibrant', ar: 'ألوان زاهية', descEn: 'Color pop', descAr: 'ألوان أكثر حيوية', filter: 'saturate(1.34) contrast(1.06) brightness(1.02)', swatch: 'linear-gradient(135deg,#4b51a6,#e580b3)' },
  { id: 'pure_quality', group: 'clean', en: 'Pure Quality', ar: 'بيور كواليتي', descEn: 'Crisp, natural detail', descAr: 'حدة ونقاء طبيعي', filter: 'contrast(1.055) saturate(1.065) brightness(1.015)', swatch: 'linear-gradient(135deg,#506978,#d9eff0)' },
  { id: 'soft_clean', group: 'clean', en: 'Soft Clean', ar: 'سوفت كلين', descEn: 'Soft skin-friendly tones', descAr: 'درجات ناعمة للبشرة', filter: 'contrast(.96) brightness(1.035) saturate(.91)', swatch: 'linear-gradient(135deg,#756981,#f1cbd4)' },
  { id: 'bw_classic', group: 'mono', en: 'Black & White', ar: 'أبيض وأسود', descEn: 'Classic monochrome', descAr: 'أبيض وأسود كلاسيك', filter: 'grayscale(1) contrast(1.16)', swatch: 'linear-gradient(135deg,#16181c,#e9e9ea)' },
  { id: 'bw_noir', group: 'mono', en: 'Noir B&W', ar: 'نوار أبيض وأسود', descEn: 'Deep noir contrast', descAr: 'كونتراست قوي سينمائي', filter: 'grayscale(1) contrast(1.38) brightness(.92)', swatch: 'linear-gradient(135deg,#030405,#aeb0b7)' },
  { id: 'bw_film', group: 'mono', en: 'Silver Film', ar: 'فيلم فضي', descEn: 'Soft vintage mono', descAr: 'أسود وأبيض فيلم قديم', filter: 'grayscale(1) contrast(.98) brightness(1.05)', swatch: 'linear-gradient(135deg,#4a4b50,#e9e5dd)' },
  { id: 'teal_orange', group: 'cinema', en: 'Teal & Orange', ar: 'تيل وأورانج', descEn: 'Movie-grade separation', descAr: 'ستايل ألوان الأفلام', filter: 'contrast(1.13) saturate(1.19) hue-rotate(-6deg)', swatch: 'linear-gradient(135deg,#063b4b,#ec9351)' },
  { id: 'night_drive', group: 'cinema', en: 'Night Drive', ar: 'نايت درايف', descEn: 'Cool neon shadows', descAr: 'ظلال نيون باردة', filter: 'contrast(1.21) brightness(.89) saturate(1.22) hue-rotate(10deg)', swatch: 'linear-gradient(135deg,#12113b,#39b2d0)' },
  { id: 'purple_ae', group: 'creative', en: 'Purple Glow', ar: 'بيربل جلو', descEn: 'After Effects-inspired', descAr: 'ستايل مستوحى من افترافكت', filter: 'contrast(1.09) saturate(1.25) hue-rotate(16deg)', swatch: 'linear-gradient(135deg,#2c174d,#d074e3)' },
  { id: 'dreamy', group: 'creative', en: 'Dreamy', ar: 'دريمي', descEn: 'Airy soft highlights', descAr: 'إضاءة ناعمة حالمة', filter: 'contrast(.92) brightness(1.08) saturate(.92)', swatch: 'linear-gradient(135deg,#827db8,#ffcfdb)' },
  { id: 'anime_pop', group: 'creative', en: 'Anime Pop', ar: 'أنمي بوب', descEn: 'Bold vivid colors', descAr: 'ألوان قوية للأنمي', filter: 'contrast(1.14) saturate(1.48) brightness(1.01)', swatch: 'linear-gradient(135deg,#2141c1,#ef55a6)' },
  { id: 'retro_film', group: 'creative', en: 'Retro Film', ar: 'ريترو فيلم', descEn: 'Faded vintage warmth', descAr: 'ألوان فيلم قديم', filter: 'sepia(.24) contrast(.94) saturate(.83) brightness(1.06)', swatch: 'linear-gradient(135deg,#715344,#e9c69c)' },
]; // EDITVAULT_CC_STUDIO_V3

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** power)).toFixed(power ? 1 : 0)} ${units[power]}`;
}

function authHeaders() {
  const token = localStorage.getItem('editvault_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EditLabRewards({ user, language = 'en', onNotice, onLoginRequest, onPointsChange, onOpenTopaz, active = false }) {
  const isArabic = language === 'ar';
  const tx = (en, ar) => isArabic ? ar : en;
  const [studioView, setStudioView] = useState('hub');
  const [introVisible, setIntroVisible] = useState(() => active && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [soundMuted, setSoundMuted] = useState(isStudioSoundMuted);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      setStudioView('hub');
      setIntroVisible(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } else if (!active) {
      setIntroVisible(false);
    }
    wasActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!introVisible || !active) return undefined;
    const timeout = window.setTimeout(() => setIntroVisible(false), 1700);
    const onKeyDown = (event) => { if (event.key === 'Escape') setIntroVisible(false); };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(timeout); window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [introVisible, active]);

  const toggleStudioSound = () => {
    setSoundMuted((current) => {
      setStudioSoundMuted(!current);
      return !current;
    });
  };
  const replayStudioIntro = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    playStudioEntrySound();
    setIntroVisible(true);
  };
  const openStudioTool = (id) => {
    setToolTab(id);
    setStudioView('workspace');
    window.requestAnimationFrame(() => {
      document.querySelector('.evlr-editlab')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const [toolTab, setToolTab] = useState('color');
  const [compareMode, setCompareMode] = useState('after');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [presetId, setPresetId] = useState('cinematic');
  const [ccCategory, setCcCategory] = useState('all');
  const [quality, setQuality] = useState('balanced');
  const [sharpness, setSharpness] = useState('off');
  const [denoise, setDenoise] = useState('off');
  const [outputResolution, setOutputResolution] = useState('source');
  const [frameRate, setFrameRate] = useState('source');
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processError, setProcessError] = useState('');
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const activePreset = useMemo(() => PRESETS.find((preset) => preset.id === presetId) || PRESETS[0], [presetId]);
  const advancedVideoSettings = toolTab === 'ai';
  const processingCostPoints = calculateProcessingCost({
    quality,
    resolution: advancedVideoSettings ? outputResolution : 'source',
    sharpness: advancedVideoSettings ? sharpness : 'off',
    denoise: advancedVideoSettings ? denoise : 'off',
    frameRate: advancedVideoSettings ? frameRate : 'source',
  });

  const [rewardSummary, setRewardSummary] = useState(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteUrl = useMemo(() => user?.id ? `${window.location.origin}/?ref=${encodeURIComponent(user.id)}` : '', [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref)) {
      localStorage.setItem('editvault_referral_code', ref);
      params.delete('ref');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const resultUrl = result?.url;
    return () => { if (resultUrl) URL.revokeObjectURL(resultUrl); };
  }, [result?.url]);

  const acceptFile = useCallback((incoming) => {
    setProcessError('');
    setResult(null);
    if (!incoming) return;
    const validMime = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'].includes(incoming.type);
    const validExt = /\.(mp4|mov|webm|mkv)$/i.test(incoming.name || '');
    if (!validMime && !validExt) { setProcessError(isArabic ? 'اختار فيديو بصيغة MP4 أو MOV أو WebM أو MKV.' : 'Choose an MP4, MOV, WebM, or MKV video.'); return; }
    if (incoming.size > MAX_FILE_BYTES) { setProcessError(isArabic ? 'حجم الملف أكبر من 250 ميجابايت. اختار فيديو أصغر.' : 'This file is over the 250 MB limit. Choose a smaller video.'); return; }
    setFile(incoming);
    setCompareMode('after');
  }, [isArabic]);

  const compressAndDownload = async () => {
    if (!user) { onLoginRequest?.(); return; }
    if (!file || processing) return;
    const token = localStorage.getItem('editvault_token');
    if (!token) { onLoginRequest?.(); return; }
    setProcessing(true);
    setProcessError('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('video', file, file.name);
      body.append('preset', presetId);
      body.append('quality', quality);
      body.append('sharpness', advancedVideoSettings ? sharpness : 'off');
      body.append('denoise', advancedVideoSettings ? denoise : 'off');
      body.append('resolution', advancedVideoSettings ? outputResolution : 'source');
      body.append('frameRate', advancedVideoSettings ? frameRate : 'source');
      const response = await fetch(`${API_URL}/api/editlab/compress`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (typeof data.balance === 'number') onPointsChange?.(Number(data.balance));
        if (data.code === 'INSUFFICIENT_EDITLAB_POINTS') {
          const requiredPoints = Number(data.requiredPoints || processingCostPoints);
          const balance = Number(data.balance || 0);
          throw new Error(isArabic ? `التصدير بالإعدادات دي يكلف ${requiredPoints} نقطة. رصيدك الحالي ${balance} نقطة.` : (data.error || `This export costs ${requiredPoints} points. Your current balance is ${balance}.`));
        }
        throw new Error(data.error || (isArabic ? 'تعذر معالجة الفيديو.' : 'Could not process this video.'));
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error(isArabic ? 'الفيديو الناتج فارغ. جرّب إعداد جودة مختلفًا.' : 'The processed video was empty. Please try a different quality setting.');
      const url = URL.createObjectURL(blob);
      try {
        const walletResponse = await fetch(`${API_URL}/api/wallet`, { headers: authHeaders() });
        if (walletResponse.ok) {
          const walletData = await walletResponse.json();
          onPointsChange?.(Number(walletData.balance || 0));
        }
      } catch { /* the export succeeded; wallet display can refresh later */ }
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 70) || 'editvault-video';
      const downloadName = `${baseName}-editvault.mp4`;
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      const saved = Math.max(0, 100 - (blob.size / file.size) * 100);
      setResult({ before: file.size, after: blob.size, saved, url, name: downloadName });
      onNotice?.(isArabic ? 'الفيديو جاهز وبدأ التنزيل.' : 'Your processed video is ready and the download has started.');
    } catch (error) {
      setProcessError(error.message || (isArabic ? 'فشلت معالجة الفيديو.' : 'Video processing failed.'));
    } finally {
      setProcessing(false);
    }
  };

  const loadRewardSummary = useCallback(async () => {
    if (!user) { setRewardSummary(null); return; }
    setRewardLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/rewards/summary`, { headers: authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (isArabic ? 'تعذر تحميل حالة الدعوات.' : 'Could not load referral status.'));
      setRewardSummary(data);
    } catch (error) {
      onNotice?.(error.message || (isArabic ? 'حالة الدعوات غير متاحة مؤقتًا.' : 'Referral status is temporarily unavailable.'));
    } finally { setRewardLoading(false); }
  }, [user?.id, onNotice, isArabic]);

  useEffect(() => { loadRewardSummary(); }, [loadRewardSummary]);

  const refreshReferrals = async () => {
    if (!user) { onLoginRequest?.(); return; }
    setQualifying(true);
    try {
      const response = await fetch(`${API_URL}/api/rewards/refresh`, { method: 'POST', headers: authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (isArabic ? 'تعذر تحديث تقدم الدعوات.' : 'Could not update referral progress.'));
      if (data.pointsAdded > 0) {
        onPointsChange?.((current) => Number(current || 0) + Number(data.pointsAdded));
        onNotice?.(isArabic ? `تم تأكيد مكافأة الدعوة وإضافة ${data.pointsAdded} نقطة إلى محفظتك.` : `Referral reward confirmed: ${data.pointsAdded} points added to your wallet.`);
      } else onNotice?.(isArabic ? 'تم فحص الدعوات. تُتاح المكافأة بعد نشر الصديق إيديت أو إتمام عملية شراء في السوق.' : 'Referral progress checked. Rewards unlock after a friend publishes an edit or makes a marketplace purchase.');
      await loadRewardSummary();
      const walletResponse = await fetch(`${API_URL}/api/wallet`, { headers: authHeaders() });
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        onPointsChange?.(Number(walletData.balance || 0));
      }
    } catch (error) { onNotice?.(error.message || (isArabic ? 'تعذر تحديث تقدم الدعوات.' : 'Could not update referral progress.')); }
    finally { setQualifying(false); }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotice?.(isArabic ? 'تعذر النسخ التلقائي. انسخ رابط الدعوة من الحقل.' : 'Clipboard access failed. Copy the invite link from the field.');
    }
  };

  const clearFile = () => {
    setFile(null); setResult(null); setProcessError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const qualityOptions = [
    { id: 'smaller', en: 'Smaller file', ar: 'حجم أصغر', subEn: 'More compression', subAr: 'ضغط أعلى' },
    { id: 'balanced', en: 'Balanced', ar: 'متوازن', subEn: 'Recommended', subAr: 'موصى به' },
    { id: 'higher', en: 'Higher quality', ar: 'جودة أعلى', subEn: 'Less compression', subAr: 'ضغط أقل' },
  ];

  return (
    <div className={`evlr-root ${isArabic ? 'evlr-rtl' : 'evlr-ltr'}`} dir={isArabic ? 'rtl' : 'ltr'} lang={isArabic ? 'ar' : 'en'}>
      <section className="evlr-section evlr-editlab" id="editlab">
        {studioView === 'hub' ? (
          <CreativeStudioDashboard
            language={language}
            user={user}
            soundMuted={soundMuted}
            onToggleSound={toggleStudioSound}
            onReplayIntro={replayStudioIntro}
            onOpenTool={openStudioTool}
          />
        ) : <>
          <div className="evcs-workspace-topline">
            <button type="button" className="evcs-workspace-back" onClick={() => { setStudioView('hub'); window.requestAnimationFrame(() => document.querySelector('.evlr-editlab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>
              {isArabic ? <ArrowRight size={16} /> : <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />}
              {tx('Back to studio', 'العودة للاستوديو')}
            </button>
            <span className="evcs-workspace-label">EDITVAULT <b>/</b> {tx('WORKSPACE', 'مساحة العمل')}</span>
          </div>
        {toolTab === 'audio' ? (
          <AudioLab language={language} user={user} onNotice={onNotice} onLoginRequest={onLoginRequest} onPointsChange={onPointsChange} />
        ) : <>
        <div className="evlr-heading evlr-heading-editor">
          <div>
            <span className="evlr-eyebrow"><span className="evlr-spark" /> {tx('EDITVAULT TOOLBOX', 'أدوات EDITVAULT')}</span>
            <h2>{tx('EditLab', 'معمل المونتاج')} <span>{tx('Studio.', 'الاحترافي.')}</span></h2>
            <p>{tx('Choose one tool, preview the changes, then export when you are ready.', 'اختار أداة واحدة، وشوف التغييرات قبل ما تصدّر الفيديو.')}</p>
          </div>
          <div className="evlr-heading-mark"><WandSparkles size={23} /><span>{tx('CREATE / ENHANCE', 'تعديل / تحسين')}</span></div>
        </div>

        <div className="evlr-tool-tabs" role="tablist" aria-label={tx('EditLab tools', 'أدوات معمل المونتاج')}>
          <button type="button" role="tab" aria-selected={toolTab === 'color'} className={toolTab === 'color' ? 'is-active' : ''} onClick={() => setToolTab('color')}><SlidersHorizontal size={17} /><span>{tx('Color & CC', 'تصحيح الألوان (CC)')}</span><small>{tx('17 looks', '١٧ فلتر')}</small></button>
          <button type="button" role="tab" aria-selected={toolTab === 'compress'} className={toolTab === 'compress' ? 'is-active' : ''} onClick={() => setToolTab('compress')}><Gauge size={17} /><span>{tx('Compress video', 'ضغط الفيديو')}</span><small>{tx('MP4 export', 'تصدير MP4')}</small></button>
          <button type="button" role="tab" aria-selected={toolTab === 'ai'} className={toolTab === 'ai' ? 'is-active' : ''} onClick={() => setToolTab('ai')}><Sparkles size={17} /><span>{tx('Quality & sharpen', 'تحسين جودة الفيديو')}</span><small>{tx('Sharpen · Denoise · Upscale', 'حدة · إزالة تشويش · رفع الدقة')}</small></button>
          {user?.role === 'admin' && onOpenTopaz && <button type="button" role="tab" aria-selected={toolTab === 'topaz-image'} className={toolTab === 'topaz-image' ? 'is-active' : ''} onClick={() => setToolTab('topaz-image')}><ImageIcon size={17} /><span>{tx('Topaz image AI', 'Topaz للصور')}</span><small>{tx('Image enhancement only', 'تحسين الصور فقط')}</small></button>}
        </div>

        <div className="evlr-workspace" style={toolTab === "topaz-image" ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          <section className="evlr-editor-card evlr-editor-main">
{toolTab !== 'topaz-image' && <>
            <div className="evlr-card-topline">
              <span><Film size={16} /> {tx('VIDEO WORKSPACE', 'مساحة الفيديو')}</span>
              <span className="evlr-private"><LockKeyhole size={12} /> {tx('Private by default', 'خاص بشكل افتراضي')}</span>
            </div>

            {!file ? (
              <button type="button" className={`evlr-dropzone ${dragging ? 'is-dragging' : ''}`} onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}>
                <span className="evlr-upload-icon"><Upload size={24} /></span>
                <strong>{tx('Drop your video here', 'اسحب الفيديو هنا')}</strong>
                <span>{tx('or click to browse · MP4, MOV, WebM or MKV', 'أو اضغط لاختيار ملف · MP4 أو MOV أو WebM أو MKV')}</span>
                <small>{tx('Maximum 250 MB. Your original is not published.', 'الحد الأقصى 250 ميجابايت. الفيديو الأصلي مش بيتنشر.')}</small>
              </button>
            ) : (
              <div className="evlr-preview-wrap">
                <div className="evlr-preview-heading"><div><strong>{tx('Preview', 'المعاينة')}</strong><small>{tx('Toggle before and after to compare the selected CC.', 'بدّل بين قبل وبعد لمقارنة تأثير الـ CC المختار.')}</small></div><button className="evlr-change-file" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> {tx('Change video', 'تغيير الفيديو')}</button></div>
                <div className="evlr-compare-toggle" role="group" aria-label={tx('Before and after comparison', 'مقارنة قبل وبعد')}>
                  <button type="button" className={compareMode === 'before' ? 'is-selected' : ''} onClick={() => setCompareMode('before')} aria-pressed={compareMode === 'before'}>{tx('Before · Original', 'قبل · الأصلي')}</button>
                  <button type="button" className={compareMode === 'after' ? 'is-selected' : ''} onClick={() => setCompareMode('after')} aria-pressed={compareMode === 'after'}>{tx('After · CC preview', 'بعد · معاينة CC')}</button>
                </div>
                <div className={`evlr-video-frame ${compareMode === 'before' ? 'is-before' : 'is-after'}`}>
                  <video className="evlr-video-preview" src={previewUrl} controls playsInline style={{ filter: compareMode === 'after' ? activePreset.filter : 'none' }} />
                  <span className="evlr-compare-badge">{compareMode === 'before' ? tx('ORIGINAL', 'الأصلي') : tx(`AFTER · ${activePreset.en.toUpperCase()}`, `بعد · ${activePreset.ar}`)}</span>
                </div>
                <div className="evlr-file-strip"><span className="evlr-file-icon"><FileVideo2 size={17} /></span><div><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)} · {tx('Stored in this session only until processing.', 'يظل على جهازك خلال المعاينة حتى بدء المعالجة.')}</small></div><button type="button" onClick={clearFile} aria-label={tx('Remove video', 'إزالة الفيديو')}>×</button></div>
              </div>
            )}
            <input ref={fileInputRef} className="evlr-repick-input" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />
            </>}

            {toolTab === 'color' && <div className="evlr-tool-panel" role="tabpanel">
              <div className="evlr-control-heading"><div><span className="evlr-step">01</span><div><strong>{tx('Choose your CC', 'اختار تصحيح الألوان')}</strong><small>{tx('Preview instantly; the selected look is applied on export.', 'شوف التأثير فورًا، وهيتطبق عند تصدير الفيديو.')}</small></div></div><span className="evlr-mini-tag">{tx('17 PRESETS', '١٧ فلتر')}</span></div>
              <div className="evlr-cc-toolbar"><div className="evlr-cc-categories" role="group" aria-label={tx('Filter color looks', 'تصنيف فلاتر الألوان')}>{[
                { id: 'all', en: 'All looks', ar: 'الكل' }, { id: 'clean', en: 'Clean / Quality', ar: 'جودة ونقاء' },
                { id: 'mono', en: 'B&W', ar: 'أبيض وأسود' }, { id: 'cinema', en: 'Cinematic', ar: 'سينمائي' },
                { id: 'creative', en: 'AE styles', ar: 'ستايلات افترافكت' },
              ].map((category) => <button key={category.id} type="button" className={ccCategory === category.id ? 'is-active' : ''} aria-pressed={ccCategory === category.id} onClick={() => setCcCategory(category.id)}>{isArabic ? category.ar : category.en}</button>)}</div><span className="evlr-cc-count">{PRESETS.filter(preset => ccCategory === 'all' || (preset.group || (['clean'].includes(preset.id) ? 'clean' : ['cinematic','warm','cool','moody'].includes(preset.id) ? 'cinema' : 'creative')) === ccCategory).length} {tx('looks', 'فلاتر')}</span></div>
              <div className="evlr-presets-grid">{PRESETS.filter(preset => ccCategory === 'all' || (preset.group || (['clean'].includes(preset.id) ? 'clean' : ['cinematic','warm','cool','moody'].includes(preset.id) ? 'cinema' : 'creative')) === ccCategory).map((preset) => <button type="button" key={preset.id} className={`evlr-preset ${preset.id === presetId ? 'is-selected' : ''}`} onClick={() => { setPresetId(preset.id); setCompareMode('after'); }} aria-pressed={preset.id === presetId}>
                <span className="evlr-preset-swatch" style={{ background: preset.swatch }}><span /></span><span className="evlr-preset-copy"><strong>{isArabic ? preset.ar : preset.en}</strong><small>{isArabic ? preset.descAr : preset.descEn}</small></span>{preset.id === presetId && <Check size={14} className="evlr-preset-check" />}
              </button>)}</div>
              <div className="evlr-cc-note"><Sparkles size={14}/><span>{tx('Includes clean quality, 3 black-and-white moods and After Effects-inspired creative color looks. Browser preview is approximate; FFmpeg applies the final grading on export. Pure Quality adds subtle sharpening but cannot recover lost detail.', 'فيه بيور كواليتي و٣ ستايلات أبيض وأسود وتدرجات مستوحاة من افترافكت. المعاينة تقريبية، والتصدير النهائي بيتم عبر FFmpeg. بيور كواليتي بيضيف حدة خفيفة لكنه مش بيرجع تفاصيل مفقودة.')}</span></div>
              <div className="evlr-selected-look"><span className="evlr-selected-look-dot" style={{ background: activePreset.swatch }} /><div><strong>{tx('Selected look:', 'الفلتر المختار:')} {isArabic ? activePreset.ar : activePreset.en}</strong><small>{tx('The preview uses a browser color filter; server export applies the matching preset.', 'المعاينة بتستخدم فلتر ألوان في المتصفح، والتصدير بيطبّق الإعداد المقابل على السيرفر.')}</small></div><button type="button" onClick={() => setCompareMode(compareMode === 'before' ? 'after' : 'before')}><Eye size={14} /> {compareMode === 'before' ? tx('Show after', 'عرض بعد') : tx('Show before', 'عرض قبل')}</button></div>
            </div>}

            {toolTab === 'compress' && <div className="evlr-tool-panel" role="tabpanel">
              <div className="evlr-control-heading"><div><span className="evlr-step">02</span><div><strong>{tx('Compression & export', 'ضغط وتصدير الفيديو')}</strong><small>{tx('MP4 / H.264 for broad compatibility. CC selection is included in the export.', 'صيغة MP4 / H.264 للتوافق مع أغلب الأجهزة، مع تطبيق الـ CC المختار.')}</small></div></div><span className="evlr-mini-tag"><Gauge size={13} /> FFmpeg</span></div>
              <div className="evlr-quality-options" role="group" aria-label={tx('Output quality', 'جودة الفيديو الناتج')}>{qualityOptions.map((item) => <button type="button" key={item.id} className={quality === item.id ? 'is-selected' : ''} onClick={() => setQuality(item.id)} aria-pressed={quality === item.id}><strong>{isArabic ? item.ar : item.en}</strong><small>{isArabic ? item.subAr : item.subEn}</small></button>)}</div>
              <div className="evlr-export-summary"><div><span>{tx('Source size', 'الحجم الأصلي')}</span><strong>{file ? formatBytes(file.size) : '—'}</strong></div><ArrowRight size={17} /><div><span>{tx('Result size', 'الحجم بعد الضغط')}</span><strong>{result ? formatBytes(result.after) : tx('After export', 'بعد التصدير')}</strong></div></div>
              {processError && <div className="evlr-error" role="alert"><CircleHelp size={15} /> {processError}</div>}
              {result && <div className="evlr-result" role="status"><CheckCircle2 size={17} /><div><strong>{tx('Export complete', 'اكتمل التصدير')}</strong><small>{formatBytes(result.before)} → {formatBytes(result.after)}{result.after < result.before ? ` · ${result.saved.toFixed(0)}% ${tx('smaller', 'أصغر')}` : ` · ${tx('No size reduction for this source', 'لم يقل حجم هذا الفيديو')}`}</small></div><a href={result.url} download={result.name}><ArrowDownToLine size={14} /> {tx('Download again', 'إعادة التنزيل')}</a></div>}
              <div className="evlr-cost-hint"><Coins size={14} /><span>{tx(`Estimated export cost: ${processingCostPoints} points. Quality and processing options change the price.`, `تكلفة التصدير بالإعدادات الحالية: ${processingCostPoints} نقطة. السعر يزيد مع الجودة وإعدادات المعالجة.`)}</span></div>
              <button type="button" className="evlr-export-btn" onClick={compressAndDownload} disabled={!file || processing}>{processing ? <><LoaderCircle size={17} className="evlr-spin" /> {tx('Processing video…', 'جارٍ معالجة الفيديو…')}</> : <><Scissors size={17} /> {tx('Apply CC & compress', 'تطبيق الألوان وضغط الفيديو')} <ArrowRight size={16} /></>}</button>
              {!user && <p className="evlr-signin-hint"><LockKeyhole size={13} /> {tx('Preview for free. Log in to export with server-side compression.', 'عاين مجانًا. سجّل الدخول لتصدير الفيديو وضغطه على السيرفر.')}</p>}
            </div>}

            {toolTab === 'ai' && <div className="evlr-tool-panel evlr-ai-panel evlr-enhance-panel" role="tabpanel">
              <div className="evlr-control-heading"><div><span className="evlr-step">03</span><div><strong>{tx('Quality & detail controls', 'إعدادات الجودة والتفاصيل')}</strong><small>{tx('These controls are applied on the server during export. The browser preview cannot reproduce real sharpening or denoising.', 'الإعدادات دي بتتطبق على السيرفر وقت التصدير. معاينة المتصفح مش بتقدر تعرض الشاربن وإزالة التشويش الحقيقيين.')}</small></div></div><span className="evlr-mini-tag">FFMPEG</span></div>
              <div className="evlr-enhance-grid">
                <label className="evlr-enhance-control"><span>{tx('Sharpen', 'حدة التفاصيل')}</span><small>{tx('Add edge clarity', 'زود وضوح الحواف')}</small><select value={sharpness} onChange={(event) => setSharpness(event.target.value)}><option value="off">{tx('Off', 'إيقاف')}</option><option value="light">{tx('Light', 'خفيف')}</option><option value="medium">{tx('Medium', 'متوسط')}</option><option value="strong">{tx('Strong', 'قوي')}</option></select></label>
                <label className="evlr-enhance-control"><span>{tx('Denoise', 'إزالة التشويش')}</span><small>{tx('Reduce grain and noise', 'قلل الحبيبات والتشويش')}</small><select value={denoise} onChange={(event) => setDenoise(event.target.value)}><option value="off">{tx('Off', 'إيقاف')}</option><option value="light">{tx('Light', 'خفيف')}</option><option value="medium">{tx('Medium', 'متوسط')}</option><option value="strong">{tx('Strong', 'قوي')}</option></select></label>
                <label className="evlr-enhance-control"><span>{tx('Output resolution', 'دقة التصدير')}</span><small>{tx('Preserves aspect ratio', 'يحافظ على أبعاد الفيديو')}</small><select value={outputResolution} onChange={(event) => setOutputResolution(event.target.value)}><option value="source">{tx('Keep original', 'الأصلية')}</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="1440p">1440p</option><option value="4k">4K</option></select></label>
                <label className="evlr-enhance-control"><span>{tx('Frame rate (FPS)', 'معدل الإطارات')}</span><small>{tx('FFmpeg drops or duplicates frames; this is not AI frame interpolation.', 'يتم حذف أو تكرار الإطارات بـ FFmpeg، وليس توليد إطارات بالذكاء الاصطناعي.')}</small><select value={frameRate} onChange={(event) => setFrameRate(event.target.value)}><option value="source">{tx('Keep source FPS', 'معدل المصدر')}</option><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="48">48 FPS</option><option value="60">60 FPS</option></select></label>
              </div>
              <div className="evlr-enhance-note"><Sparkles size={16} /><span>{tx('Sharpen, denoise and scaling are real FFmpeg operations—not generative AI. Upscaling with FFmpeg enlarges pixels but does not invent AI-recovered details.', 'الشاربن وإزالة التشويش وتغيير الدقة عمليات FFmpeg فعلية وليست ذكاءً اصطناعيًا توليديًا. تكبير الفيديو بـ FFmpeg لا يعيد بناء تفاصيل بالذكاء الاصطناعي.')}</span></div>
              {processError && <div className="evlr-error" role="alert"><CircleHelp size={15} /> {processError}</div>}
              {result && <div className="evlr-result" role="status"><CheckCircle2 size={17} /><div><strong>{tx('Enhancement export complete', 'اكتمل تحسين وتصدير الفيديو')}</strong><small>{formatBytes(result.before)} → {formatBytes(result.after)}</small></div><a href={result.url} download={result.name}><ArrowDownToLine size={14} /> {tx('Download again', 'إعادة التنزيل')}</a></div>}
              <div className="evlr-cost-hint"><Coins size={14} /><span>{tx(`Estimated export cost: ${processingCostPoints} points. Quality and processing options change the price.`, `تكلفة التصدير بالإعدادات الحالية: ${processingCostPoints} نقطة. السعر يزيد مع الجودة وإعدادات المعالجة.`)}</span></div>
              <button type="button" className="evlr-export-btn" onClick={compressAndDownload} disabled={!file || processing}>{processing ? <><LoaderCircle size={17} className="evlr-spin" /> {tx('Enhancing video…', 'جارٍ تحسين الفيديو…')}</> : <><WandSparkles size={17} /> {tx('Enhance & export video', 'حسّن وصدّر الفيديو')} <ArrowRight size={16} /></>}</button>
              {!user && <p className="evlr-signin-hint"><LockKeyhole size={13} /> {tx('Log in to export an enhanced video.', 'سجّل الدخول لتصدير الفيديو المحسّن.')}</p>}
            </div>}
            {toolTab === 'topaz-image' && user?.role === 'admin' && onOpenTopaz && <div className="evlr-tool-panel evlr-ai-panel evlr-enhance-panel" role="tabpanel">
              <div className="evlr-control-heading"><div><span className="evlr-step">04</span><div><strong>{tx('Topaz AI image enhancement', 'تحسين الصور باستخدام Topaz AI')}</strong><small>{tx('Topaz is reserved for still images. Use the video-quality tab for sharpen, denoise, resolution and FPS.', 'Topaz مخصص للصور فقط. استخدم تبويب جودة الفيديو للحدة وإزالة التشويش والدقة ومعدل الإطارات.')}</small></div></div><span className="evlr-mini-tag">TOPAZ / IMAGE</span></div>
              <div className="evlr-enhance-note"><ImageIcon size={16} /><span>{tx('Choose an image and an enhancement model in the private administrator tool. Topaz processing may consume paid API credits.', 'اختار صورة وموديل التحسين من أداة الأدمن الخاصة. معالجة Topaz ممكن تستهلك أرصدة مدفوعة.')}</span></div>
              <button type="button" className="evlr-topaz-launch-btn" onClick={onOpenTopaz}><ImageIcon size={15} /> {tx('Open Topaz Image Enhancer', 'افتح تحسين الصور بـ Topaz')} <ArrowRight size={14} /></button>
            </div>}
          </section>

{toolTab !== 'topaz-image' && <>
          <aside className="evlr-tool-aside">
            <article className="evlr-mini-info-card"><div className="evlr-info-icon"><LockKeyhole size={18} /></div><div><strong>{tx('Your files stay yours', 'ملفاتك ملكك')}</strong><p>{tx('Nothing is posted to the public marketplace. Use only videos you have permission to edit.', 'الفيديو مش بيتنشر في السوق العام. استخدم فيديوهات عندك حق تعديلها.')}</p></div></article>
            <article className="evlr-mini-info-card"><div className="evlr-info-icon"><Gauge size={18} /></div><div><strong>{tx('Smart export', 'تصدير ذكي')}</strong><p>{tx('Results depend on source resolution, motion, and quality settings. Compression cannot guarantee a smaller file every time.', 'النتيجة بتعتمد على دقة الفيديو والحركة وإعداد الجودة. الضغط مش مضمون يقلل حجم كل فيديو.')}</p></div></article>
            <div className="evlr-aside-specs"><span>MP4 / H.264</span><span>{tx('Max 250 MB', 'حد أقصى 250 ميجا')}</span><span>{tx('Temporary processing', 'معالجة مؤقتة')}</span></div>
          </aside>
          </>}
        </div>
        </>}
        </>}
        {active && introVisible && createPortal(<CreativeStudioIntro
          isArabic={isArabic}
          displayName={user?.displayName || user?.display_name || ''}
          soundMuted={soundMuted}
          onToggleSound={toggleStudioSound}
          onSkip={() => setIntroVisible(false)}
        />, document.body)}
      </section>

      <section className="evlr-section evlr-rewards" id="earn-points">
        <div className="evlr-heading"><div><span className="evlr-eyebrow"><span className="evlr-spark" /> {tx('GROW WITH EDITVAULT', 'كبّر مجتمع EDITVAULT')}</span><h2>{tx('Earn points.', 'اجمع نقاط.')} <span>{tx('Bring your people.', 'وادعُ أصحابك.')}</span></h2><p>{tx('Start with referrals. Ads and partner tasks stay locked until a real provider is connected and verified.', 'ابدأ بالدعوات. الإعلانات ومهام الشركاء هتفضل مقفولة لحد ربط مزوّد حقيقي والتحقق منه.')}</p></div><div className="evlr-heading-mark"><Gift size={23} /><span>{tx('REWARDS', 'المكافآت')}</span></div></div>
        <div className="evlr-reward-grid">
          <article className="evlr-referral-card">
            <div className="evlr-referral-head"><div className="evlr-referral-symbol"><Users size={23} /></div><span className="evlr-live-badge"><span /> {tx('LIVE', 'متاح')}</span></div>
            <span className="evlr-eyebrow">{tx('INVITE & EARN', 'ادعُ واكسب')}</span><h3>{tx('Your community is your growth engine.', 'أصحابك هم بداية نمو المجتمع.')}</h3><p>{tx('Share your personal invite link. Points are awarded only after the invited member performs a real marketplace action.', 'شارك رابط الدعوة الخاص بك. النقاط بتتضاف بعد ما العضو المدعو يعمل نشاطًا حقيقيًا في السوق.')}</p>
            {user ? <>
              <label className="evlr-invite-label" htmlFor="evlr-invite-link">{tx('Your personal invite link', 'رابط دعوتك الخاص')}</label>
              <div className="evlr-invite-field"><input id="evlr-invite-link" value={inviteUrl} readOnly onFocus={(event) => event.target.select()} /><button type="button" onClick={copyInvite} aria-label={tx('Copy invite link', 'نسخ رابط الدعوة')}>{copied ? <Check size={16} /> : <Copy size={16} />}<span>{copied ? tx('Copied', 'تم النسخ') : tx('Copy', 'نسخ')}</span></button></div>
              <div className="evlr-referral-stats"><div><strong>{rewardSummary?.referrals?.qualified ?? '—'}</strong><span>{tx('Qualified', 'مؤهلون')}</span></div><div><strong>{rewardSummary?.referrals?.pending ?? '—'}</strong><span>{tx('Pending', 'قيد الانتظار')}</span></div><div><strong>{rewardSummary?.referrals?.total ?? '—'}</strong><span>{tx('Total invites', 'إجمالي الدعوات')}</span></div></div>
              <button type="button" className="evlr-refresh-btn" onClick={refreshReferrals} disabled={qualifying || rewardLoading}>{qualifying ? <LoaderCircle size={15} className="evlr-spin" /> : <Zap size={15} />} {qualifying ? tx('Checking…', 'جارٍ التحقق…') : tx('Check referral progress', 'تحقق من تقدم الدعوات')}</button>
              <small className="evlr-policy-note">{tx('Rule: the invited person must publish an edit or complete a marketplace purchase. Self-referrals and repeated rewards are blocked.', 'الشرط: العضو المدعو ينشر إيديت أو يكمل عملية شراء من السوق. الدعوات الذاتية والمكافآت المكررة ممنوعة.')}</small>
            </> : <div className="evlr-signup-cta"><LockKeyhole size={18} /><span>{tx('Sign in to get your unique invite link and track referrals.', 'سجّل الدخول للحصول على رابط دعوة خاص ومتابعة الدعوات.')}</span><button type="button" onClick={onLoginRequest}>{tx('Join free', 'انضم مجانًا')} <ArrowRight size={14} /></button></div>}
          </article>

          <div className="evlr-task-stack">
            <article className="evlr-task-card"><div className="evlr-task-icon evlr-task-icon-blue"><Film size={19} /></div><div className="evlr-task-main"><div><h3>{tx('Rewarded video ads', 'إعلانات فيديو بمكافآت')}</h3><p>{tx('Earn points after a verified ad view from an approved provider.', 'اكسب نقاطًا بعد مشاهدة مؤكدة من مزوّد معتمد.')}</p></div><span className="evlr-status-pill evlr-status-locked"><LockKeyhole size={12} /> {tx('Provider needed', 'مزوّد مطلوب')}</span></div><div className="evlr-task-foot"><span>{tx('Available after ad-network integration', 'تتاح بعد ربط شبكة إعلانات')}</span><span className="evlr-task-value">— PTS</span></div></article>
            <article className="evlr-task-card"><div className="evlr-task-icon evlr-task-icon-purple"><Clipboard size={19} /></div><div className="evlr-task-main"><div><h3>{tx('Partner tasks & surveys', 'مهام واستبيانات الشركاء')}</h3><p>{tx('Optional offers with rewards shown before you start.', 'عروض اختيارية مع توضيح المكافأة قبل البدء.')}</p></div><span className="evlr-status-pill evlr-status-locked"><LockKeyhole size={12} /> {tx('Not connected', 'غير مربوط')}</span></div><div className="evlr-task-foot"><span>{tx('No fake task completions or manual point buttons', 'لا توجد مكافآت وهمية أو أزرار نقاط يدوية')}</span><span className="evlr-task-value">— PTS</span></div></article>
            <article className="evlr-task-card"><div className="evlr-task-icon evlr-task-icon-gold"><Link2 size={19} /></div><div className="evlr-task-main"><div><h3>{tx('Follow a partner page', 'متابعة صفحة شريك')}</h3><p>{tx('Social tasks appear only for sponsor campaigns with an allowed verification method.', 'تظهر المهام الاجتماعية عند وجود حملة راعٍ وطريقة تحقق مسموح بها.')}</p></div><span className="evlr-status-pill evlr-status-locked"><LockKeyhole size={12} /> {tx('Campaign needed', 'حملة مطلوبة')}</span></div><div className="evlr-task-foot"><span>{tx('No reward for unverified follows', 'لا مكافأة لمتابعة غير مؤكدة')}</span><span className="evlr-task-value">— PTS</span></div></article>
            <article className="evlr-task-card evlr-task-community"><div className="evlr-task-icon evlr-task-icon-gold"><Users size={19} /></div><div className="evlr-task-main"><div><h3>{tx('Invite real creators', 'ادعُ مبدعين حقيقيين')}</h3><p>{tx('Help the community grow with original edits and active members.', 'ساهم في نمو المجتمع بإيديتات أصلية وأعضاء نشطين.')}</p></div><span className="evlr-status-pill evlr-status-live"><CheckCircle2 size={12} /> {tx('Available', 'متاح')}</span></div><div className="evlr-task-foot"><span>{tx('Invites reward after a qualifying action', 'تُصرف مكافأة الدعوة بعد نشاط مؤهل')}</span><span className="evlr-task-value">{rewardSummary?.reward?.referrerPoints ?? 40} + {rewardSummary?.reward?.invitedMemberPoints ?? 20} PTS</span></div></article>
          </div>
        </div>
        <div className="evlr-rewards-footnote"><BadgeCheck size={15} /><span>{tx('Points are in-platform credits, not cash. No cash withdrawals are promised and no ad/task provider is claimed to be connected yet.', 'النقاط رصيد للاستخدام داخل الموقع وليست أموالًا نقدية. لا يوجد وعد بسحب نقدي ولم يتم ربط مزوّد إعلانات أو مهام حتى الآن.')}</span></div>
      </section>
    </div>
  );
}
