import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import type { AppError } from '../../google/errors';
import { ErrorBanner } from '../components/Banners';
import { Icon, Logo, type IconName } from '../components/Icon';

const REPO_URL = 'https://github.com/rnevet/kids-pocket-money';

const POINTS: { icon: IconName; key: string }[] = [
  { icon: 'gift', key: 'bank' },
  { icon: 'calendar', key: 'goal' },
  { icon: 'sliders', key: 'sheet' },
];

export function SignIn({ expired }: { expired: boolean }) {
  const { t, i18n } = useTranslation();
  const { actions, busy } = useApp();
  const [error, setError] = useState<AppError | null>(null);
  const lang = i18n.language === 'he' ? 'he' : 'en';
  const click = () => {
    setError(null);
    actions.signIn().catch((e: AppError) => e.kind !== 'cancelled' && setError(e));
  };
  const button = (
    <button
      type="button"
      className="button button--primary button--block"
      onClick={click}
      disabled={busy}
    >
      {expired ? t('signin.again') : t('signin.button')}
    </button>
  );
  return (
    <main className="app landing">
      <section className="landing__hero">
        <Logo size={72} />
        <h1 className="landing__title">{t('signin.title')}</h1>
        <p className="landing__tagline">{t('signin.tagline')}</p>
        {expired && <p className="small">{t('signin.expired')}</p>}
        {error && <ErrorBanner error={error} />}
        {button}
        <p className="landing__note">{t('signin.permission')}</p>
      </section>

      <section className="landing__shots" aria-label={t('signin.samplesLabel')}>
        <img
          src={`/samples/home-${lang}.png`}
          width="390"
          height="760"
          alt={t('signin.sampleHome')}
          loading="lazy"
        />
        <img
          src={`/samples/kid-${lang}.png`}
          width="390"
          height="760"
          alt={t('signin.sampleKid')}
          loading="lazy"
        />
      </section>

      <section className="landing__points">
        {POINTS.map((p) => (
          <div key={p.key} className="landing__point">
            <div className="tile tile--got">
              <Icon name={p.icon} size={18} />
            </div>
            <div>
              <h2>{t(`signin.${p.key}Title`)}</h2>
              <p>{t(`signin.${p.key}Body`)}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="landing__links small muted">
        <a href="/privacy/">{t('settings.privacy')}</a>
        <span aria-hidden="true">·</span>
        <a href="/terms/">{t('settings.terms')}</a>
        <span aria-hidden="true">·</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {t('signin.source')}
        </a>
      </p>
    </main>
  );
}
