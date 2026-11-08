/* EditVault Audio Preview V2.2 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, ArrowDownToLine, CheckCircle2, Clock3, Coins, FileAudio, FileVideo2, Headphones, LoaderCircle, Music2, Scissors, SlidersHorizontal, Sparkles, Upload, Waves, Volume2, X } from 'lucide-react';
import './audio-lab.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const MAX_BYTES = 150 * 1024 * 1024;
const MAX_SECONDS = 600;
const tools = [
  { id: 'extract', Icon: FileVideo2, en: 'Extract audio from video', ar: 'استخراج الصوت من الفيديو', descEn: 'Save your video soundtrack as an MP3.', descAr: 'حوّل صوت الفيديو إلى ملف MP3 مستقل.', points: 1, category: 'video' },
  { id: 'trim', Icon: Scissors, en: 'Trim audio', ar: 'قص مقطع صوتي', descEn: 'Choose start and end times, then export just that part.', descAr: 'حدد بداية ونهاية المقطع اللي عايز تحتفظ بيه.', points: 1, category: 'edit' },
  { id: 'normalize', Icon: Volume2, en: 'Balance volume', ar: 'توازن مستوى الصوت', descEn: 'Bring your audio to a consistent listening level.', descAr: 'خلّي مستوى الصوت متوازنًا ومناسبًا للاستماع.', points: 1, category: 'edit' },
  { id: 'denoise', Icon: Waves, en: 'Reduce background noise', ar: 'تقليل التشويش', descEn: 'Reduce steady background hiss and noise.', descAr: 'قلّل صوت الهسيس والضوضاء الثابتة في الخلفية.', points: 2, category: 'enhance' },
  { id: 'voice', Icon: Headphones, en: 'Improve voice clarity', ar: 'تحسين وضوح الكلام', descEn: 'Focus on speech with EQ, denoise and volume balance.', descAr: 'وضّح الكلام باستخدام تنقية الصوت وضبط الترددات.', points: 3, category: 'enhance' },
  { id: 'bass', Icon: Music2, en: 'Bass boost', ar: 'تعزيز الصوت الجهير', descEn: 'Add depth to low frequencies without excessive clipping.', descAr: 'قوّي ترددات البيز مع الحد من التشويه قدر الإمكان.', points: 2, category: 'edit' },
];
const formatBytes = (value) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`;
const fmtTime = (value) => `${Math.floor(Number(value || 0) / 60)}:${String(Math.floor(Number(value || 0) % 60)).padStart(2, '0')}`;

export default function AudioLab({ language = 'en', user, onLoginRequest, onPointsChange, onNotice }) {
  const ar = language === 'ar';
  const tx = (en, arabic) => ar ? arabic : en;
  const [tool, setTool] = useState('extract');
  const [category, setCategory] = useState('all');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [duration, setDuration] = useState(null);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);
  const isVideo = file ? /\.(mp4|mov|webm|mkv)$/i.test(file.name) : false;
  const selected = tools.find(item => item.id === tool) || tools[0];
  const visible = useMemo(() => tools.filter(item => category === 'all' || item.category === category), [category]);
  useEffect(() => {
    if (!file) { setFileUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!result?.url) return undefined;
    return () => URL.revokeObjectURL(result.url);
  }, [result?.url]);

  function chooseFile(picked) {
    setError(''); setResult(null); setDuration(null); setStart('0'); setEnd('');
    if (!picked) return;
    if (!/\.(mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|webm|mkv)$/i.test(picked.name)) {
      setError(tx('Choose an audio or video file in a supported format.', 'اختار ملف صوت أو فيديو بصيغة مدعومة.')); return;
    }
    if (picked.size > MAX_BYTES) { setError(tx('Maximum file size is 150 MB.', 'الحد الأقصى لحجم الملف 150 ميجابايت.')); return; }
    setFile(picked);
    if (/\.(mp4|mov|webm|mkv)$/i.test(picked.name)) setTool('extract');
    else if (tool === 'extract') setTool('trim');
  }

  async function process() {
    if (!user) { onLoginRequest?.(); return; }
    if (busy || !file) return;
    if (selected.id === 'extract' && !isVideo) { setError(tx('Choose a video file to extract its audio.', 'لاستخراج الصوت، اختار ملف فيديو.')); return; }
    if (duration && duration > MAX_SECONDS + 0.1) { setError(tx('Choose a file up to 10 minutes long.', 'اختار ملف مدته ١٠ دقائق أو أقل.')); return; }
    if (selected.id === 'trim') {
      const a = Number(start), b = Number(end);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a || b - a > MAX_SECONDS || (duration && b > duration + 0.1)) {
        setError(tx('Enter valid start and end times within the audio length.', 'حدد وقت بداية ونهاية صحيحين داخل مدة الملف.')); return;
      }
    }
    const token = localStorage.getItem('editvault_token');
    if (!token) { onLoginRequest?.(); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const body = new FormData();
      body.append('audio', file, file.name);
      body.append('tool', selected.id);
      if (selected.id === 'trim') { body.append('start', String(Number(start))); body.append('end', String(Number(end))); }
      const response = await fetch(`${API_URL}/api/editlab/audio/process`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (typeof data.balance === 'number') onPointsChange?.(data.balance);
        if (response.status === 402) throw new Error(tx(`You need ${data.requiredPoints || selected.points} points. Available: ${data.balance ?? '?'}.`, `الأداة دي بتكلف ${data.requiredPoints || selected.points} نقطة، ورصيدك ${data.balance ?? '؟'} نقطة.`));
        if (data.error === 'Choose a file up to 10 minutes long.') throw new Error(tx(data.error, 'اختار ملف مدته ١٠ دقائق أو أقل.'));
        throw new Error(data.error || tx('Audio processing failed.', 'تعذّرت معالجة الصوت.'));
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error(tx('The exported file is empty.', 'ملف الصوت الناتج فارغ.'));
      const url = URL.createObjectURL(blob);
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 50) || 'audio';
      const name = `${base}-${selected.id}-editvault.mp3`;
      setResult({ name, url, size: blob.size });
      // Audio Preview V2.2: keep the generated file in memory for playback.
      // Download starts only when the user clicks the download link below.
      try {
        const wallet = await fetch(`${API_URL}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } });
        if (wallet.ok) { const data = await wallet.json(); onPointsChange?.(Number(data.balance ?? data.wallet?.balance ?? 0)); }
      } catch { /* Processing succeeded even if wallet refresh fails. */ }
      onNotice?.(tx('Your audio is ready to preview. Listen before downloading.', 'الصوت جاهز للمعاينة. اسمع النتيجة قبل التنزيل.'));
    } catch (e) { setError(e.message || tx('Audio processing failed.', 'حصل خطأ أثناء معالجة الصوت.')); }
    finally { setBusy(false); }
  }

  return (
    <div className="eval-root">
      <header className="eval-heading">
        <span className="eval-eyebrow"><span/> EDITVAULT / AUDIO LAB</span>
        <h2>{tx('Make every sound count.', 'كل صوت يفرق.')} <em>{tx('Create your mix.', 'ظبّط الصوت بطريقتك.')}</em></h2>
        <p>{tx('Extract, trim, enhance and export audio using FFmpeg. No API key needed.', 'استخرج الصوت، قصّه، نقّيه وحمّله. من غير مفتاح API أو برامج إضافية على جهازك.')}</p>
        <div className="eval-chips"><span><Sparkles size={14}/> {tx('6 real tools', '٦ أدوات فعلية')}</span><span><Coins size={14}/> {tx('From 1 point', 'من نقطة واحدة')}</span><span><Clock3 size={14}/> {tx('Max 10 minutes', 'حد أقصى ١٠ دقائق')}</span></div>
      </header>

      <div className="eval-layout">
        <div className="eval-panel">
          <div className="eval-panel-head"><div><span>01 / {tx('TOOLS', 'الأدوات')}</span><h3>{tx('Choose a tool', 'اختار الأداة')}</h3></div><AudioLines size={21}/></div>
          <div className="eval-filters" role="group" aria-label={tx('Audio tool categories', 'تصنيفات أدوات الصوت')}>
            {[['all', 'All', 'الكل'], ['video', 'Video to audio', 'من الفيديو'], ['edit', 'Editing', 'تعديل الصوت'], ['enhance', 'Enhance', 'تحسين الصوت']].map(([id,en,arabic]) => <button type="button" key={id} aria-pressed={category === id} className={category === id ? 'is-active' : ''} onClick={() => setCategory(id)}>{tx(en,arabic)}</button>)}
          </div>
          <div className="eval-tools">{visible.map(({ id, Icon, en, ar: arabic, descEn, descAr, points }) => (
            <button type="button" key={id} aria-pressed={tool === id} className={`eval-tool ${tool === id ? 'is-active' : ''}`} onClick={() => { setTool(id); setError(''); setResult(null); }}>
              <span className="eval-tool-icon"><Icon size={19}/></span><span className="eval-tool-copy"><strong>{tx(en, arabic)}</strong><small>{tx(descEn, descAr)}</small></span><span className="eval-price"><b>{points}</b><small>{tx('pt', 'نقطة')}</small></span>
            </button>
          ))}</div>
        </div>

        <div className="eval-panel eval-upload-panel">
          <div className="eval-panel-head"><div><span>02 / {tx('WORKSPACE', 'مساحة العمل')}</span><h3>{tx('Your audio workspace', 'مساحة تعديل الصوت')}</h3></div><SlidersHorizontal size={21}/></div>
          <input ref={fileInput} type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.mp4,.mov,.webm,.mkv,audio/*,video/mp4,video/webm" hidden onChange={e => chooseFile(e.target.files?.[0])} />
          {!file ? <button type="button" className="eval-drop" onClick={() => fileInput.current?.click()}><span><Upload size={27}/></span><strong>{tx('Upload audio or video', 'ارفع ملف صوت أو فيديو')}</strong><small>{tx('MP3, WAV, M4A, FLAC, MP4, MOV, WebM and more', 'MP3 وWAV وM4A وMP4 وMOV وWebM وغيرها')}</small><em>{tx('150 MB max · 10 minutes max', 'حتى ١٥٠ ميجابايت · ١٠ دقائق')}</em></button> : <div className="eval-file-wrap">
            <div className="eval-file-line"><div className="eval-file-icon">{isVideo ? <FileVideo2 size={20}/> : <FileAudio size={20}/>}</div><div><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)} {duration ? `· ${fmtTime(duration)}` : ''}</small></div><button type="button" onClick={() => fileInput.current?.click()} title={tx('Change file', 'تغيير الملف')}><Upload size={16}/></button><button type="button" onClick={() => { setFile(null); setResult(null); setError(''); if (fileInput.current) fileInput.current.value = ''; }} title={tx('Remove file', 'حذف الملف')}><X size={16}/></button></div>
            {isVideo ? <video src={fileUrl} controls playsInline preload="metadata" onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) { setDuration(d); setEnd(String(Math.min(d, MAX_SECONDS).toFixed(1))); } }} /> : <audio src={fileUrl} controls preload="metadata" onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) { setDuration(d); setEnd(String(Math.min(d, MAX_SECONDS).toFixed(1))); } }} />}
            <p>{tx('Listen to the original before processing.', 'اسمع الملف الأصلي قبل التعديل.')}</p>
          </div>}
          {tool === 'trim' && <div className="eval-trim"><label>{tx('Start (seconds)', 'البداية (بالثواني)')}<input type="number" min="0" max="600" step="0.1" value={start} onChange={e => setStart(e.target.value)} /></label><label>{tx('End (seconds)', 'النهاية (بالثواني)')}<input type="number" min="0" max="600" step="0.1" value={end} onChange={e => setEnd(e.target.value)} /></label></div>}
          <div className="eval-checkout"><div><small>{tx('SELECTED TOOL', 'الأداة المختارة')}</small><strong>{tx(selected.en, selected.ar)}</strong></div><div><small>{tx('EXPORT COST', 'تكلفة التصدير')}</small><strong><Coins size={16}/> {selected.points} {tx('points', 'نقطة')}</strong></div></div>
          <button type="button" disabled={busy || !file || !!result} className="eval-export" onClick={process}>{busy ? <><LoaderCircle size={18} className="eval-spin"/>{tx('Processing audio...', 'جارٍ معالجة الصوت...')}</> : result ? <><CheckCircle2 size={19}/>{tx('Preview ready below', 'المعاينة جاهزة بالأسفل')}</> : <><Headphones size={19}/>{user ? tx('Process & preview audio', 'معالجة الصوت ومعاينة النتيجة') : tx('Sign in to process', 'سجّل دخولك للمعالجة')}</>}</button>
          <div className="eval-hint">{tx('Processing costs the points shown above. Listening and downloading the finished result cost no additional points. Failed jobs are refunded.', 'المعالجة بتكلف النقاط الموضحة فوق. سماع النتيجة وتنزيلها بعد المعالجة من غير خصم إضافي. لو المعالجة فشلت بترجع النقاط.')}</div>
          {error && <div className="eval-error" role="alert">{error}</div>}
          {/* EditVault Audio Preview V2.2 */}
          {result && <section className="eval-preview-result" aria-label={tx('Processed audio preview', 'معاينة الصوت بعد التعديل')}>
            <div className="eval-preview-heading"><span className="eval-preview-icon"><CheckCircle2 size={20}/></span><div><strong>{tx('Listen before downloading', 'اسمع النتيجة قبل التنزيل')}</strong><small>{tx('Your processed audio is ready. Compare it with the original player above.', 'الصوت بعد التعديل جاهز. تقدر تقارنه بالملف الأصلي اللي فوق.')}</small></div></div>
            <div className="eval-preview-track"><div className="eval-preview-track-title"><Headphones size={17}/><span>{tx('Processed audio', 'الصوت بعد التعديل')}</span><span className="eval-preview-badge">MP3</span></div><audio key={result.url} src={result.url} controls preload="metadata" aria-label={tx('Play processed audio', 'تشغيل الصوت بعد التعديل')}/><small className="eval-preview-file" title={result.name}>{result.name} · {formatBytes(result.size)}</small></div>
            <a className="eval-preview-download" href={result.url} download={result.name}><ArrowDownToLine size={19}/>{tx('Download final MP3', 'تنزيل الصوت النهائي MP3')}</a>
            <p className="eval-preview-help">{tx('Replay as often as you like with no extra points. The preview disappears if you choose another file or tool.', 'اسمع النتيجة براحتك من غير نقاط إضافية. المعاينة هتختفي لو غيّرت الملف أو الأداة.')}</p>
          </section>}
        </div>
      </div>
      <div className="eval-footnote"><span><Headphones size={16}/>{tx('COMING LATER', 'قريبًا')}</span><p>{tx('True vocal/music separation needs an additional local separation model. These tools do not pretend to isolate vocals.', 'فصل الغناء عن الموسيقى بشكل حقيقي محتاج نموذج فصل أصوات محلي إضافي. الأدوات الحالية لا تدّعي إنها بتفصل الغناء عن الموسيقى.')}</p></div>
    </div>
  );
}
