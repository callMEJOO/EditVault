import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote,
  CalendarDays, Check, Clock3, Coins, CreditCard, History,
  LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Wallet, Zap,
} from 'lucide-react';
import './creator-withdrawals.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const PAYOUT_METHODS = [
  { key: 'Vodafone Cash', label: 'Vodafone Cash', short: 'VC', detailAr: 'محفظة إلكترونية', detailEn: 'Mobile wallet', tone: 'red' },
  { key: 'InstaPay', label: 'InstaPay', short: 'IP', detailAr: 'تحويل بنكي فوري', detailEn: 'Instant bank transfer', tone: 'purple' },
  { key: 'PayPal', label: 'PayPal', short: 'PP', detailAr: 'محفظة دولية', detailEn: 'International wallet', tone: 'blue' },
];

function useMotionPreference() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

// A React-driven count-up with an RAF cleanup, instead of just a CSS number animation.
function useCountUp(target, reducedMotion) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const destination = Number.isFinite(Number(target)) ? Math.max(0, Number(target)) : 0;
    if (reducedMotion) { setValue(destination); return undefined; }
    let frame;
    const start = performance.now();
    const duration = 1100;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(destination * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);
  return value;
}

export default function CreatorWithdrawals({ user, language = 'en', onLogin, onBack, onCreatorArea }) {
  const isArabic = language === 'ar';
  const tx = (en, ar) => isArabic ? ar : en;
  const reducedMotion = useMotionPreference();
  const creatorAccess = user?.role === 'creator' || user?.role === 'admin';
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('Vodafone Cash');
  const points = useCountUp(overview?.lifetimePoints || 0, reducedMotion);
  const sales = useCountUp(overview?.salesCount || 0, reducedMotion);
  const pointFormatter = new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-US', { maximumFractionDigits: 0 });
  const methodOptions = PAYOUT_METHODS.filter((method) => !overview?.methods || overview.methods.includes(method.key));

  useEffect(() => {
    if (!creatorAccess) { setOverview(null); setError(''); return undefined; }
    const token = localStorage.getItem('editvault_token');
    if (!token) { setError(tx('Please sign in to view this page.', 'سجّل دخولك لعرض الصفحة.')); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`${API_URL}/api/studio/withdrawals/overview`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
        return data;
      })
      .then((data) => { if (!controller.signal.aborted) setOverview(data); })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message || tx('Could not load earnings.', 'تعذر تحميل بيانات الأرباح.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  // Labels are not part of request lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorAccess, user?.id, refresh]);

  const returnAction = <button type="button" className="evw-back" onClick={onBack}>{isArabic ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}{tx('Back to Explore', 'العودة للاستكشاف')}</button>;
  if (!creatorAccess) {
    return (
      <section className="evw-root evw-gate" dir={isArabic ? 'rtl' : 'ltr'}>
        {returnAction}
        <div className="evw-gate-card">
          <span className="evw-gate-icon"><LockKeyhole size={30} /></span>
          <span className="evw-kicker">EDITVAULT / CREATOR FINANCE</span>
          <h1>{tx('Your creator earnings', 'أرباح المبدعين')}</h1>
          <p>{user ? tx('This section is available to approved creators only.', 'القسم ده مخصص للمبدعين المعتمدين فقط.') : tx('Sign in to view your private creator earnings page.', 'سجّل دخولك عشان تشوف صفحة أرباحك الخاصة.')}</p>
          <button className="evw-main-action" onClick={user ? onCreatorArea : onLogin}>{user ? tx('Become a creator', 'قدّم كمبدع') : tx('Log in', 'تسجيل الدخول')} <ArrowUpRight size={16} /></button>
        </div>
      </section>
    );
  }

  return (
    <section className="evw-root" dir={isArabic ? 'rtl' : 'ltr'} aria-labelledby="evw-page-title">
      <div className="evw-ambient evw-ambient-one" aria-hidden="true" />
      <div className="evw-ambient evw-ambient-two" aria-hidden="true" />

      <div className="evw-toolbar evw-reveal" style={{ '--reveal-delay': '0ms' }}>
        {returnAction}
        <button className="evw-refresh" type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'evw-spin' : ''} /> {tx('Refresh', 'تحديث')}
        </button>
      </div>

      <header className="evw-hero evw-reveal" style={{ '--reveal-delay': '60ms' }}>
        <div className="evw-hero-copy">
          <div className="evw-kicker"><Sparkles size={13} /> EDITVAULT / CREATOR FINANCE</div>
          <h1 id="evw-page-title">{tx('Your earnings.', 'أرباحك.')} <span>{tx('Your space.', 'مساحتك الخاصة.')}</span></h1>
          <p>{tx('A separate place to track the points earned from your work and preview upcoming payout methods.', 'مكان مستقل تتابع منه النقاط اللي كسبتها من شغلك، وتتعرف على طرق السحب المخطط لها.')}</p>
          <div className="evw-live-status"><span className="evw-status-dot" /><LockKeyhole size={14} />{tx('Withdrawals are not live yet', 'السحب غير متاح حاليًا')}</div>
        </div>
        <div className="evw-hero-art" aria-hidden="true">
          <div className="evw-art-ring evw-art-ring-a" />
          <div className="evw-art-ring evw-art-ring-b" />
          <div className="evw-art-card"><div className="evw-art-card-top"><Wallet size={20} /><span>EDITVAULT</span></div><div className="evw-art-lock"><LockKeyhole size={27} /></div><div className="evw-art-card-footer">PAYOUTS <span>SOON / 01</span></div></div>
          <span className="evw-art-spark evw-art-spark-a">✦</span><span className="evw-art-spark evw-art-spark-b">✧</span>
        </div>
      </header>

      {error && <div className="evw-error" role="alert"><ShieldCheck size={17} /><span>{error}</span><button type="button" onClick={() => setRefresh((n) => n + 1)}>{tx('Retry', 'إعادة المحاولة')}</button></div>}

      <div className="evw-stats" aria-busy={loading}>
        <article className="evw-stat evw-stat-primary evw-reveal" style={{ '--reveal-delay': '110ms' }}>
          <div className="evw-stat-header"><span>{tx('LIFETIME EDIT SALES', 'نقاط مبيعات الإيديتات')}</span><span className="evw-stat-icon"><Coins size={19}/></span></div>
          <strong className="evw-stat-value">{loading && !overview ? '···' : pointFormatter.format(points)} <small>PTS</small></strong>
          <p>{tx('Total points from all completed edit sales — not a cash balance.', 'إجمالي نقاط المبيعات المكتملة، وليست رصيدًا نقديًا.')}</p>
          <div className="evw-stat-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
        </article>
        <article className="evw-stat evw-reveal" style={{ '--reveal-delay': '170ms' }}>
          <div className="evw-stat-header"><span>{tx('COMPLETED SALES', 'المبيعات المكتملة')}</span><span className="evw-stat-icon"><Check size={19}/></span></div>
          <strong className="evw-stat-value">{loading && !overview ? '···' : pointFormatter.format(sales)}</strong>
          <p>{tx('Edits purchased by the community.', 'مرات شراء إيديتاتك من المجتمع.')}</p>
          <div className="evw-stat-foot"><BadgeCheck size={14} />{tx('From your creator catalog', 'من أعمالك المنشورة')}</div>
        </article>
        <article className="evw-stat evw-reveal" style={{ '--reveal-delay': '230ms' }}>
          <div className="evw-stat-header"><span>{tx('CASH AVAILABLE', 'الرصيد النقدي المتاح')}</span><span className="evw-stat-icon"><LockKeyhole size={19}/></span></div>
          <strong className="evw-stat-value evw-unavailable">—</strong>
          <p>{tx('No cash conversion or withdrawal service has been activated.', 'لم يتم تفعيل تحويل النقاط لأموال أو خدمة السحب بعد.')}</p>
          <div className="evw-stat-foot evw-foot-muted"><Clock3 size={14}/>{tx('Not enabled', 'غير مفعّل')}</div>
        </article>
      </div>

      <div className="evw-content-grid">
        <section className="evw-panel evw-reveal" style={{ '--reveal-delay': '260ms' }} aria-labelledby="evw-methods-heading">
          <div className="evw-panel-heading"><div><span className="evw-kicker">01 / {tx('PAYOUT OPTIONS', 'طرق السحب')}</span><h2 id="evw-methods-heading">{tx('Choose a method', 'اختر طريقة السحب')}</h2><p>{tx('Preview only. Payment details are not requested or stored.', 'للمعاينة فقط. مش بنطلب ولا بنخزّن بيانات السحب حاليًا.')}</p></div><CreditCard size={23}/></div>
          <div className="evw-methods">
            {methodOptions.map((method, index) => (
              <button className={`evw-method ${selected === method.key ? 'is-selected' : ''}`} style={{ '--method-index': index }} key={method.key} type="button" aria-pressed={selected === method.key} onClick={() => setSelected(method.key)}>
                <span className={`evw-method-logo evw-tone-${method.tone}`}>{method.short}</span>
                <span className="evw-method-text"><strong>{method.label}</strong><small>{isArabic ? method.detailAr : method.detailEn}</small></span>
                <span className="evw-method-choice">{selected === method.key ? <Check size={15}/> : <span/>}</span>
              </button>
            ))}
          </div>
          <div className="evw-lock-box"><LockKeyhole size={18}/><div><strong>{tx('Withdrawals are currently unavailable', 'السحب متوقف حاليًا')}</strong><p>{tx('You can explore the methods, but no withdrawal requests are accepted. No payout date has been announced.', 'تقدر تشوف الطرق المتاحة مستقبلًا، لكن مش بنقبل طلبات سحب دلوقتي، ومفيش موعد معلن للتفعيل.')}</p></div></div>
          <button className="evw-disabled-action" type="button" disabled aria-disabled="true"><LockKeyhole size={17}/>{tx('Withdrawals coming soon', 'السحب غير متاح حاليًا')}<ArrowUpRight size={17}/></button>
          <p className="evw-method-caption"><ShieldCheck size={14} />{tx('Your account details are never collected on this page.', 'مش هنطلب بيانات محفظتك أو حسابك البنكي قبل إطلاق الخدمة.')}</p>
        </section>

        <aside className="evw-right-column">
          <section className="evw-panel evw-reveal evw-timeline-panel" style={{ '--reveal-delay': '320ms' }}>
            <div className="evw-panel-heading"><div><span className="evw-kicker">02 / {tx('WHAT IS NEXT', 'الخطوات القادمة')}</span><h2>{tx('Payout roadmap', 'تجهيز نظام السحب')}</h2></div><Zap size={22}/></div>
            <ol className="evw-timeline">
              <li><span className="evw-timeline-node is-done"><Check size={13}/></span><div><strong>{tx('Earnings tracking', 'متابعة أرباح المبيعات')}</strong><p>{tx('Your completed edit sales are visible here.', 'بيانات نقاط مبيعاتك ظاهرة هنا.')}</p></div><span className="evw-step-state">{tx('Live', 'مفعّل')}</span></li>
              <li><span className="evw-timeline-node"><Clock3 size={13}/></span><div><strong>{tx('Payment integrations', 'تجهيز طرق الدفع')}</strong><p>{tx('Withdrawals will stay locked until integrations are ready.', 'السحب هيفضل مقفول لحد ما التجهيزات تكتمل.')}</p></div><span className="evw-step-state is-pending">{tx('Planned', 'مخطط')}</span></li>
              <li><span className="evw-timeline-node"><LockKeyhole size={13}/></span><div><strong>{tx('Withdrawal launch', 'إطلاق السحب')}</strong><p>{tx('Details and eligibility will be announced before launch.', 'هنوضح الشروط والتفاصيل قبل الإطلاق.')}</p></div><span className="evw-step-state is-pending">{tx('Locked', 'مغلق')}</span></li>
            </ol>
          </section>
          <section className="evw-panel evw-reveal evw-history" style={{ '--reveal-delay': '370ms' }}>
            <div className="evw-panel-heading"><div><span className="evw-kicker">03 / {tx('SALES ACTIVITY', 'حركة المبيعات')}</span><h2>{tx('Recent sales', 'آخر المبيعات')}</h2></div><History size={22}/></div>
            {loading && !overview ? <p className="evw-empty">{tx('Loading recent sales…', 'جارٍ تحميل أحدث المبيعات...')}</p> : (overview?.recentSales?.length ? (
              <ul className="evw-sales-list">{overview.recentSales.map((sale) => (
                <li key={sale.id}><span className="evw-sale-icon"><Banknote size={16}/></span><span className="evw-sale-title"><strong>{sale.title}</strong><small><CalendarDays size={12}/>{new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-US', { dateStyle: 'medium' }).format(new Date(sale.created_at))}</small></span><span className="evw-sale-points">+{pointFormatter.format(Number(sale.price_points) || 0)} PTS</span></li>
              ))}</ul>
            ) : <div className="evw-empty"><History size={24}/><strong>{tx('No sales yet', 'لسه مفيش مبيعات')}</strong><span>{tx('Once your edits sell, activity will appear here.', 'أول ما إيديتاتك تتباع، هتشوف التفاصيل هنا.')}</span></div>)}
          </section>
        </aside>
      </div>
      <footer className="evw-page-footer"><ShieldCheck size={15}/><span>{tx('EditVault will not initiate payouts, collect payout credentials, or convert points to money while this feature is disabled.', 'إيديت فولت مش بيحوّل النقاط لفلوس أو بيستقبل طلبات سحب أو بيانات دفع طول ما الخدمة مقفولة.')}</span></footer>
    </section>
  );
}
