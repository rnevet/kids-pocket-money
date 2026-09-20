import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppError } from '../../google/errors';
import { useApp } from '../../state/AppContext';
import { ErrorBanner } from '../components/Banners';
import { CurrencySelect } from '../components/CurrencySelect';
import { KidFields, emptyKid, validateKid } from './KidForm';

export function Setup({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const { actions, busy } = useApp();
  const [familyName, setFamilyName] = useState('');
  const [currency, setCurrency] = useState('ILS');
  const [kid, setKid] = useState(() => emptyKid('ILS'));
  const [error, setError] = useState<AppError | null>(null);
  const [kidError, setKidError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateKid(kid);
    if (!v.ok) return setKidError(v.error);
    setKidError(null);
    actions
      .createFamily({ familyName: familyName.trim(), defaultCurrency: currency }, v.value)
      .catch(setError);
  };

  return (
    <main className="app">
      <h1 style={{ marginBlockStart: '1.5rem' }}>{t('setup.title')}</h1>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="familyName">{t('setup.familyName')}</label>
          <input
            id="familyName"
            required
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="defaultCurrency">{t('setup.defaultCurrency')}</label>
          <CurrencySelect
            id="defaultCurrency"
            value={currency}
            onChange={(c) => {
              setCurrency(c);
              setKid((k) => ({ ...k, currency: c }));
            }}
          />
        </div>
        <h2>{t('setup.firstKid')}</h2>
        <KidFields value={kid} onChange={setKid} currencyLocked={false} error={kidError} />
        {error && <ErrorBanner error={error} />}
        <div className="button-row">
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            {t('app.cancel')}
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {t('setup.submit')}
          </button>
        </div>
      </form>
    </main>
  );
}
