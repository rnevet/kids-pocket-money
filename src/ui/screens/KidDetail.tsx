import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { sortNewestFirst } from '../../domain/balance';
import { daysBetween, todayIso } from '../../domain/dates';
import { nextPayday } from '../../domain/allowance';
import { goalProgress, topActiveGoal } from '../../domain/goals';
import { formatAmountCell, parseUserAmount, type Minor } from '../../domain/money';
import type { Goal, Kid, Transaction, TxType } from '../../domain/schema';
import type { AppError } from '../../google/errors';
import { useFamily } from '../../state/AppContext';
import { ErrorBanner } from '../components/Banners';
import { Dialog } from '../components/Dialog';
import { Icon, type IconName } from '../components/Icon';
import { Money } from '../components/Money';
import { ProgressBar } from '../components/ProgressBar';
import { TopBar } from '../components/TopBar';
import { kidTint, useFormat, useWords } from '../format';
import { Updated } from './Home';

type TxMode = 'deposit' | 'withdrawal';

const QUICK_AMOUNTS = [10, 20, 50, 100];

function MoneySheet({
  kid,
  mode,
  onModeChange,
  onClose,
}: {
  kid: Kid;
  mode: TxMode | null;
  onModeChange: (mode: TxMode) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const { actions, busy } = useFamily();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<AppError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = () => {
    setAmount('');
    setNote('');
    setDate(todayIso());
    setError(null);
    setFieldError(null);
    onClose();
  };

  const minor = parseUserAmount(amount);
  const valid = minor !== null && minor > 0;
  const spent = mode === 'withdrawal';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return setFieldError(t('tx.invalidAmount'));
    actions
      .addTransaction(kid.id, spent ? -minor : minor, mode ?? 'deposit', note.trim(), date)
      .then(reset)
      .catch(setError);
  };

  const bump = (n: number) => {
    const current = parseUserAmount(amount) ?? 0;
    setAmount(formatAmountCell(Math.max(0, current) + n * 100).replace(/\.00$/, ''));
    setFieldError(null);
  };

  const submitLabel = !valid
    ? t('app.save')
    : t(spent ? 'tx.submitSpent' : 'tx.submitGot', {
        amount: f.money(minor, kid.currency),
        name: kid.name,
      });

  return (
    <Dialog
      open={mode !== null}
      onClose={reset}
      avatar={kid.avatar}
      title={
        spent ? t('tx.withdrawTitle', { name: kid.name }) : t('tx.depositTitle', { name: kid.name })
      }
    >
      <form onSubmit={submit}>
        <div className="segmented" role="radiogroup" aria-label={t('tx.kind')}>
          <button
            type="button"
            role="radio"
            aria-checked={!spent}
            className="segmented__option"
            onClick={() => onModeChange('deposit')}
          >
            {t('kid.deposit')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={spent}
            className="segmented__option"
            onClick={() => onModeChange('withdrawal')}
          >
            {t('kid.withdraw')}
          </button>
        </div>
        <div className="field">
          <label htmlFor="txAmount">{t('tx.amount')}</label>
          <div className="amount">
            <span className="amount__symbol" aria-hidden="true">
              {f.currencySymbol(kid.currency)}
            </span>
            <input
              id="txAmount"
              className="amount__input"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldError(null);
              }}
              required
            />
          </div>
          <div className="chips">
            {QUICK_AMOUNTS.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => bump(n)}>
                +{f.number(n)}
              </button>
            ))}
          </div>
          {fieldError && <span className="field__error">{fieldError}</span>}
        </div>
        <div className="field">
          <label htmlFor="txNote">{t('tx.note')}</label>
          <input
            id="txNote"
            value={note}
            placeholder={t('tx.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="txDate">{t('tx.date')}</label>
          <input
            id="txDate"
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        {error && <ErrorBanner error={error} />}
        <div className="stack">
          <button type="submit" className="button button--primary button--block" disabled={busy}>
            {submitLabel}
          </button>
          <button type="button" className="button button--text" onClick={reset} disabled={busy}>
            {t('app.cancel')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function GoalDialog({ kid, open, onClose }: { kid: Kid; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { actions, busy } = useFamily();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const reset = () => {
    setName('');
    setPrice('');
    setError(null);
    setFieldError(null);
    onClose();
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseUserAmount(price);
    if (minor === null || minor <= 0) return setFieldError(t('goal.invalidPrice'));
    actions.addGoal(kid.id, name.trim(), minor).then(reset).catch(setError);
  };
  return (
    <Dialog open={open} onClose={reset} avatar={kid.avatar} title={t('goal.title')}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="goalName">{t('goal.name')}</label>
          <input
            id="goalName"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="field">
          <label htmlFor="goalPrice">{t('goal.price')}</label>
          <div className="amount">
            <span className="amount__symbol" aria-hidden="true">
              {f.currencySymbol(kid.currency)}
            </span>
            <input
              id="goalPrice"
              className="amount__input"
              inputMode="decimal"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          {fieldError && <span className="field__error">{fieldError}</span>}
        </div>
        {error && <ErrorBanner error={error} />}
        <div className="stack">
          <button type="submit" className="button button--primary button--block" disabled={busy}>
            {t('app.save')}
          </button>
          <button type="button" className="button button--text" onClick={reset} disabled={busy}>
            {t('app.cancel')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Stamp() {
  const { t } = useTranslation();
  return (
    <span className="stamp">
      <Icon name="check" size={12} strokeWidth={3} />
      {t('kid.done')}
    </span>
  );
}

function GoalHero({ kid, goal, balance }: { kid: Kid; goal: Goal; balance: Minor }) {
  const { t } = useTranslation();
  const f = useFormat();
  const words = useWords();
  const allowance = words.allowance(kid);
  const today = todayIso();
  const next = nextPayday(
    { frequency: kid.allowanceFrequency, day: kid.allowanceDay, startDate: kid.startDate },
    today,
  );
  let nextText = '';
  if (next) {
    const days = daysBetween(today, next);
    nextText = days === 0 ? t('home.nextPaydayToday') : t('home.nextPaydayDays', { count: days });
  }
  return (
    <section className="hero-card">
      <div>
        <p className="hero-card__label">{t('kid.savingFor')}</p>
        <p className="hero-card__name">{goal.name}</p>
      </div>
      <p className="hero-card__forecast">{words.goalForecast(kid, balance, goal)}</p>
      <div>
        <ProgressBar value={goalProgress(balance, goal.price)} label={goal.name} />
        <div className="hero-card__meta" style={{ marginBlockStart: '0.5rem' }}>
          <span>{t('goal.saved', { saved: f.money(Math.max(0, balance), kid.currency) })}</span>
          <span>{t('goal.of', { price: f.money(goal.price, kid.currency) })}</span>
        </div>
      </div>
      {allowance && (
        <p className="hero-card__line">
          <Icon name="calendar" size={16} />
          <span>{nextText ? `${allowance} · ${nextText}` : allowance}</span>
        </p>
      )}
    </section>
  );
}

function GoalRow({ goal, kid, balance }: { goal: Goal; kid: Kid; balance: Minor }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { actions, busy, isParent } = useFamily();
  const [error, setError] = useState<AppError | null>(null);
  const set = (status: Goal['status']) =>
    actions.updateGoal({ ...goal, status }, goal.updatedAt).catch(setError);
  const progress = goalProgress(balance, goal.price);
  const active = goal.status === 'active';
  return (
    <li className="row row--stack">
      <div className="row__line">
        {!active && (
          <div className="tile tile--got">
            <Icon name="check" size={16} strokeWidth={2.8} />
          </div>
        )}
        <div className="row__main">
          <p className="row__title">{goal.name}</p>
          <p className="row__sub">
            {active
              ? `${t('goal.saved', { saved: f.money(Math.max(0, balance), kid.currency) })} · ${t(
                  'goal.of',
                  { price: f.money(goal.price, kid.currency) },
                )}`
              : f.money(goal.price, kid.currency)}
          </p>
        </div>
        {!active && <Stamp />}
        {isParent && active && (
          <div className="row__actions">
            <button type="button" className="pill" onClick={() => void set('done')} disabled={busy}>
              <Icon name="check" size={14} strokeWidth={2.8} />
              {t('kid.markDone')}
            </button>
            <button
              type="button"
              className="pill pill--danger"
              onClick={() => void set('deleted')}
              disabled={busy}
            >
              {t('kid.deleteGoal')}
            </button>
          </div>
        )}
      </div>
      {active && <ProgressBar value={progress} label={goal.name} neutral />}
      {error && <ErrorBanner error={error} />}
    </li>
  );
}

const TX_ICON: Record<TxType, { icon: IconName; tile: string }> = {
  allowance: { icon: 'calendar', tile: 'tile tile--coin' },
  deposit: { icon: 'gift', tile: 'tile tile--got' },
  withdrawal: { icon: 'bag', tile: 'tile' },
  adjustment: { icon: 'sliders', tile: 'tile' },
};

function TxRow({ tx, kid }: { tx: Transaction; kid: Kid }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { isParent } = useFamily();
  const { icon, tile } = TX_ICON[tx.type];
  const parts = [f.date(tx.date), t(`tx.${tx.type}`)];
  if (isParent && tx.createdBy && tx.type !== 'allowance')
    parts.push(t('tx.by', { email: tx.createdBy }));
  return (
    <li className="row">
      <div className={tile}>
        <Icon name={icon} size={18} />
      </div>
      <div className="row__main">
        <p className="row__title">{tx.note || t(`tx.${tx.type}`)}</p>
        <p className="row__sub">{parts.join(' · ')}</p>
      </div>
      <Money minor={tx.amount} currency={kid.currency} signed />
    </li>
  );
}

export function KidDetail({ openAdd = false }: { openAdd?: boolean }) {
  const { t } = useTranslation();
  const words = useWords();
  const navigate = useNavigate();
  const { id } = useParams();
  const { family, isParent, loadedAt } = useFamily();
  const kid = family.kids.find((k) => k.id === id);
  const canEdit = isParent && Boolean(kid) && !kid!.archived;
  const [txMode, setTxMode] = useState<TxMode | null>(openAdd && canEdit ? 'deposit' : null);
  const [goalOpen, setGoalOpen] = useState(false);
  if (!kid) return <Navigate to="/" replace />;

  const balance = family.balances.get(kid.id) ?? 0;
  const goals = family.goals.filter((g) => g.kidId === kid.id && g.status !== 'deleted');
  const top = topActiveGoal(family.goals, kid.id);
  const lastDone = goals
    .filter((g) => g.status === 'done')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  const history = sortNewestFirst(family.transactions.filter((tx) => tx.kidId === kid.id));
  const allowance = words.allowance(kid);

  const closeSheet = () => {
    setTxMode(null);
    if (openAdd) navigate(`/kids/${kid.id}`, { replace: true });
  };

  return (
    <main className={`app tint-${kidTint(family.kids, kid.id)}`}>
      <TopBar
        title={kid.name}
        subtitle={<Updated at={loadedAt} />}
        avatar={kid.avatar}
        back="/"
        actions={
          isParent && (
            <Link to={`/kids/${kid.id}/edit`} className="icon-button" aria-label={t('app.edit')}>
              <Icon name="edit" />
            </Link>
          )
        }
      />

      {top ? (
        <GoalHero kid={kid} goal={top} balance={balance} />
      ) : (
        <section className="hero-card">
          <p className="hero-card__label">{t('kid.savingFor')}</p>
          <p className="hero-card__name">{t('home.noGoal')}</p>
          {allowance && (
            <p className="hero-card__line">
              <Icon name="calendar" size={16} />
              <span>{allowance}</span>
            </p>
          )}
          {canEdit && (
            <button type="button" className="pill pill--ink" onClick={() => setGoalOpen(true)}>
              <Icon name="plus" size={14} strokeWidth={2.8} />
              {t('kid.addGoal')}
            </button>
          )}
        </section>
      )}

      <section className="balance-card">
        <div className="balance-card__text">
          <p className="balance-card__label">{t('kid.balance')}</p>
          <Money minor={balance} currency={kid.currency} big />
        </div>
        {lastDone && (
          <div className="balance-card__done">
            <span>{lastDone.name}</span>
            <Stamp />
          </div>
        )}
      </section>

      {canEdit && (
        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={() => setTxMode('deposit')}
          >
            <Icon name="gift" size={18} />
            {t('kid.deposit')}
          </button>
          <button type="button" className="button" onClick={() => setTxMode('withdrawal')}>
            <Icon name="bag" size={18} />
            {t('kid.withdraw')}
          </button>
        </div>
      )}

      <section className="section">
        <div className="section__head">
          <h2>{t('kid.goals')}</h2>
          {canEdit && top && (
            <button type="button" className="pill" onClick={() => setGoalOpen(true)}>
              <Icon name="plus" size={14} strokeWidth={2.8} />
              {t('kid.addGoal')}
            </button>
          )}
        </div>
        {goals.length === 0 ? (
          <p className="muted small" style={{ paddingInline: '0.25rem' }}>
            {t('kid.noGoals')}
          </p>
        ) : (
          <ul className="list list--card">
            {goals.map((g) => (
              <GoalRow key={g.id} goal={g} kid={kid} balance={balance} />
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>{t('kid.history')}</h2>
        </div>
        {history.length === 0 ? (
          <p className="muted small" style={{ paddingInline: '0.25rem' }}>
            {t('kid.noHistory')}
          </p>
        ) : (
          <ul className="list list--card">
            {history.map((tx) => (
              <TxRow key={tx.id} tx={tx} kid={kid} />
            ))}
          </ul>
        )}
      </section>

      <MoneySheet kid={kid} mode={txMode} onModeChange={setTxMode} onClose={closeSheet} />
      <GoalDialog kid={kid} open={goalOpen} onClose={() => setGoalOpen(false)} />
    </main>
  );
}
