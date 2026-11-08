import React, { useState } from 'react';
import { Globe2, KeyRound, Mail, Save, Settings2, ShieldCheck, X } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const COPY = {
  en: { eyebrow: 'ACCOUNT CONTROL', title: 'Settings', subtitle: 'Security, account details, and language preferences.', language: 'Interface language', account: 'Email address', currentPassword: 'Current password', newEmail: 'New email address', updateEmail: 'Update email', password: 'Password', newPassword: 'New password', confirmPassword: 'Confirm new password', updatePassword: 'Change password', passwordHint: 'Use at least 8 characters. Your current password is required for changes.', close: 'Close', savedEmail: 'Email address updated.', savedPassword: 'Password changed. Keep your new password private.', errorEmail: 'Could not update your email.', errorPassword: 'Could not change your password.', mismatch: 'The new passwords do not match.', languageHelp: 'The new marketplace sections and settings will follow this preference; some existing copy may remain in English.', english: 'English', arabic: 'العربية', spanish: 'Español' },
  ar: { eyebrow: 'إعدادات الحساب', title: 'الإعدادات', subtitle: 'الأمان وبيانات الحساب وتفضيلات اللغة.', language: 'لغة الواجهة', account: 'البريد الإلكتروني', currentPassword: 'كلمة المرور الحالية', newEmail: 'البريد الإلكتروني الجديد', updateEmail: 'تحديث البريد', password: 'كلمة المرور', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور الجديدة', updatePassword: 'تغيير كلمة المرور', passwordHint: 'استخدم 8 أحرف على الأقل. نحتاج كلمة المرور الحالية لتأكيد التغيير.', close: 'إغلاق', savedEmail: 'تم تحديث البريد الإلكتروني.', savedPassword: 'تم تغيير كلمة المرور. احتفظ بها بشكل آمن.', errorEmail: 'تعذر تحديث البريد الإلكتروني.', errorPassword: 'تعذر تغيير كلمة المرور.', mismatch: 'كلمتا المرور الجديدتان غير متطابقتين.', languageHelp: 'سيتم تطبيق اللغة على الواجهة الرئيسية وأقسام المتجر والأدوات المدعومة.', english: 'English', arabic: 'العربية', spanish: 'Español' },
  es: { eyebrow: 'CONTROL DE CUENTA', title: 'Configuración', subtitle: 'Seguridad, datos de cuenta y preferencias de idioma.', language: 'Idioma de la interfaz', account: 'Correo electrónico', currentPassword: 'Contraseña actual', newEmail: 'Nuevo correo electrónico', updateEmail: 'Actualizar correo', password: 'Contraseña', newPassword: 'Nueva contraseña', confirmPassword: 'Confirmar contraseña', updatePassword: 'Cambiar contraseña', passwordHint: 'Usa al menos 8 caracteres. Se requiere la contraseña actual.', close: 'Cerrar', savedEmail: 'Correo actualizado.', savedPassword: 'Contraseña cambiada. Mantén tu contraseña segura.', errorEmail: 'No se pudo actualizar el correo.', errorPassword: 'No se pudo cambiar la contraseña.', mismatch: 'Las contraseñas nuevas no coinciden.', languageHelp: 'Las nuevas secciones y ajustes usarán esta preferencia; parte del texto existente puede seguir en inglés.', english: 'English', arabic: 'العربية', spanish: 'Español' },
};

async function request(url, token, body) {
  const response = await fetch(`${API_URL}${url}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export default function AccountSettings({ open, onClose, user, language = 'en', onLanguageChange, onUserUpdate, onNotice }) {
  const t = COPY[language] || COPY.en;
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  if (!open) return null;
  const token = () => localStorage.getItem('editvault_token');

  const submitEmail = async (event) => {
    event.preventDefault(); setEmailBusy(true); setEmailError('');
    try {
      const data = await request('/api/account-settings/email', token(), { currentPassword: emailPassword, email: newEmail.trim() });
      const updated = data.user || { email: newEmail.trim() };
      onUserUpdate?.(updated);
      setEmailPassword(''); setNewEmail('');
      onNotice?.(data.message || t.savedEmail);
    } catch (error) { setEmailError(error.message || t.errorEmail); }
    finally { setEmailBusy(false); }
  };

  const submitPassword = async (event) => {
    event.preventDefault(); setPasswordError('');
    if (passwordNew !== passwordConfirm) { setPasswordError(t.mismatch); return; }
    setPasswordBusy(true);
    try {
      const data = await request('/api/account-settings/password', token(), { currentPassword: passwordCurrent, newPassword: passwordNew });
      setPasswordCurrent(''); setPasswordNew(''); setPasswordConfirm('');
      onNotice?.(data.message || t.savedPassword);
    } catch (error) { setPasswordError(error.message || t.errorPassword); }
    finally { setPasswordBusy(false); }
  };

  return (
    <div className="evx-settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="evx-settings-modal" role="dialog" aria-modal="true" aria-label={t.title} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <header className="evx-settings-head"><span className="evx-settings-icon"><Settings2 size={20}/></span><div><span className="eyebrow">{t.eyebrow}</span><h2>{t.title}</h2><p>{t.subtitle}</p></div><button className="evx-settings-close" type="button" onClick={onClose} aria-label={t.close}><X size={18}/></button></header>
        <div className="evx-settings-language"><div className="evx-settings-row-icon"><Globe2 size={18}/></div><div className="evx-settings-language-copy"><strong>{t.language}</strong><small>{t.languageHelp}</small></div><select value={language} onChange={(event) => onLanguageChange?.(event.target.value)} aria-label={t.language}><option value="en">{t.english}</option><option value="ar">{t.arabic}</option><option value="es">{t.spanish}</option></select></div>
        {user ? <>
          <section className="evx-settings-section"><div className="evx-settings-section-title"><Mail size={17}/><h3>{t.account}</h3></div><p className="evx-settings-current-email">{user.email || '—'}</p><form onSubmit={submitEmail} className="evx-settings-form"><label>{t.newEmail}<input type="email" required autoComplete="email" maxLength={254} value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} placeholder="name@example.com"/></label><label>{t.currentPassword}<input type="password" required autoComplete="current-password" value={emailPassword} onChange={(e)=>setEmailPassword(e.target.value)}/></label>{emailError && <p className="evx-settings-error" role="alert">{emailError}</p>}<button className="evx-action-btn" type="submit" disabled={emailBusy || !newEmail.trim() || !emailPassword}>{emailBusy ? 'Saving…' : t.updateEmail}<Save size={15}/></button></form></section>
          <section className="evx-settings-section"><div className="evx-settings-section-title"><KeyRound size={17}/><h3>{t.password}</h3></div><p className="evx-settings-hint"><ShieldCheck size={14}/>{t.passwordHint}</p><form onSubmit={submitPassword} className="evx-settings-form"><label>{t.currentPassword}<input type="password" required autoComplete="current-password" value={passwordCurrent} onChange={(e)=>setPasswordCurrent(e.target.value)}/></label><label>{t.newPassword}<input type="password" required minLength={8} autoComplete="new-password" value={passwordNew} onChange={(e)=>setPasswordNew(e.target.value)}/></label><label>{t.confirmPassword}<input type="password" required minLength={8} autoComplete="new-password" value={passwordConfirm} onChange={(e)=>setPasswordConfirm(e.target.value)}/></label>{passwordError && <p className="evx-settings-error" role="alert">{passwordError}</p>}<button className="evx-action-btn" type="submit" disabled={passwordBusy || !passwordCurrent || passwordNew.length < 8 || !passwordConfirm}>{passwordBusy ? 'Saving…' : t.updatePassword}<Save size={15}/></button></form></section>
        </> : <div className="evx-settings-guest"><ShieldCheck size={22}/><strong>Marketplace preferences</strong><p>You can change the interface language without an account. Sign in to change your email or password.</p></div>}
        <footer className="evx-settings-footer"><span>EDIT<span>VAULT</span> · YOUR ACCOUNT, YOUR CONTROL</span><button type="button" onClick={onClose}>{t.close}</button></footer>
      </section>
    </div>
  );
}
