import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { hasAllowance, nextPayday } from '../../domain/allowance';
import { daysBetween, todayIso } from '../../domain/dates';
import { goalProgress, topActiveGoal } from '../../domain/goals';
import type { Kid } from '../../domain/schema';
import { useFamily } from '../../state/AppContext';
import { sheetUrl } from '../../state/session';
import { WarningsBanner } from '../components/Banners';
import { Icon, Logo } from '../components/Icon';
import { Money } from '../components/Money';
import { ProgressBar } from '../components/ProgressBar';
import { TopBar } from '../components/TopBar';
import { kidTint, useFormat, useNow, useWords } from '../format';

/** "Updated just now", "Updated 3 min ago", "Updated at 14:05". */
export function Updated({ at }: { at: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const now = useNow();
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return <>{t('home.updatedNow')}</>;
  if (minutes < 60) return <>{t('home.updatedMinutes', { count: minutes })}</>;
  return <>{t('home.updatedAt', { time: f.time(at) })}</>;
}

function AccountCard({ kid }: { kid: Kid }) {
  const { t } = useTranslation();
  const words = useWords();
  const { family, isParent } = useFamily();
  const balance = family.balances.get(kid.id) ?? 0;
  const today = todayIso();
  const goal = topActiveGoal(family.goals, kid.id);
  const next = hasAllowance({ frequency: kid.allowanceFrequency, amount: kid.allowanceAmount })
    ? nextPayday(
        { frequency: kid.allowanceFrequency, day: kid.allowanceDay, startDate: kid.startDate },
        today,
      )
    : null;

  let sub: string;
  if (goal) {
    sub = `${goal.name} · ${words.goalForecast(kid, balance, goal)}`;
  } else if (next) {
    const days = daysBetween(today, next);
    sub = days === 0 ? t('home.nextPaydayToday') : t('home.nextPaydayDays', { count: days });
  } else {
    sub = t('home.noAllowance');
  }

  const canAdd = isParent && !kid.archived;
  const cls = `account tint-${kidTint(family.kids, kid.id)}`;
  return (
    <div className={cls}>
      <Link to={`/kids/${kid.id}`} className="account__body">
        <div className="avatar" aria-hidden="true">
          {kid.avatar || '🙂'}
        </div>
        <div className="account__text">
          <p className="account__name">
            {kid.name} {kid.archived && <span className="badge">{t('kid.archivedBadge')}</span>}
          </p>
          <p className="account__sub">{sub}</p>
        </div>
        <Money minor={balance} currency={kid.currency} className="account__balance" />
      </Link>
      {(goal || canAdd) && (
        <div className="account__foot">
          {goal ? (
            <ProgressBar value={goalProgress(balance, goal.price)} label={goal.name} />
          ) : (
            <span className="account__sub">{words.allowance(kid) ?? ''}</span>
          )}
          {canAdd && (
            <Link
              to={`/kids/${kid.id}/add`}
              className="pill pill--ink account__add"
              aria-label={t('home.moneyFor', { name: kid.name })}
            >
              <Icon name="plus" size={14} strokeWidth={2.8} />
              {t('home.money')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function Home() {
  const { t } = useTranslation();
  const { family, isParent, actions, busy, loadedAt } = useFamily();
  const active = family.kids.filter((k) => !k.archived);
  const archived = family.kids.filter((k) => k.archived);
  const name = family.settings.familyName;
  return (
    <main className="app">
      <TopBar
        title={name ? t('home.bank', { name }) : t('app.name')}
        subtitle={<Updated at={loadedAt} />}
        leading={<Logo size={40} />}
        actions={
          <>
            <button
              type="button"
              className="icon-button"
              onClick={() => void actions.refresh()}
              disabled={busy}
              aria-label={t('home.refresh')}
            >
              <Icon name="refresh" />
            </button>
            <Link to="/settings" className="icon-button" aria-label={t('settings.title')}>
              <Icon name="settings" />
            </Link>
          </>
        }
      />
      <WarningsBanner warnings={family.warnings} sheetUrl={sheetUrl(family.fileId)} />
      {active.length === 0 && <p className="muted center">{t('home.empty')}</p>}
      <div className="stack">
        {active.map((k) => (
          <AccountCard key={k.id} kid={k} />
        ))}
        {isParent && (
          <Link to="/kids/new" className="account-add">
            <Icon name="plus" size={18} strokeWidth={2.5} />
            {t('home.addKid')}
          </Link>
        )}
      </div>
      {archived.length > 0 && (
        <details className="section">
          <summary className="section__summary muted">
            {t('home.archived', { count: archived.length })}
          </summary>
          <div className="stack" style={{ marginBlockStart: '0.75rem' }}>
            {archived.map((k) => (
              <AccountCard key={k.id} kid={k} />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
