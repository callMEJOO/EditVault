import React from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, CheckCircle2,
  Film, Gauge, Headphones, Layers3, Play, ShieldCheck, SlidersHorizontal,
  Sparkles, Volume2, VolumeX, WandSparkles, X, Zap,
} from 'lucide-react';

const SOUND_KEY = 'editvault_studio_sound_off';

export function isStudioSoundMuted() {
  try { return window.localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}

export function setStudioSoundMuted(muted) {
  try { window.localStorage.setItem(SOUND_KEY, muted ? '1' : '0'); } catch { /* Storage may be restricted. */ }
}

/** A short, original synthetic whoosh + bass hit. No audio files, tracking or API keys. */
export function playStudioEntrySound() {
  if (isStudioSoundMuted() || typeof window === 'undefined') return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime + 0.012;
    const duration = 0.78;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.35);
    filter.frequency.exponentialRampToValueAtTime(330, now + duration);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.0001, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.045, now + 0.22);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter).connect(whooshGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);

    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(120, now + 0.28);
    bass.frequency.exponentialRampToValueAtTime(52, now + 0.68);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.0001, now + 0.28);
    bassGain.gain.exponentialRampToValueAtTime(0.12, now + 0.305);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);
    bass.connect(bassGain).connect(ctx.destination);
    bass.start(now + 0.28);
    bass.stop(now + 0.77);
    window.setTimeout(() => { ctx.close().catch(() => {}); }, 1350);
  } catch { /* The site should always work, even when a browser blocks audio. */ }
}

const readyTools = [
  { id: 'audio', Icon: Headphones, number: '04', en: 'Audio Lab', ar: 'معمل الصوت',
    infoEn: '6 tools · MP3 export', infoAr: '٦ أدوات · تصدير MP3',
    descEn: 'Extract and trim audio, reduce noise, balance volume and boost bass.',
    descAr: 'استخرج الصوت وقصّه وقلّل التشويش وحسّن وضوح الكلام والبيز.', style: 'lime',
    TagsEn: ['Extract', 'Denoise', 'Voice'], TagsAr: ['استخراج', 'تنقية', 'تحسين الكلام'] },
  { id: 'color', Icon: SlidersHorizontal, number: '01', en: 'Color & CC', ar: 'الألوان وتصحيحها',
    infoEn: '17 looks · live preview', infoAr: '17 فلترًا · معاينة مباشرة',
    descEn: 'Set the mood. From clean details to bold cinematic looks.',
    descAr: 'اختار طابع الفيديو، من ألوان طبيعية لستايلات سينمائية قوية.', style: 'lime',
    TagsEn: ['Pure Quality', 'B&W', 'Cinematic'], TagsAr: ['نقاء الصورة', 'أبيض وأسود', 'سينمائي'] },
  { id: 'ai', Icon: Sparkles, number: '02', en: 'Video Quality', ar: 'تحسين جودة الفيديو',
    infoEn: 'Sharpen · denoise · resolution', infoAr: 'زيادة الحدة · إزالة التشويش · الدقة',
    descEn: 'Refine details and export at your preferred resolution.',
    descAr: 'حسّن وضوح التفاصيل وقلّل التشويش وحدد دقة التصدير.', style: 'violet',
    TagsEn: ['Sharpen', 'Denoise', '1080p+'], TagsAr: ['حدة التفاصيل', 'تنقية الصورة', 'دقة أعلى'] },
  { id: 'compress', Icon: Gauge, number: '03', en: 'Video Export', ar: 'ضغط وتصدير الفيديو',
    infoEn: 'MP4 · H.264', infoAr: 'MP4 · H.264',
    descEn: 'Balance video quality and file size before downloading.',
    descAr: 'وازن بين حجم الفيديو وجودته قبل ما تحمّل النسخة النهائية.', style: 'blue',
    TagsEn: ['Balanced', 'Smaller size', 'Fast delivery'], TagsAr: ['جودة متوازنة', 'حجم أصغر', 'تنزيل مباشر'] },
];

const roadmapTools = [
  { Icon: WandSparkles, en: 'Smart CC', ar: 'اقتراح الألوان الذكي',
    descEn: 'Suggest color looks from your video without an external API key.',
    descAr: 'اقتراح فلتر ألوان مناسب للفيديو من غير مفتاح API خارجي.', tags: ['SMART LOOKS'], color: 'gold' },
  { Icon: Layers3, en: 'My Projects', ar: 'مشاريعي',
    descEn: 'Return to saved settings and organize your editing sessions.',
    descAr: 'احفظ إعدادات شغلك ونظّم مشاريع المونتاج في مكان واحد.', tags: ['WORKSPACE'], color: 'blue' },
];

export function CreativeStudioIntro({ isArabic, displayName, soundMuted, onToggleSound, onSkip }) {
  const firstName = String(displayName || '').trim().split(/\s+/)[0]?.slice(0, 24);
  const welcome = firstName
    ? (isArabic ? `أهلًا برجوعك، ${firstName}` : `WELCOME BACK, ${firstName.toUpperCase()}`)
    : (isArabic ? 'أهلًا بيك في الاستوديو' : 'WELCOME TO YOUR STUDIO');
  return (
    <div className="evcs-intro" dir={isArabic ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={isArabic ? 'الدخول إلى الاستوديو' : 'Entering the studio'}>
      <div className="evcs-intro-grid" aria-hidden="true" />
      <div className="evcs-intro-beam" aria-hidden="true" />
      <div className="evcs-intro-controls">
        <button className="evcs-intro-quiet" type="button" aria-label={isArabic ? (soundMuted ? 'تشغيل الصوت' : 'كتم الصوت') : (soundMuted ? 'Unmute sound' : 'Mute sound')} aria-pressed={soundMuted} onClick={onToggleSound}>
          {soundMuted ? <VolumeX size={17}/> : <Volume2 size={17}/>}<span>{isArabic ? (soundMuted ? 'الصوت مغلق' : 'الصوت يعمل') : (soundMuted ? 'Sound off' : 'Sound on')}</span>
        </button>
        <button className="evcs-intro-skip" type="button" autoFocus onClick={onSkip}>{isArabic ? 'تخطّي المقدمة' : 'Skip intro'} <X size={16}/></button>
      </div>
      <div className="evcs-intro-content">
        <div className="evcs-intro-symbol" aria-hidden="true"><span>EV</span><i/></div>
        <span className="evcs-intro-micro">EDITVAULT <span>/</span> CREATIVE STUDIO</span>
        <h2>{welcome}</h2>
        <p>{isArabic ? 'كل أدواتك. كل أفكارك. مكان واحد للإبداع.' : 'YOUR TOOLS. YOUR VISION. ONE CREATIVE SPACE.'}</p>
        <div className="evcs-loading"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
        <div className="evcs-intro-progress" aria-hidden="true"><span/></div>
        <small>{isArabic ? 'جارٍ تجهيز مساحة العمل...' : 'INITIALIZING YOUR WORKSPACE...'}</small>
      </div>
      <div className="evcs-intro-index">EV / 001 <span>CREATE BEYOND LIMITS</span></div>
    </div>
  );
}

export default function CreativeStudioDashboard({ language, user, soundMuted, onToggleSound, onReplayIntro, onOpenTool }) {
  const isArabic = language === 'ar';
  const tx = (en, ar) => isArabic ? ar : en;
  const name = String(user?.displayName || user?.display_name || '').trim().split(/\s+/)[0]?.slice(0, 28);
  return (
    <div className="evcs-dashboard" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="evcs-toprow">
        <div className="evcs-crumb"><span className="evcs-indicator"/> EDITVAULT <span className="evcs-slash">/</span> {tx('CREATIVE STUDIO', 'الاستوديو الإبداعي')} <span className="evcs-v1">V1.0</span></div>
        <div className="evcs-head-actions">
          <button type="button" className="evcs-icon-btn" onClick={onToggleSound} aria-label={tx(soundMuted ? 'Enable entrance sound' : 'Mute entrance sound', soundMuted ? 'تفعيل صوت الدخول' : 'كتم صوت الدخول')} title={tx(soundMuted ? 'Entrance sound off' : 'Entrance sound on', soundMuted ? 'صوت الدخول مغلق' : 'صوت الدخول يعمل')}>
            {soundMuted ? <VolumeX size={17}/> : <Volume2 size={17}/>}<span>{tx('Sound', 'الصوت')}</span>
          </button>
          <button type="button" className="evcs-icon-btn" onClick={onReplayIntro} title={tx('Replay studio intro', 'إعادة مقدمة الدخول')}><Play size={16}/><span>{tx('Replay intro', 'إعادة المقدمة')}</span></button>
        </div>
      </div>

      <header className="evcs-hero">
        <div className="evcs-hero-left">
          <div className="evcs-status"><span/> {tx('YOUR CREATIVE WORKSPACE IS READY', 'مساحة الإبداع جاهزة')}</div>
          <span className="evcs-kicker">{name ? tx(`WELCOME BACK, ${name}`, `أهلًا برجوعك، ${name}`) : tx('WELCOME, CREATOR', 'أهلًا بيك في EditVault')}</span>
          <h1>{tx('CREATE', 'حوّل فكرتك')}<br/><em>{tx('BEYOND LIMITS.', 'لإبداع حقيقي.')}</em></h1>
          <p>{tx('From color grading to quality enhancement — pick a tool, shape your vision, and make every frame count.', 'من تصحيح الألوان لتحسين الجودة: اختار أداتك، وابدأ تعدّل الفيديو بالطريقة اللي تناسبك.')}</p>
          <div className="evcs-hero-actions">
            <button className="evcs-primary" type="button" onClick={() => onOpenTool('color')}><WandSparkles size={17}/>{tx('Start creating', 'ابدأ التعديل')}{isArabic ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</button>
            <a className="evcs-secondary" href="#evcs-tools" onClick={(event) => { event.preventDefault(); document.getElementById('evcs-tools')?.scrollIntoView({behavior: 'smooth', block: 'start'}); }}><Layers3 size={16}/>{tx('Explore tools', 'استكشف الأدوات')}</a>
          </div>
          <div className="evcs-hero-foot"><ShieldCheck size={14}/><span>{tx('Preview freely. Export costs are shown before processing.', 'المعاينة مجانية، وتكلفة التصدير بتظهر قبل المعالجة.')}</span></div>
        </div>
        <div className="evcs-hero-visual" aria-hidden="true">
          <div className="evcs-visual-orbit evcs-visual-orbit-a"/><div className="evcs-visual-orbit evcs-visual-orbit-b"/>
          <div className="evcs-visual-window">
            <div className="evcs-visual-bar"><span/><span/><span/><b>EDITVAULT / COMPOSITION 01</b><span className="evcs-visual-live">● LIVE PREVIEW</span></div>
            <div className="evcs-visual-stage"><div className="evcs-visual-shape"><span>EV</span></div><div className="evcs-visual-play"><Play size={19} fill="currentColor"/></div><span className="evcs-visual-time">00:00:12:08</span><span className="evcs-visual-hint">COLOR / COMPOSITION</span></div>
            <div className="evcs-visual-ruler"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span></div>
            <div className="evcs-visual-tracks"><div className="evcs-track"><Film size={12}/><span/><span/><span/></div><div className="evcs-track evcs-track-audio"><AudioLines size={12}/><span/><span/><span/></div><i/></div>
          </div>
          <div className="evcs-float-badge evcs-float-badge-one"><Sparkles size={15}/> COLOR GRADE <b>ACTIVE</b></div>
          <div className="evcs-float-badge evcs-float-badge-two"><Zap size={15}/> CREATIVE MODE</div>
        </div>
      </header>

      <div className="evcs-stats" aria-label={tx('Studio overview', 'نظرة عامة على الاستوديو')}>
        <div><strong>17</strong><span>{tx('COLOR LOOKS', 'فلتر ألوان')}</span></div>
        <div><strong>04</strong><span>{tx('TOOLS READY', 'أدوات جاهزة')}</span></div>
        <div><strong>MP4</strong><span>{tx('VIDEO EXPORT', 'تصدير الفيديو')}</span></div>
        <div className="evcs-stats-note"><CheckCircle2 size={18}/><span>{tx('Original video stays unpublished', 'الفيديو الأصلي لا يُنشر على الموقع')}</span></div>
      </div>

      <div className="evcs-section-heading" id="evcs-tools">
        <div><span className="evcs-caption">01 / {tx('WORKSPACE', 'مساحة العمل')}</span><h2>{tx('Choose your tool.', 'اختار أداتك.')} <em>{tx('Make it yours.', 'وابدأ الإبداع.')}</em></h2><p>{tx('Select a tool to open the existing editor and keep your export settings.', 'اختار الأداة اللي محتاجها، وهتفتحلك واجهة التعديل الأصلية من غير ما نخسر إعداداتك.')}</p></div>
        <span className="evcs-section-count">04 {tx('AVAILABLE NOW', 'متاحة الآن')}</span>
      </div>
      <div className="evcs-tool-grid">
        {readyTools.map(({id, Icon, number, en, ar, descEn, descAr, infoEn, infoAr, style, TagsEn, TagsAr}) => (
          <button key={id} type="button" className={`evcs-tool-card evcs-tool-${style}`} onClick={() => onOpenTool(id)}>
            <span className="evcs-tool-top"><span className="evcs-tool-icon"><Icon size={25}/></span><span className="evcs-tool-num">{number} / LIVE</span></span>
            <span className="evcs-tool-copy"><strong>{tx(en, ar)}</strong><small>{tx(infoEn, infoAr)}</small><span className="evcs-tool-desc">{tx(descEn, descAr)}</span></span>
            <span className="evcs-tool-tags">{(isArabic ? TagsAr : TagsEn).map(tag => <span key={tag}>{tag}</span>)}</span>
            <span className="evcs-tool-bottom"><span>{tx('OPEN WORKSPACE', 'افتح مساحة العمل')}</span><ArrowUpRight size={20}/></span>
          </button>
        ))}
      </div>

      <div className="evcs-section-heading evcs-soon-heading">
        <div><span className="evcs-caption">02 / {tx('ON THE ROADMAP', 'قريبًا')}</span><h2>{tx('More ways to create.', 'أدوات جديدة في الطريق.')}</h2><p>{tx('These features are planned, not yet available. Nothing here charges points.', 'المميزات دي لسه تحت التطوير، ومفيش أي خصم نقاط منها دلوقتي.')}</p></div>
        <span className="evcs-section-count is-soon">{tx('COMING SOON', 'قريبًا')}</span>
      </div>
      <div className="evcs-roadmap-grid">
        {roadmapTools.map(({Icon, en, ar, descEn, descAr, tags, color}) => (
          <article key={en} className={`evcs-roadmap-card evcs-roadmap-${color}`}>
            <div className="evcs-roadmap-icon"><Icon size={21}/></div>
            <div><div className="evcs-roadmap-title"><h3>{tx(en, ar)}</h3><span>{tx('Soon', 'قريبًا')}</span></div><p>{tx(descEn, descAr)}</p><div className="evcs-roadmap-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
          </article>
        ))}
      </div>
      <div className="evcs-bottom-note"><span><Zap size={16}/>{tx('THE NEXT ERA OF EDITVAULT', 'المرحلة الجاية من EditVault')}</span><p>{tx('Video and basic audio tools are live. Advanced vocal separation and project storage need extra development.', 'أدوات الفيديو والصوت الأساسية متاحة. فصل الغناء عن الموسيقى وحفظ المشاريع محتاجين تطوير إضافي.')}</p></div>
    </div>
  );
}
