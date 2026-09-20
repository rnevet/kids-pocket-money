import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { daysBetween, todayIso } from '../../domain/dates';
import { parseUserAmount, formatAmountCell } from '../../domain/money';
import type { Frequency } from '../../domain/allowance';
import type { AppError } from '../../google/errors';
import { useFamily, type KidInput } from '../../state/AppContext';
import { ErrorBanner } from '../components/Banners';
import { CurrencySelect } from '../components/CurrencySelect';
import { EmojiPicker } from '../components/EmojiPicker';
import { TopBar } from '../components/TopBar';

export interface KidDraft {
  name: string;
  avatar: string;
  currency: string;
  allowanceAmount: string;
  allowanceFrequency: Frequency;
  allowanceDay: number;
  startDate: string;
  archived: boolean;
}

export function emptyKid(currency: string): KidDraft {
  return {
    name: '',
    avatar: '🦊',
    currency,
    allowanceAmount: '0',
    allowanceFrequency: 'weekly',
    allowanceDay: 5,
    startDate: todayIso(),
    archived: false,
  };
}

export function draftFromKid(k: KidInput): KidDraft {
  return { ...k, allowanceAmount: formatAmountCell(k.allowanceAmount) };
}

export function validateKid(
  d: KidDraft,
): { ok: true; value: KidInput } | { ok: false; error: string } {
  if (!d.name.trim()) return { ok: false, error: 'kidForm.nameRequired' };
  const amount = parseUserAmount(d.allowanceAmount || '0');
  if (amount === null || amount < 0) return { ok: false, error: 'tx.invalidAmount' };
  const day =
    d.allowanceFrequency === 'monthly'
      ? Math.min(28, Math.max(1, d.allowanceDay))
      : Math.min(6, Math.max(0, d.allowanceDay));
  return {
    ok: true,
    value: {
      name: d.name.trim(),
      avatar: d.avatar,
      currency: d.currency,
      allowanceAmount: amount,
      allowanceFrequency: d.allowanceFrequency,
      allowanceDay: day,
      startDate: d.startDate,
      archived: d.archived,
    },
  };
}

export function KidFields({
  value,
  onChange,
  currencyLocked,
  error,
  showArchive = false,
}: {
  value: KidDraft;
  onChange: (d: KidDraft) => void;
  currencyLocked: boolean;
  error: string | null;
  showArchive?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const set = <K extends keyof KidDraft>(k: K, v: KidDraft[K]) => onChange({ ...value, [k]: v });
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    d,
    label: new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(
      new Date(2026, 8, 20 + d),
    ),
  }));
  return (
    <>
      <div className="field">
        <label htmlFor="kidName">{t('kidForm.name')}</label>
        <input
          id="kidName"
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
      </div>
      <div className="field">
        <span className="field__label">{t('kidForm.avatar')}</span>
        <EmojiPicker value={value.avatar} onChange={(v) => set('avatar', v)} />
      </div>
      <div className="field">
        <label htmlFor="kidCurrency">{t('kidForm.currency')}</label>
        <CurrencySelect
          id="kidCurrency"
          value={value.currency}
          onChange={(v) => set('currency', v)}
          disabled={currencyLocked}
        />
        {currencyLocked && <span className="field__hint">{t('kidForm.currencyLocked')}</span>}
      </div>
      <div className="field">
        <label htmlFor="kidFreq">{t('kidForm.frequency')}</label>
        <select
          id="kidFreq"
          value={value.allowanceFrequency}
          onChange={(e) => {
            const f = e.target.value as Frequency;
            onChange({ ...value, allowanceFrequency: f, allowanceDay: f === 'monthly' ? 1 : 5 });
          }}
        >
          <option value="none">{t('kidForm.freq_none')}</option>
          <option value="weekly">{t('kidForm.freq_weekly')}</option>
          <option value="monthly">{t('kidForm.freq_monthly')}</option>
        </select>
      </div>
      {value.allowanceFrequency !== 'none' && (
        <>
          <div className="field">
            <label htmlFor="kidAmount">{t('kidForm.allowanceAmount')}</label>
            <input
              id="kidAmount"
              inputMode="decimal"
              value={value.allowanceAmount}
              onChange={(e) => set('allowanceAmount', e.target.value)}
            />
          </div>
          {value.allowanceFrequency === 'weekly' ? (
            <div className="field">
              <label htmlFor="kidDay">{t('kidForm.weekday')}</label>
              <select
                id="kidDay"
                value={value.allowanceDay}
                onChange={(e) => set('allowanceDay', Number(e.target.value))}
              >
                {weekdays.map((w) => (
                  <option key={w.d} value={w.d}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="kidDay">{t('kidForm.monthDay')}</label>
              <input
                id="kidDay"
                type="number"
                min={1}
                max={28}
                value={value.allowanceDay}
                onChange={(e) => set('allowanceDay', Number(e.target.value))}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="kidStart">{t('kidForm.startDate')}</label>
            <input
              id="kidStart"
              type="date"
              value={value.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              required
            />
          </div>
        </>
      )}
      {showArchive && (
        <div className="field field--inline">
          <input
            id="kidArchived"
            type="checkbox"
            checked={value.archived}
            onChange={(e) => set('archived', e.target.checked)}
          />
          <label htmlFor="kidArchived">{t('kidForm.archived')}</label>
        </div>
      )}
      {error && <p className="field__error">{t(error)}</p>}
    </>
  );
}

export function KidFormScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { family, actions, busy, isParent } = useFamily();
  const existing = id ? family.kids.find((k) => k.id === id) : undefined;
  const hasTx = existing ? family.transactions.some((tx) => tx.kidId === existing.id) : false;
  const [draft, setDraft] = useState<KidDraft>(() =>
    existing ? draftFromKid(existing) : emptyKid(family.settings.defaultCurrency),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  if (!isParent || (id && !existing)) return <Navigate to="/" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateKid(draft);
    if (!v.ok) return setFieldError(v.error);
    setFieldError(null);
    const p = existing
      ? actions.updateKid(
          { ...existing, ...v.value, currency: hasTx ? existing.currency : v.value.currency },
          existing.updatedAt,
        )
      : actions.addKid(v.value);
    p.then(() => navigate(existing ? `/kids/${existing.id}` : '/')).catch(setError);
  };

  const back = existing ? `/kids/${existing.id}` : '/';
  const tooOld =
    draft.allowanceFrequency !== 'none' && daysBetween(draft.startDate, todayIso()) > 366;
  return (
    <main className="app">
      <TopBar title={existing ? t('kidForm.editTitle') : t('kidForm.addTitle')} back={back} />
      <form onSubmit={submit}>
        <KidFields
          value={draft}
          onChange={setDraft}
          currencyLocked={hasTx}
          error={fieldError}
          showArchive={Boolean(existing)}
        />
        {tooOld && <p className="field__hint">{t('kidForm.startDateOld')}</p>}
        {error && <ErrorBanner error={error} />}
        <div className="button-row">
          <Link to={back} className="button">
            {t('app.cancel')}
          </Link>
          <button type="submit" className="button button--primary" disabled={busy}>
            {t('app.save')}
          </button>
        </div>
      </form>
    </main>
  );
}
