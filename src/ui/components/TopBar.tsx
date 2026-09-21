import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

export function TopBar({
  title,
  subtitle,
  back,
  avatar,
  leading,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  /** A kid's emoji, shown on a tinted tile next to the title. */
  avatar?: string;
  /** Anything else to show before the title, such as the logo. */
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className="topbar">
      {back && (
        <Link
          to={back}
          className="icon-button icon-button--plain icon-button--back"
          aria-label={t('app.back')}
        >
          <Icon name="back" size={22} />
        </Link>
      )}
      {leading}
      {avatar !== undefined && (
        <div className="avatar" aria-hidden="true">
          {avatar || '🙂'}
        </div>
      )}
      <div className="topbar__text">
        <h1 className="topbar__title">{title}</h1>
        {subtitle && <p className="topbar__sub">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
