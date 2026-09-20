import { useTranslation } from 'react-i18next';
import type { RowWarning } from '../../data/repository';
import type { AppError } from '../../google/errors';
import { useFormat } from '../format';

export function ErrorBanner({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="banner banner--danger" role="alert">
      <p style={{ margin: 0 }}>{f.error(error)}</p>
      {onRetry && (
        <button
          type="button"
          className="button"
          style={{ marginBlockStart: '0.5rem' }}
          onClick={onRetry}
        >
          {t('app.retry')}
        </button>
      )}
    </div>
  );
}

export function WarningsBanner({
  warnings,
  sheetUrl,
}: {
  warnings: RowWarning[];
  sheetUrl: string;
}) {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;
  return (
    <details className="banner banner--warning">
      <summary>{t('warnings.title', { count: warnings.length })}</summary>
      <p className="small" style={{ marginBlock: '0.5rem 0' }}>
        {t('warnings.hint')}
      </p>
      <ul className="small">
        {warnings.slice(0, 20).map((w) => (
          <li key={`${w.tab}-${w.row}`}>
            {t('warnings.row', {
              tab: w.tab,
              row: w.row,
              reason: t(`warnings.reason_${w.reason}`, { detail: w.detail }),
            })}
          </li>
        ))}
      </ul>
      <a href={sheetUrl} target="_blank" rel="noreferrer" className="small">
        {t('settings.openSheet')}
      </a>
    </details>
  );
}
