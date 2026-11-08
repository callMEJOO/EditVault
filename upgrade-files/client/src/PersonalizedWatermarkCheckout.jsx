import React, { useEffect, useState } from 'react';
import { Check, Coins, LockKeyhole, PenLine, Sparkles, X, WandSparkles } from 'lucide-react';
import './personalized-watermark.css';

const styles = [
  { id: 'corner', title: 'Corner tag', arabic: 'توقيع الزاوية', hint: 'Subtle and clean', hintAr: 'هادئ واحترافي' },
  { id: 'signature', title: 'Signature', arabic: 'توقيع سينمائي', hint: 'At the bottom center', hintAr: 'أسفل منتصف الفيديو' },
  { id: 'neon', title: 'Neon center', arabic: 'نيون في المنتصف', hint: 'Bold and luminous', hintAr: 'بارز بإضاءة لايم' },
  { id: 'repeated', title: 'Multi-mark', arabic: 'علامات متعددة', hint: 'Repeats across the video', hintAr: 'الاسم في كذا مكان بالفيديو' },
];
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function PersonalizedWatermarkCheckout({ edit, points = 0, busy = false, language = 'en', onClose, onConfirm }) {
  const [mode, setMode] = useState('none');
  const [name, setName] = useState('');
  const [style, setStyle] = useState('signature');
  const [brief, setBrief] = useState('');
  const [pricing, setPricing] = useState(null);
  const [pricingError, setPricingError] = useState('');
  const ar = language === 'ar';
  const t = (en, arabic) => ar ? arabic : en;
  useEffect(() => {
    if (!edit) return undefined;
    setMode('none'); setName(''); setStyle('signature'); setBrief(''); setPricing(null); setPricingError('');
    const controller = new AbortController();
    const token = localStorage.getItem('editvault_token');
    fetch(`${API_URL}/api/edits/watermark-pricing`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Cannot load pricing.'); return value; })
      .then(setPricing)
      .catch((error) => { if (error.name !== 'AbortError') setPricingError(error.message || 'Cannot load pricing.'); });
    return () => controller.abort();
  }, [edit?.id]);
  useEffect(() => {
    if (!edit) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edit, busy, onClose]);
  if (!edit) return null;
  const cleanName = name.trim();
  const nameValid = mode === 'none' || (cleanName.length > 0 && [...cleanName].length <= 30 && !/[\u0000-\u001f\u007f\r\n]/u.test(cleanName));
  const basePrice = Number(edit.price ?? edit.price_points ?? 0);
  const autoFee = pricing?.freeAutoAvailable ? 0 : 10;
  const fee = mode === 'auto' ? autoFee : mode === 'manual' ? 40 : 0;
  const total = basePrice + fee;
  const canAfford = Number(points) >= total;
  const previewLabel = cleanName || 'YOUR NAME';
  const submit = (event) => {
    event.preventDefault();
    if (busy || !nameValid || !pricing || pricingError || !canAfford) return;
    onConfirm?.(mode === 'none' ? null : mode === 'manual' ? { mode, name: cleanName, brief: brief.trim() } : { mode, name: cleanName, style });
  };
  return (
    <div className="evwm-backdrop" dir={ar ? 'rtl' : 'ltr'} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
      <form className="evwm-panel" onSubmit={submit} aria-label={t('Customize your edit at checkout', 'تخصيص الإيديت وقت الشراء')}>
        <button className="evwm-close" type="button" aria-label={t('Close', 'إغلاق')} onClick={() => onClose?.()} disabled={busy}><X size={18}/></button>
        <div className="evwm-kicker"><Sparkles size={13}/> EDITVAULT / {t('PERSONALIZED CHECKOUT', 'تخصيص الإيديت')}</div>
        <h2>{t('Make the edit ', 'خلّي الإيديت ')}<span>{t('yours.', 'باسمك.')}</span></h2>
        <p className="evwm-lead">{t('Choose a name overlay or a handcrafted design. The untouched original stays in your library.', 'اختار كتابة اسمك تلقائيًا أو تصميم مخصوص يدوي. النسخة الأصلية بتفضل محفوظة في مكتبتك.')}</p>
        <div className="evwm-product"><div className="evwm-product-icon"><PenLine size={21}/></div><div><strong>{edit.title}</strong><small>{t('Original edit', 'الإيديت الأصلي')}</small></div><b><Coins size={14}/> {basePrice} {t('PTS', 'نقطة')}</b></div>
        <div className="evwm-choice-list">
          <label className={`evwm-choice ${mode === 'none' ? 'selected' : ''}`}><input type="radio" name="customization" checked={mode === 'none'} onChange={() => setMode('none')}/><span><strong>{t('Original only', 'الأصلية بس')}</strong><small>{t('No name added', 'من غير إضافة اسم')}</small></span><b>+0 {t('PTS', 'نقطة')}</b></label>
          <label className={`evwm-choice ${mode === 'auto' ? 'selected' : ''}`}><input type="radio" name="customization" checked={mode === 'auto'} onChange={() => setMode('auto')}/><span><strong>{t('Add my name automatically', 'اكتب اسمي تلقائيًا')}</strong><small>{t('First time free, then 10 points each time', 'أول مرة مجانًا وبعدها 10 نقاط لكل مرة')}</small></span><b>{pricing ? (pricing.freeAutoAvailable ? t('FIRST FREE', 'أول مرة مجانًا') : '+10 PTS') : '…'}</b></label>
          <label className={`evwm-choice ${mode === 'manual' ? 'selected' : ''}`}><input type="radio" name="customization" checked={mode === 'manual'} onChange={() => setMode('manual')}/><span><strong><WandSparkles size={15}/> {t('Special custom design (manual)', 'تصميم مخصوص يدوي')}</strong><small>{t('Made manually after purchase · fulfillment required', 'طلب بيتنفّذ يدويًا بعد الشراء')}</small></span><b>+40 {t('PTS', 'نقطة')}</b></label>
        </div>
        {mode !== 'none' && <div className="evwm-options">
          <label className="evwm-field">{t('Name on video', 'الاسم اللي هيظهر على الفيديو')}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('Your name or tag…', 'اسمك أو لقبك…')} autoComplete="off" required /><small>{[...cleanName].length}/30</small></label>
          {mode === 'auto' && <><div className="evwm-subheading">{t('Choose the placement', 'اختار شكل الاسم')} <span>04 {t('STYLES', 'أشكال')}</span></div>
            <div className="evwm-style-grid" role="radiogroup" aria-label={t('Watermark style', 'شكل العلامة المائية')}>
              {styles.map((option) => <button type="button" role="radio" aria-checked={style === option.id} className={`evwm-style ${style === option.id ? 'selected' : ''}`} key={option.id} onClick={() => setStyle(option.id)}>
                <span className={`evwm-style-picture evwm-style-${option.id}`}><span>{previewLabel}</span>{option.id === 'repeated' && <><em>{previewLabel}</em><i>{previewLabel}</i></>}</span>
                <strong>{ar ? option.arabic : option.title}</strong><small>{ar ? option.hintAr : option.hint}</small>{style === option.id && <Check className="evwm-checked" size={15}/>}</button>)}
            </div></>}
          {mode === 'manual' && <div className="evwm-manual-panel"><strong>{t('Manual customization request', 'تفاصيل التصميم المخصوص')}</strong><p>{t('Tell us your preferred font, colors, placement and style. The admin will prepare the custom video after purchase.', 'اكتب الخط والألوان ومكان الاسم والشكل اللي تحبه. الأدمن هيجهّز النسخة المخصوصة بعد الشراء.')}</p><textarea rows={3} maxLength={500} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t('For example: my name as a cinematic red signature at 0:10…', 'مثلاً: اسمي بتوقيع أحمر سينمائي عند الثانية 10…')}/><small>{brief.length}/500</small></div>}
          {!nameValid && <p className="evwm-error">{t('Enter a name (1–30 characters) on one line.', 'اكتب اسم من 1 إلى 30 حرف في سطر واحد.')}</p>}
          <div className="evwm-info"><LockKeyhole size={15}/>{mode === 'manual' ? t('Your manual copy appears for download after the admin finishes and uploads it.', 'نسختك المخصوصة هتظهر للتحميل بعد ما الأدمن يخلص ويرفعها.') : t('The name and placement are saved with this purchase.', 'الاسم والشكل بيتحفظوا مع عملية الشراء.')}</div>
        </div>}
        {pricingError && <p className="evwm-error">{pricingError}</p>}
        <div className="evwm-price-breakdown"><span>{t('Original', 'الأصلية')} <b>{basePrice}</b></span><span>{t('Personalization', 'التخصيص')} <b>{fee ? `+${fee}` : t('FREE', 'مجاني')}</b></span><span className="evwm-total">{t('Total', 'الإجمالي')} <b>{total} {t('PTS', 'نقطة')}</b></span></div>
        <div className="evwm-footer"><div className="evwm-balance"><span>{t('Wallet balance', 'رصيد المحفظة')}</span><strong>{points} {t('points', 'نقطة')}</strong></div><button type="submit" disabled={busy || !nameValid || !canAfford || !pricing || Boolean(pricingError)} className="evwm-buy">{busy ? t('Processing…', 'جارٍ الشراء…') : !pricing ? t('Loading prices…', 'تحميل الأسعار…') : canAfford ? t(`Confirm · ${total} PTS`, `تأكيد · ${total} نقطة`) : t('Not enough points', 'النقاط غير كافية')} <Check size={16}/></button></div>
      </form>
    </div>
  );
}
