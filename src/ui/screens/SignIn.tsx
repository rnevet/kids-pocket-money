import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import type { AppError } from '../../google/errors';
import { ErrorBanner } from '../components/Banners';

export function SignIn({ expired }: { expired: boolean }) {
  const { t } = useTranslation();
  const { actions, busy } = useApp();
  const [error, setError] = useState<AppError | null>(null);
  const click = () => {
    setError(null);
    actions.signIn().catch((e: AppError) => e.kind !== 'cancelled' && setError(e));
  };
  return (
    <main className="app hero">
      <div>
        <div className="hero__icon" aria-hidden="true">
          🐷
        </div>
        <h1>{t('signin.title')}</h1>
        <p className="muted">{t('signin.tagline')}</p>
        {expired && <p className="small">{t('signin.expired')}</p>}
        {error && <ErrorBanner error={error} />}
        <button type="button" className="button button--primary" onClick={click} disabled={busy}>
          {expired ? t('signin.again') : t('signin.button')}
        </button>
      </div>
    </main>
  );
}
