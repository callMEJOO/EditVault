import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, X, Send, ChevronRight, RotateCcw, Search, ArrowUpRight, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react';
import { FAQ, CATEGORIES, matchFaq } from './knowledge.js';
import './guide.css';

const CHAT_KEY = 'editvault_guide_chat_v1';
const PREFS_KEY = 'editvault_guide_feedback_v1';
const readLanguage = () => {
  try { return window.localStorage.getItem('editvault_language') === 'en' ? 'en' : 'ar'; }
  catch { return 'ar'; }
};
const translate = (ar, en, lang) => lang === 'ar' ? ar : en;
const getFaq = id => FAQ.find(item => item.id === id);
const loadMessages = () => {
  try {
    const data = JSON.parse(window.localStorage.getItem(CHAT_KEY) || '[]');
    return Array.isArray(data) ? data.filter(m => ['user', 'assistant'].includes(m.role) && typeof m.text === 'string').slice(-28) : [];
  } catch { return []; }
};
const escapeLimit = (s, length = 500) => String(s || '').trim().slice(0, length);

export default function EditVaultGuide() {
  const [language, setLanguage] = useState(readLanguage);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState('start');
  const [messages, setMessages] = useState(loadMessages);
  const [typing, setTyping] = useState(false);
  const [feedback, setFeedback] = useState({});
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(null);
  const lang = language === 'en' ? 'en' : 'ar';
  const t = (ar, en) => translate(ar, en, lang);

  useEffect(() => {
    const updateLang = () => setLanguage(readLanguage());
    const observer = new MutationObserver(updateLang);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
    window.addEventListener('storage', updateLang);
    return () => { observer.disconnect(); window.removeEventListener('storage', updateLang); };
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-28))); } catch { /* Storage disabled */ }
  }, [messages]);
  useEffect(() => { if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, typing, open]);
  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(timer.current); };
  }, []);

  const categoryFaqs = useMemo(() => FAQ.filter(item => item.category === category).slice(0, 8), [category]);
  const prompts = useMemo(() => ['ev-27', 'ev-76', 'ev-54', 'ev-45'].map(getFaq).filter(Boolean), []);

  const respond = (question, itemOverride) => {
    const value = escapeLimit(question);
    if (!value || typing) return;
    setDraft('');
    const top = itemOverride ? { item: itemOverride, score: 1 } : matchFaq(value, 4)[0];
    const candidates = itemOverride ? [] : matchFaq(value, 4);
    const exact = Boolean(top && (top.score >= 0.66 || (top.score >= 0.56 && (top.score - (candidates[1]?.score || 0)) >= 0.13)));
    const chosen = itemOverride || (exact ? top.item : null);
    const suggestions = (chosen ? [] : candidates.slice(0, 3).map(c => c.item.id));
    const reply = chosen ? chosen.answer[lang] : t(
      'مش عايز أديك معلومة غلط 💚 اختار أقرب سؤال من الاقتراحات، أو جرّب تكتب السؤال بطريقة تانية. لو المشكلة تقنية، ابعت التفاصيل للدعم من غير بيانات سرية.',
      'I don’t want to guess 💚 Pick a suggested topic, or rephrase your question. For technical issues, contact support without sharing secrets.'
    );
    setMessages(old => [...old, { role: 'user', text: value, id: `u-${Date.now()}` }].slice(-28));
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setMessages(old => [...old, { role: 'assistant', text: reply, faqId: chosen?.id, suggestions, path: chosen?.path || '', id: `b-${Date.now()}` }].slice(-28));
      setTyping(false);
    }, 420);
  };

  const registerFeedback = (faqId, helpful) => {
    const key = faqId || 'unknown';
    setFeedback(old => ({ ...old, [key]: helpful }));
    try {
      const ratings = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      ratings[key] = helpful; localStorage.setItem(PREFS_KEY, JSON.stringify(ratings));
    } catch { /* Ignore private mode */ }
  };

  const reset = () => {
    clearTimeout(timer.current); setTyping(false); setMessages([]);
    try { localStorage.removeItem(CHAT_KEY); } catch { /* Ignore */ }
  };

  return (
    <div className={`ev-guide-root ${lang === 'ar' ? 'is-ar' : 'is-en'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {!open && (
        <button type="button" className="ev-guide-launch" onClick={() => setOpen(true)} aria-label={t('افتح مساعد EditVault', 'Open EditVault help assistant')}>
          <span className="ev-guide-orb"><Bot size={23} strokeWidth={2.2} /></span>
          <span className="ev-guide-launch-copy"><b>{t('محتاج مساعدة؟', 'Need help?')}</b><small>{t('اسأل JOO Guide', 'Ask JOO Guide')}</small></span>
          <span className="ev-guide-online" aria-hidden="true" />
        </button>
      )}
      {open && (
        <section className="ev-guide-panel" aria-label={t('مساعد EditVault', 'EditVault assistant')}>
          <header className="ev-guide-head">
            <div className="ev-guide-head-avatar"><Bot size={24} /></div>
            <div className="ev-guide-head-content">
              <strong>JOO GUIDE <span className="ev-guide-pill">EDITVAULT</span></strong>
              <span>{t('دليلك السريع لكل حاجة في الموقع', 'Your EditVault help companion')}</span>
            </div>
            <button type="button" className="ev-guide-close" onClick={() => setOpen(false)} title={t('إغلاق', 'Close')} aria-label={t('إغلاق', 'Close')}><X size={20}/></button>
          </header>
          <div className="ev-guide-body" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ev-guide-welcome">
                <div className="ev-guide-welcome-badge"><Sparkles size={24} /></div>
                <h2>{t('أهلاً بيك في EditVault 👋', 'Welcome to EditVault 👋')}</h2>
                <p>{t('مش لازم تكون محترف. اسألني عن النقاط، المونتاج، التحميل، أو أي قسم في الموقع.', 'New here? Ask about points, video tools, downloads, or anything on the site.')}</p>
                <div className="ev-guide-chips">
                  {prompts.map(item => <button type="button" key={item.id} onClick={() => respond(item.question[lang], item)}>{item.question[lang]} <ChevronRight size={13}/></button>)}
                </div>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`ev-guide-msg ${m.role}`}>
                {m.role === 'assistant' && <span className="ev-guide-mini-avatar"><Bot size={14} /></span>}
                <div className="ev-guide-msg-details">
                  <div className="ev-guide-bubble">{m.text}</div>
                  {m.role === 'assistant' && m.path && (
                    <a className="ev-guide-action" href={m.path} onClick={() => setOpen(false)}>{t('روح للقسم', 'Go to section')} <ArrowUpRight size={13} /></a>
                  )}
                  {m.role === 'assistant' && m.suggestions?.length > 0 && (
                    <div className="ev-guide-suggestions">{m.suggestions.map(id => {
                      const item = getFaq(id); return item ? <button type="button" key={id} onClick={() => respond(item.question[lang], item)}>{item.question[lang]}</button> : null;
                    })}</div>
                  )}
                  {m.role === 'assistant' && m.faqId && (
                    <div className="ev-guide-feedback">
                      <span>{t('الإجابة ساعدتك؟', 'Was this helpful?')}</span>
                      <button type="button" className={feedback[m.faqId] === true ? 'active' : ''} onClick={() => registerFeedback(m.faqId, true)} aria-label={t('نعم', 'Yes')}><ThumbsUp size={13}/></button>
                      <button type="button" className={feedback[m.faqId] === false ? 'active' : ''} onClick={() => registerFeedback(m.faqId, false)} aria-label={t('لا', 'No')}><ThumbsDown size={13}/></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && <div className="ev-guide-msg assistant"><span className="ev-guide-mini-avatar"><Bot size={14}/></span><div className="ev-guide-bubble ev-guide-typing"><span/><span/><span/></div></div>}
          </div>
          <div className="ev-guide-discover">
            <div className="ev-guide-discover-title">
              <span><Search size={14}/> {t('تصفح الأسئلة', 'Browse questions')} <small>{FAQ.length} FAQ</small></span>
              <button type="button" onClick={reset} title={t('محادثة جديدة', 'New chat')} aria-label={t('محادثة جديدة', 'New chat')}><RotateCcw size={15}/></button>
            </div>
            <div className="ev-guide-catrow" role="group" aria-label={t('أقسام المساعدة', 'Help categories')}>
              {CATEGORIES.map(c => <button type="button" key={c.id} className={category === c.id ? 'selected' : ''} onClick={() => { setCategory(c.id); }}>{c.emoji} {c[lang]}</button>)}
            </div>
            <div className="ev-guide-questions">{categoryFaqs.slice(0, 4).map(item => <button type="button" key={item.id} onClick={() => respond(item.question[lang], item)}>{item.question[lang]} <ChevronRight size={14}/></button>)}</div>
          </div>
          <form className="ev-guide-inputbox" onSubmit={event => { event.preventDefault(); respond(draft); }}>
            <input ref={inputRef} type="text" autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('اكتب سؤالك هنا...', 'Ask your question...')} maxLength={500} aria-label={t('سؤالك', 'Your question')} />
            <button type="submit" disabled={!draft.trim() || typing} aria-label={t('إرسال', 'Send')}><Send size={18}/></button>
          </form>
          <div className="ev-guide-disclaimer">{t('مساعد من قاعدة معرفة EditVault • لا يطّلع على بيانات حسابك', 'EditVault knowledge-base assistant • No access to your account')}</div>
        </section>
      )}
    </div>
  );
}
