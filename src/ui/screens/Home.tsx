import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { nextPayday } from '../../domain/allowance';
import { daysBetween, todayIso } from '../../domain/dates';
import { goalProgress, topActiveGoal } from '../../domain/goals';
import type { Kid } from '../../domain/schema';
import { useFamily } from '../../state/AppContext';
import { sheetUrl } from '../../state/session';
import { WarningsBanner } from '../components/Banners';
import { Money } from '../components/Money';
import { ProgressBar } from '../components/ProgressBar';
import { TopBar } from '../components/TopBar';
import { useFormat } from '../format';

function KidCard({ kid }: { kid: Kid }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { family } = useFamily();
  const balance = family.balances.get(kid.id) ?? 0;
  const today = todayIso();
  const next = nextPayday(
    { frequency: kid.allowanceFrequency, day: kid.allowanceDay, startDate: kid.startDate },
    today,
  );
  const goal = topActiveGoal(family.goals, kid.id);
  let sub = t('home.noAllowance');
  if (next) {
    const days = daysBetween(today, next);
    sub = days === 0 ? t('home.nextPaydayToday') : t('home.nextPaydayDays', { count: days });
  }
  return (
    <Link to={`/kids/${kid.id}`} className="card kid-card">
      <div className="kid-card__avatar" aria-hidden="true">
        {kid.avatar || '🙂'}
      </div>
      <div>
        <p className="kid-card__name">
          {kid.name} {kid.archived && <span className="badge">{t('kid.archivedBadge')}</span>}
        </p>
        <p className="kid-card__sub">{sub}</p>
      </div>
      <Money minor={balance} currency={kid.currency} />
      {goal && (
        <div className="kid-card__goal">
          <p className="kid-card__sub">
            {goal.name} ·{' '}
            {t('goal.progress', {
              percent: f.percent(goalProgress(balance, goal.price)),
              price: f.money(goal.price, kid.currency),
            })}
          </p>
          <ProgressBar value={goalProgress(balance, goal.price)} label={goal.name} />
        </div>
      )}
    </Link>
  );
}

export function Home() {
  const { t } = useTranslation();
  const { family, isParent, actions, busy } = useFamily();
  const active = family.kids.filter((k) => !k.archived);
  const archived = family.kids.filter((k) => k.archived);
  return (
    <main className="app">
      <TopBar
        title={family.settings.familyName || t('app.name')}
        actions={
          <>
            <button
              type="button"
              className="icon-button"
              onClick={() => void actions.refresh()}
              disabled={busy}
              aria-label={t('app.retry')}
            >
              ↻
            </button>
            <Link to="/settings" className="icon-button" aria-label={t('settings.title')}>
              ⚙️
            </Link>
          </>
        }
      />
      <WarningsBanner warnings={family.warnings} sheetUrl={sheetUrl(family.fileId)} />
      {active.length === 0 && <p className="muted center">{t('home.empty')}</p>}
      {active.map((k) => (
        <KidCard key={k.id} kid={k} />
      ))}
      {archived.length > 0 && (
        <details className="section">
          <summary className="muted">{t('home.archived')}</summary>
          {archived.map((k) => (
            <KidCard key={k.id} kid={k} />
          ))}
        </details>
      )}
      {isParent && (
        <Link to="/kids/new" className="button button--primary fab" aria-label={t('home.addKid')}>
          +
        </Link>
      )}
    </main>
  );
}
