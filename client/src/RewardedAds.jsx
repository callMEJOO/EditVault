import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Gift, ShieldCheck, ArrowUpRight, RefreshCcw, Sparkles, ExternalLink } from 'lucide-react';
import './rewarded-ads.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const authHeaders = () => {
  const token = localStorage.getItem('editvault_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function RewardedAds({ active, user, language = 'ar', onLogin, onBalanceUpdate }) {
  const ar = language === 'ar';
  const t = (en, arabic) => ar ? arabic : en;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const statusRes = await fetch(`${API_URL}/api/ads/status`, { cache: 'no-store' });
      if (!statusRes.ok) throw new Error(t('Could not check ad availability.', 'تعذّر التحقق من إتاحة الإعلانات.'));
      const status = await statusRes.json();
      setEnabled(Boolean(status.enabled));
      if (user && localStorage.getItem('editvault_token')) {
        const [walletRes, historyRes] = await Promise.all([
          fetch(`${API_URL}/api/wallet`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${API_URL}/api/ads/history`, { headers: authHeaders(), cache: 'no-store' })
        ]);
        if (walletRes.ok) {
          const wallet = await walletRes.json();
          const nextBalance = Number(wallet.balance || 0);
          setBalance(nextBalance);
          onBalanceUpdate?.(nextBalance);
        }
        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(Array.isArray(data.events) ? data.events : []);
        }
      } else {
        setBalance(null);
        setHistory([]);
      }
      setMessage('');
    } catch (error) {
      setMessage(error.message || t('Could not load ads.', 'تعذّر تحميل الإعلانات.'));
    } finally { setLoading(false); }
  }, [active, user?.id, language, onBalanceUpdate]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!active || !user) return;
    // When a member returns from the provider, fetch the authoritative wallet balance.
    const onFocus = () => { refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, user?.id, refresh]);

  if (!active) return null;

  const openOfferwall = async () => {
    if (!user) { onLogin?.(); return; }
    if (!enabled || opening) return;
    setOpening(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/ads/link`, { headers: authHeaders(), cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || t('Ads are not available right now.', 'الإعلانات غير متاحة حاليًا.'));
      // Same-tab navigation avoids popup blockers. Back button returns to /earn.
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error.message || t('Could not open ads.', 'تعذّر فتح الإعلانات.'));
      setOpening(false);
    }
  };

  return (
    <section className="evads-root" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'} aria-labelledby="evads-title">
      <div className="evads-orb evads-orb-left" aria-hidden="true" />
      <div className="evads-orb evads-orb-right" aria-hidden="true" />
      <div className="evads-heading">
        <div>
          <span className="evads-kicker"><Sparkles size={15} /> EDITVAULT / REWARDS</span>
          <h2 id="evads-title">{t('Earn points.', 'اجمع نقاطك.')} <em>{t('Unlock more.', 'وافتح أكتر.')}</em></h2>
          <p>{t('Choose an available rewarded ad or sponsored offer. Points arrive only after the ad partner verifies completion.', 'اختار إعلانًا أو عرضًا ممولًا متاحًا. النقاط بتوصل لمحفظتك بعد تأكيد الشبكة إتمام العرض بنجاح.')}</p>
        </div>
        <div className="evads-balance">
          <span><Coins size={17} /> {t('MY BALANCE', 'رصيدي')}</span>
          <strong>{user ? (balance === null ? '—' : balance.toLocaleString(ar ? 'ar-EG' : 'en-US')) : '—'}</strong>
          <small>{t('In-platform points · Not cash', 'نقاط داخل الموقع · ليست أموالًا')}</small>
        </div>
      </div>

      <div className="evads-grid">
        <div className="evads-primary">
          <div className="evads-primary-icon"><Gift size={28} /></div>
          <div className="evads-chip">{enabled ? t('REWARDS ACTIVE', 'المكافآت مفعّلة') : t('COMING SOON', 'قريبًا')}</div>
          <h3>{t('Rewarded ads & offers', 'إعلانات وعروض بمكافآت')}</h3>
          <p>{enabled
            ? t('Open the offers page and choose what suits you. Availability and reward amounts depend on the provider.', 'افتح صفحة العروض واختار المناسب ليك. توافر الإعلانات وعدد النقاط بيتحدد حسب الشبكة والعرض.')
            : t('We’re preparing verified ad rewards. No points will be awarded until a provider is safely connected.', 'بنجهّز مكافآت الإعلانات بشكل آمن. مش هتتضاف نقاط إلا بعد ربط شبكة الإعلانات والتحقق من المكافآت.')}
          </p>
          <button type="button" className="evads-cta" disabled={opening || (user && !enabled)} onClick={openOfferwall}>
            {opening ? t('Opening…', 'جارٍ الفتح…') : !user ? t('Log in to earn', 'سجّل دخول لجمع النقاط') : enabled ? t('Browse rewarded ads', 'عرض الإعلانات والعروض') : t('Ads not available yet', 'الإعلانات غير متاحة حاليًا')}
            <ExternalLink size={17} />
          </button>
          <div className="evads-safety"><ShieldCheck size={17} /> {t('No auto-rewards. Verified server callbacks only.', 'النقاط بتتضاف بعد التحقق من السيرفر فقط، مش بمجرد الضغط.')}</div>
        </div>
        <div className="evads-side">
          <h3>{t('How it works', 'إزاي تجمع النقاط؟')}</h3>
          <div className="evads-step"><span>01</span><div><strong>{t('Sign in', 'سجّل دخولك')}</strong><p>{t('Your points are linked to your account.', 'النقاط هتتسجل على حسابك الشخصي.')}</p></div></div>
          <div className="evads-step"><span>02</span><div><strong>{t('Choose an eligible ad', 'اختار إعلان مؤهل')}</strong><p>{t('Participate voluntarily. Some offers may involve a task.', 'المشاركة اختيارية، وبعض العروض ممكن تحتاج مهمة إضافية.')}</p></div></div>
          <div className="evads-step"><span>03</span><div><strong>{t('Get verified points', 'استلم نقاطك بعد التأكيد')}</strong><p>{t('Provider validation may take a short time.', 'تأكيد المكافأة من الشبكة ممكن ياخد بعض الوقت.')}</p></div></div>
        </div>
      </div>

      <div className="evads-history">
        <div className="evads-history-title"><h3>{t('Recent rewards', 'آخر مكافآت الإعلانات')}</h3><button type="button" onClick={refresh} disabled={loading}><RefreshCcw size={15} /> {loading ? t('Updating…', 'جارٍ التحديث…') : t('Refresh', 'تحديث')}</button></div>
        {!user ? <p>{t('Log in to view your reward history.', 'سجّل دخول علشان تشوف سجل المكافآت.')}</p> : history.length === 0
          ? <p>{t('No verified ad rewards yet.', 'مفيش مكافآت إعلانات مؤكدة لحد دلوقتي.')}</p>
          : <div className="evads-history-list">{history.slice(0, 8).map((entry) => <div className="evads-history-row" key={entry.transaction_id}><span>{entry.status === 'reversed' ? t('Reversed reward', 'مكافأة ملغية') : t('Verified reward', 'مكافأة مؤكدة')}<small>{entry.created_at ? new Date(entry.created_at).toLocaleString(ar ? 'ar-EG' : 'en-US') : ''}</small></span><b className={entry.status === 'reversed' ? 'evads-reversed' : ''}>{entry.status === 'reversed' ? '↩' : '+'}{entry.credited_to_wallet} {t('points', 'نقطة')}</b></div>)}</div>}
      </div>
      {message && <p className="evads-message" role="alert">{message}</p>}
    </section>
  );
}
