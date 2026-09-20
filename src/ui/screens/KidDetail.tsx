import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';
import { sortNewestFirst } from '../../domain/balance';
import { todayIso } from '../../domain/dates';
import { goalProgress } from '../../domain/goals';
import { parseUserAmount } from '../../domain/money';
import type { Goal, Kid } from '../../domain/schema';
import type { AppError } from '../../google/errors';
import { useFamily } from '../../state/AppContext';
import { ErrorBanner } from '../components/Banners';
import { Dialog } from '../components/Dialog';
import { Money } from '../components/Money';
import { ProgressBar } from '../components/ProgressBar';
import { TopBar } from '../components/TopBar';
import { useFormat } from '../format';

type TxMode = 'deposit' | 'withdrawal';

function TransactionDialog({
  kid,
  mode,
  onClose,
}: {
  kid: Kid;
  mode: TxMode | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseUserAmount(amount);
    if (minor === null || minor <= 0) return setFieldError(t('tx.invalidAmount'));
    const signed = mode === 'withdrawal' ? -minor : minor;
    actions
      .addTransaction(kid.id, signed, mode ?? 'deposit', note.trim(), date)
      .then(reset)
      .catch(setError);
  };

  return (
    <Dialog
      open={mode !== null}
      onClose={reset}
      title={
        mode === 'withdrawal'
          ? t('tx.withdrawTitle', { name: kid.name })
          : t('tx.depositTitle', { name: kid.name })
      }
    >
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="txAmount">
            {t('tx.amount')} ({kid.currency})
          </label>
          <input
            id="txAmount"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          {fieldError && <span className="field__error">{fieldError}</span>}
        </div>
        <div className="field">
          <label htmlFor="txNote">{t('tx.note')}</label>
          <input
            id="txNote"
            value={note}
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
        <div className="button-row">
          <button type="button" className="button" onClick={reset} disabled={busy}>
            {t('app.cancel')}
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {t('app.save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function GoalDialog({ kid, open, onClose }: { kid: Kid; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
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
    <Dialog open={open} onClose={reset} title={t('goal.title')}>
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
          <label htmlFor="goalPrice">
            {t('goal.price')} ({kid.currency})
          </label>
          <input
            id="goalPrice"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          {fieldError && <span className="field__error">{fieldError}</span>}
        </div>
        {error && <ErrorBanner error={error} />}
        <div className="button-row">
          <button type="button" className="button" onClick={reset} disabled={busy}>
            {t('app.cancel')}
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {t('app.save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function GoalRow({ goal, kid, balance }: { goal: Goal; kid: Kid; balance: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { actions, busy, isParent } = useFamily();
  const [error, setError] = useState<AppError | null>(null);
  const set = (status: Goal['status']) =>
    actions.updateGoal({ ...goal, status }, goal.updatedAt).catch(setError);
  const progress = goalProgress(balance, goal.price);
  return (
    <li className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div className="row__main">
          <p className="row__title">
            {goal.name} {goal.status === 'done' && <span className="badge">{t('kid.done')}</span>}
          </p>
          <p className="row__sub">
            {t('goal.progress', {
              percent: f.percent(progress),
              price: f.money(goal.price, kid.currency),
            })}
          </p>
        </div>
        {isParent && goal.status === 'active' && (
          <>
            <button
              type="button"
              className="button"
              onClick={() => void set('done')}
              disabled={busy}
            >
              {t('kid.markDone')}
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void set('deleted')}
              disabled={busy}
            >
              {t('kid.deleteGoal')}
            </button>
          </>
        )}
      </div>
      {goal.status === 'active' && <ProgressBar value={progress} label={goal.name} />}
      {error && <ErrorBanner error={error} />}
    </li>
  );
}

export function KidDetail() {
  const { t } = useTranslation();
  const f = useFormat();
  const { id } = useParams();
  const { family, isParent } = useFamily();
  const [txMode, setTxMode] = useState<TxMode | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const kid = family.kids.find((k) => k.id === id);
  if (!kid) return <Navigate to="/" replace />;
  const balance = family.balances.get(kid.id) ?? 0;
  const goals = family.goals.filter((g) => g.kidId === kid.id && g.status !== 'deleted');
  const history = sortNewestFirst(family.transactions.filter((tx) => tx.kidId === kid.id));

  return (
    <main className="app">
      <TopBar
        title={`${kid.avatar} ${kid.name}`}
        back="/"
        actions={
          isParent && (
            <Link to={`/kids/${kid.id}/edit`} className="icon-button" aria-label={t('app.edit')}>
              ✏️
            </Link>
          )
        }
      />
      <section className="center section">
        <p className="muted small" style={{ margin: 0 }}>
          {t('kid.balance')}
        </p>
        <Money minor={balance} currency={kid.currency} big />
        {isParent && !kid.archived && (
          <div className="button-row" style={{ marginBlockStart: '1rem' }}>
            <button
              type="button"
              className="button button--primary"
              onClick={() => setTxMode('deposit')}
            >
              {t('kid.deposit')}
            </button>
            <button type="button" className="button" onClick={() => setTxMode('withdrawal')}>
              {t('kid.withdraw')}
            </button>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2>{t('kid.goals')}</h2>
          {isParent && !kid.archived && (
            <button type="button" className="button" onClick={() => setGoalOpen(true)}>
              {t('kid.addGoal')}
            </button>
          )}
        </div>
        {goals.length === 0 ? (
          <p className="muted small">{t('kid.noGoals')}</p>
        ) : (
          <ul className="list">
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
          <p className="muted small">{t('kid.noHistory')}</p>
        ) : (
          <ul className="list">
            {history.map((tx) => (
              <li key={tx.id} className="row">
                <div className="row__main">
                  <p className="row__title">{tx.note || t(`tx.${tx.type}`)}</p>
                  <p className="row__sub">
                    {f.date(tx.date)} · {t(`tx.${tx.type}`)}
                    {tx.createdBy && tx.type !== 'allowance'
                      ? ` · ${t('tx.by', { email: tx.createdBy })}`
                      : ''}
                  </p>
                </div>
                <Money minor={tx.amount} currency={kid.currency} signed />
              </li>
            ))}
          </ul>
        )}
      </section>

      <TransactionDialog kid={kid} mode={txMode} onClose={() => setTxMode(null)} />
      <GoalDialog kid={kid} open={goalOpen} onClose={() => setGoalOpen(false)} />
    </main>
  );
}
