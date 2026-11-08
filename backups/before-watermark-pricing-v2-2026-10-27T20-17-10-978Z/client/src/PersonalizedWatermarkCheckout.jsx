import React, { useEffect, useState } from 'react';
import { Check, Coins, LockKeyhole, PenLine, Sparkles, X } from 'lucide-react';
import './personalized-watermark.css';

const styles = [
  { id: 'corner', title: 'Corner tag', arabic: 'توقيع الزاوية', hint: 'Subtle and clean', hintAr: 'هادئ واحترافي' },
  { id: 'signature', title: 'Signature', arabic: 'توقيع سينمائي', hint: 'At the bottom center', hintAr: 'أسفل منتصف الفيديو' },
  { id: 'neon', title: 'Neon center', arabic: 'نيون في المنتصف', hint: 'Bold and luminous', hintAr: 'بارز بإضاءة لايم' },
  { id: 'repeated', title: 'Multi-mark', arabic: 'علامات متعددة', hint: 'Repeats across the video', hintAr: 'الاسم في كذا مكان بالفيديو' },
];

export default function PersonalizedWatermarkCheckout({ edit, points = 0, busy = false, language = 'en', onClose, onConfirm }) {
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState('');
  const [style, setStyle] = useState('signature');
  const ar = language === 'ar';
  const t = (en, arabic) => ar ? arabic : en;

  useEffect(() => {
    if (edit) {
      setEnabled(false);
      setName('');
      setStyle('signature');
    }
  }, [edit?.id]);

  useEffect(() => {
    if (!edit) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edit, busy, onClose]);

  if (!edit) return null;
  const cleanName = name.trim();
  const nameValid = !enabled || (cleanName.length > 0 && [...cleanName].length <= 30 && !/[\u0000-\u001f\u007f\r\n]/u.test(cleanName));
  const price = Number(edit.price ?? edit.price_points ?? 0);
  const canAfford = Number(points) >= price;
  const previewLabel = cleanName || 'YOUR NAME';
  const submit = (event) => {
    event.preventDefault();
    if (busy || !nameValid || !canAfford) return;
    onConfirm?.(enabled ? { name: cleanName, style } : null);
  };
  return (
    <div className="evwm-backdrop" dir={ar ? 'rtl' : 'ltr'} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
      <form className="evwm-panel" onSubmit={submit} aria-label={t('Personalize your edit before checkout', 'تخصيص الإيديت قبل الشراء')}>
        <button className="evwm-close" type="button" aria-label={t('Close', 'إغلاق')} onClick={() => onClose?.()} disabled={busy}><X size={18} /></button>
        <div className="evwm-kicker"><Sparkles size={13} /> {t('EDITVAULT / PERSONALIZED CHECKOUT', 'EDITVAULT / تخصيص الشراء')}</div>
        <h2>{t('Make the edit ', 'خلّي الإيديت ')}<span>{t('yours.', 'باسمك.')}</span></h2>
        <p className="evwm-lead">{t('Buy the original once. Optionally add your name to a second, personalized copy at no extra points.', 'اشتري النسخة الأصلية مرة واحدة، ولو تحب أضف اسمك على نسخة إضافية من الفيديو بدون نقاط زيادة.')}</p>
        <div className="evwm-product"><div className="evwm-product-icon"><PenLine size={21} /></div><div><strong>{edit.title}</strong><small>{t('One-of-one original edit', 'إيديت أصلي وحصري')}</small></div><b><Coins size={14} /> {price} {t('PTS', 'نقطة')}</b></div>
        <label className="evwm-toggle"><span className={`evwm-switch ${enabled ? 'on' : ''}`} aria-hidden="true"><i /></span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /><span><strong>{t('Add my name to the video', 'اكتب اسمي على الفيديو')}</strong><small>{t('Optional · your original stays untouched', 'اختياري · النسخة الأصلية بتفضل زي ما هي')}</small></span><span className="evwm-free">{t('FREE', 'مجاني')}</span></label>
        {enabled && <div className="evwm-options">
          <label className="evwm-field">{t('Name on video', 'الاسم اللي هيظهر على الفيديو')}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('Type your name or tag…', 'اكتب اسمك أو لقبك…')} autoComplete="off" required /><small>{[...cleanName].length}/30 {t('characters', 'حرف')}</small></label>
          <div className="evwm-subheading">{t('Choose your watermark style', 'اختار شكل العلامة المائية')} <span>04 {t('STYLES', 'أشكال')}</span></div>
          <div className="evwm-style-grid" role="radiogroup" aria-label={t('Watermark style', 'شكل العلامة المائية')}>
            {styles.map((option) => <button type="button" role="radio" aria-checked={style === option.id} className={`evwm-style ${style === option.id ? 'selected' : ''}`} key={option.id} onClick={() => setStyle(option.id)}>
              <span className={`evwm-style-picture evwm-style-${option.id}`}><span>{previewLabel}</span>{option.id === 'repeated' && <><em>{previewLabel}</em><i>{previewLabel}</i></>}</span>
              <strong>{ar ? option.arabic : option.title}</strong><small>{ar ? option.hintAr : option.hint}</small>{style === option.id && <Check className="evwm-checked" size={15} />}
            </button>)}
          </div>
          {!nameValid && <p className="evwm-error">{t('Enter a name of up to 30 characters on one line.', 'اكتب اسم في سطر واحد بحد أقصى 30 حرف.')}</p>}
          <div className="evwm-info"><LockKeyhole size={15}/>{t('Name and style are saved with your purchase. You can download both copies from My Library.', 'الاسم والستايل بيتحفظوا مع الشراء، وتقدر تحمل النسخة الأصلية ونسختك المخصصة من مكتبتي.')}</div>
        </div>}
        <div className="evwm-footer"><div className="evwm-balance"><span>{t('Wallet balance', 'رصيد المحفظة')}</span><strong>{points} {t('points', 'نقطة')}</strong></div><button type="submit" disabled={busy || !nameValid || !canAfford} className="evwm-buy">{busy ? t('Processing…', 'جارٍ الشراء…') : canAfford ? t(`Confirm purchase · ${price} PTS`, `تأكيد الشراء · ${price} نقطة`) : t('Not enough points', 'النقاط غير كافية')} <Check size={16}/></button></div>
      </form>
    </div>
  );
}
