import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, CalendarDays, Copy, Link2, ShieldCheck, UserRound } from 'lucide-react';
import './community-profile.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function CommunityProfile({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [badges, setBadges] = useState([]);
  const isArabic = typeof window !== 'undefined' && window.localStorage.getItem('editvault_language') === 'ar';
  const tx = (en, ar) => isArabic ? ar : en;

  useEffect(() => {
    if (!username) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);
    setCopied(false);
    setBadges([]);
    fetch(`${API_URL}/api/community/badges/${encodeURIComponent(username)}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { badges: [] }).then(data => setBadges(data.badges || []))
      .catch(() => {});
    fetch(`${API_URL}/api/community/u/${encodeURIComponent(username)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load this profile.');
        return data.user;
      })
      .then(setProfile)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load profile.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [username]);

  if (!username) return null;
  const profileUrl = `${window.location.origin}/u/${encodeURIComponent(profile?.username || username)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(tx('Copy failed. Copy the profile address shown below.', 'تعذر النسخ تلقائيًا. انسخ رابط البروفايل الظاهر أدناه.'));
    }
  };

  return (
    <div className="ev-community-backdrop" role="dialog" aria-modal="true" aria-label={tx('Community profile', 'الملف الشخصي')}>
      <section className="ev-community-card">
        <header className="ev-community-topbar">
          <button type="button" className="ev-community-back" onClick={onClose}>
            <ArrowLeft size={16} /> {tx('Back to EditVault', 'العودة إلى EditVault')}
          </button>
          <span className="ev-community-brand"><span className="ev-community-brand-mark">E</span> EDIT<span className="ev-community-brand-accent">VAULT</span></span>
        </header>

        {loading ? (
          <div className="ev-community-state"><span className="ev-community-loader" />{tx('Loading profile…', 'جاري تحميل البروفايل…')}</div>
        ) : error && !profile ? (
          <div className="ev-community-state is-error">
            <div>{error}</div>
            <button type="button" onClick={onClose}>{tx('Close', 'إغلاق')}</button>
          </div>
        ) : profile && (
          <>
            <div className="ev-community-cover" aria-label={tx('Profile banner', 'غلاف البروفايل')}>
              {profile.cover_data_url ? (
                <>
                  <div className="ev-community-cover-blur" style={{ backgroundImage: `url("${profile.cover_data_url}")` }} />
                  <img className="ev-community-cover-image" src={profile.cover_data_url} alt={tx('Profile cover', 'غلاف البروفايل')} />
                </>
              ) : <div className="ev-community-cover-default" />}
              <span className="ev-community-cover-label">EDITVAULT COMMUNITY</span>
            </div>

            <div className="ev-community-profile-main">
              <div className="ev-community-avatar">
                {profile.avatar_data_url ? <img src={profile.avatar_data_url} alt={`${profile.display_name || profile.username} avatar`} /> : <UserRound size={38} />}
                {profile.role === 'creator' && profile.verification_status === 'verified' && <span className="ev-community-avatar-check"><BadgeCheck size={16} /></span>}
              </div>
              <div className="ev-community-identity">
                <div className="ev-community-names">
                  <h1>{profile.display_name || profile.username}</h1>
                  <div className="ev-community-handle">@{profile.username}</div>
                  {profile.role === 'creator' && profile.verification_status === 'verified' && (
                    <span className="ev-community-verified"><BadgeCheck size={14} /> {tx('Verified creator', 'مبدع موثّق')}</span>
                  )}
                </div>
                <div className="ev-profile-badges">
                  {(profile.role === 'creator' || profile.role === 'admin') && <span className="ev-profile-badge">🎬 {tx('Creator', 'مبدع')}</span>}
                  {badges.map(key => {
                    const labels = {
                      top_creator: ['⭐ Top Creator', '⭐ مبدع متميز'],
                      popular: ['🔥 Popular', '🔥 مشهور'],
                      early_supporter: ['🏆 Early Supporter', '🏆 من أوائل الداعمين'],
                      vip: ['💎 VIP', '💎 عضو مميز'],
                    };
                    return labels[key] ? <span className="ev-profile-badge" key={key}>{tx(...labels[key])}</span> : null;
                  })}
                </div>
                <div className="ev-community-actions">
                  <button type="button" className="ev-community-action-primary" onClick={copyLink}>
                    <Copy size={15} /> {copied ? tx('Link copied', 'تم نسخ الرابط') : tx('Copy profile link', 'نسخ رابط البروفايل')}
                  </button>
                </div>
              </div>
            </div>

            <div className="ev-community-divider" />
            <div className="ev-community-content">
              <section className="ev-community-about">
                <div className="ev-community-section-heading">{tx('About me', 'نبذة عني')}</div>
                <p className="ev-community-bio">{profile.bio?.trim() || tx('This member has not added a bio yet.', 'هذا المستخدم لم يضف نبذة شخصية بعد.')}</p>
              </section>
              <aside className="ev-community-info">
                <div className="ev-community-info-title">{tx('Member information', 'معلومات العضو')}</div>
                <div className="ev-community-info-row">
                  <CalendarDays size={16} />
                  <span><strong>{tx('Member since', 'عضو منذ')}</strong><small>{profile.created_at ? new Date(profile.created_at).toLocaleDateString(isArabic ? 'ar-EG' : undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : tx('EditVault member', 'عضو في EditVault')}</small></span>
                </div>
                <div className="ev-community-info-row">
                  <ShieldCheck size={16} />
                  <span><strong>{tx('Profile', 'حالة البروفايل')}</strong><small>{tx('Public profile', 'بروفايل عام')}</small></span>
                </div>
                <div className="ev-community-url-block">
                  <div><Link2 size={14} /> {tx('Profile link', 'رابط البروفايل')}</div>
                  <code>{profileUrl}</code>
                  <button type="button" onClick={copyLink}>{copied ? tx('Copied!', 'تم النسخ!') : tx('Copy link', 'نسخ الرابط')}</button>
                </div>
              </aside>
            </div>
            {error && <p className="ev-community-inline-error" role="status">{error}</p>}
            <footer className="ev-community-footer"><span>{tx('Your space in the EditVault community.', 'مساحتك في مجتمع EditVault.')}</span><span>EDITVAULT · COMMUNITY</span></footer>
          </>
        )}
      </section>
    </div>
  );
}
