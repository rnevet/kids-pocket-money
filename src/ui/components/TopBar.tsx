import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export function TopBar({
  title,
  back,
  actions,
}: {
  title: string;
  back?: string;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className="topbar">
      {back && (
        <Link to={back} className="icon-button icon-button--back" aria-label={t('app.back')}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <h1 className="topbar__title">{title}</h1>
      {actions}
    </header>
  );
}
