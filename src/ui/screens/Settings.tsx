import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Permission, ShareRole } from '../../google/drive';
import type { AppError } from '../../google/errors';
import { LANGUAGES, getLanguagePref, setLanguagePref, type LanguagePref } from '../../i18n';
import { useFamily } from '../../state/AppContext';
import { sheetUrl } from '../../state/session';
import { getThemePref, setThemePref, type ThemePref } from '../../theme/theme';
import { ErrorBanner } from '../components/Banners';
import { CurrencySelect } from '../components/CurrencySelect';
import { TopBar } from '../components/TopBar';

function FamilySection() {
  const { t } = useTranslation();
  const { family, actions, busy, isParent } = useFamily();
  const [name, setName] = useState(family.settings.familyName);
  const [currency, setCurrency] = useState(family.settings.defaultCurrency);
  const [error, setError] = useState<AppError | null>(null);
  const dirty =
    name.trim() !== family.settings.familyName || currency !== family.settings.defaultCurrency;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    actions.updateSettings({ familyName: name.trim(), defaultCurrency: currency }).catch(setError);
  };
  return (
    <form className="section" onSubmit={save}>
      <h2>{t('settings.family')}</h2>
      <div className="field">
        <label htmlFor="sFamilyName">{t('settings.familyName')}</label>
        <input
          id="sFamilyName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isParent}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="sCurrency">{t('settings.defaultCurrency')}</label>
        <CurrencySelect
          id="sCurrency"
          value={currency}
          onChange={setCurrency}
          disabled={!isParent}
        />
      </div>
      {error && <ErrorBanner error={error} />}
      {isParent && (
        <button type="submit" className="button button--primary" disabled={!dirty || busy}>
          {t('app.save')}
        </button>
      )}
    </form>
  );
}

function MembersSection() {
  const { t } = useTranslation();
  const { actions, file, user } = useFamily();
  const canShare = Boolean(file.capabilities?.canShare);
  const [members, setMembers] = useState<Permission[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('reader');
  const [error, setError] = useState<AppError | null>(null);
  const [working, setWorking] = useState(false);
  const [justInvited, setJustInvited] = useState<string | null>(null);

  const load = () => actions.listMembers().then(setMembers).catch(setError);
  useEffect(() => {
    if (canShare) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShare]);

  if (!canShare) return null;

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    const target = email.trim();
    actions
      .invite(target, role)
      .then(() => {
        setEmail('');
        setJustInvited(target);
        return load();
      })
      .catch(setError)
      .finally(() => setWorking(false));
  };
  const remove = (p: Permission) => {
    setWorking(true);
    actions
      .removeMember(p.id)
      .then(load)
      .catch(setError)
      .finally(() => setWorking(false));
  };

  return (
    <section className="section">
      <h2>{t('settings.members')}</h2>
      <p className="muted small">{t('settings.membersHint')}</p>
      <ul className="list">
        {(members ?? []).map((p) => (
          <li key={p.id} className="row">
            <div className="row__main">
              <p className="row__title">{p.emailAddress ?? p.displayName ?? p.type}</p>
              <p className="row__sub">{t(`settings.role_${p.role}`, { defaultValue: p.role })}</p>
            </div>
            {p.role !== 'owner' && p.emailAddress !== user.emailAddress && (
              <button
                type="button"
                className="button button--danger"
                onClick={() => remove(p)}
                disabled={working}
              >
                {t('app.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={invite} style={{ marginBlockStart: '1rem' }}>
        <div className="field">
          <label htmlFor="inviteEmail">{t('settings.email')}</label>
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="inviteRole">{t('settings.role')}</label>
          <select
            id="inviteRole"
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
          >
            <option value="writer">{t('settings.role_writer')}</option>
            <option value="reader">{t('settings.role_reader')}</option>
          </select>
        </div>
        {error && <ErrorBanner error={error} />}
        <button type="submit" className="button button--primary" disabled={working}>
          {t('settings.invite')}
        </button>
      </form>
      <InviteLink highlight={justInvited} />
    </section>
  );
}

function InviteLink({ highlight }: { highlight: string | null }) {
  const { t } = useTranslation();
  const { actions } = useFamily();
  const [copied, setCopied] = useState(false);
  const url = actions.inviteLink();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the input below is selectable */
    }
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      await navigator
        .share({ title: t('app.name'), text: t('settings.shareText', { url }), url })
        .catch(() => undefined);
    } else {
      await copy();
    }
  };
  return (
    <div className="field" style={{ marginBlockStart: '1rem' }}>
      <label htmlFor="inviteLink">{t('settings.inviteLink')}</label>
      {highlight && (
        <p className="banner banner--warning small">
          {t('settings.invited', { email: highlight })}
        </p>
      )}
      <input
        id="inviteLink"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        dir="ltr"
      />
      <span className="field__hint">{t('settings.inviteLinkHint')}</span>
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={() => void share()}>
          {t('settings.share')}
        </button>
        <button type="button" className="button" onClick={() => void copy()}>
          {copied ? t('settings.copied') : t('settings.copyLink')}
        </button>
      </div>
    </div>
  );
}

function PreferencesSection() {
  const { t } = useTranslation();
  const [lang, setLang] = useState<LanguagePref>(getLanguagePref);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  return (
    <section className="section">
      <div className="field">
        <label htmlFor="sLang">{t('settings.language')}</label>
        <select
          id="sLang"
          value={lang}
          onChange={(e) => {
            const v = e.target.value as LanguagePref;
            setLang(v);
            void setLanguagePref(v);
          }}
        >
          <option value="system">{t('settings.lang_system')}</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sTheme">{t('settings.theme')}</label>
        <select
          id="sTheme"
          value={theme}
          onChange={(e) => {
            const v = e.target.value as ThemePref;
            setTheme(v);
            setThemePref(v);
          }}
        >
          <option value="system">{t('settings.theme_system')}</option>
          <option value="light">{t('settings.theme_light')}</option>
          <option value="dark">{t('settings.theme_dark')}</option>
        </select>
      </div>
    </section>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const { family, user, isParent, actions } = useFamily();
  return (
    <main className="app">
      <TopBar title={t('settings.title')} back="/" />
      {!isParent && <p className="banner banner--warning">{t('settings.readOnly')}</p>}
      <FamilySection />
      <MembersSection />
      <PreferencesSection />
      <section className="section stack">
        <a className="button" href={sheetUrl(family.fileId)} target="_blank" rel="noreferrer">
          {t('settings.openSheet')}
        </a>
        <button type="button" className="button" onClick={() => actions.switchFamily()}>
          {t('bootstrap.switch')}
        </button>
        <p className="muted small center">
          {t('settings.signedInAs', { email: user.emailAddress })}
        </p>
        <button
          type="button"
          className="button button--danger"
          onClick={() => void actions.signOut()}
        >
          {t('settings.signOut')}
        </button>
      </section>
    </main>
  );
}
