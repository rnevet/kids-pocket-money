import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DriveFile } from '../../google/drive';
import type { AppError } from '../../google/errors';
import { useApp } from '../../state/AppContext';
import { ErrorBanner } from '../components/Banners';
import { Setup } from './Setup';

export function Loading() {
  const { t } = useTranslation();
  return (
    <main className="app hero">
      <p className="muted">{t('app.loading')}</p>
    </main>
  );
}

export function NoFamily({ joinFileId }: { joinFileId: string | null }) {
  const { t } = useTranslation();
  const { actions, busy } = useApp();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  if (creating) return <Setup onCancel={() => setCreating(false)} />;
  const open = () => actions.openExisting(joinFileId ?? undefined).catch(setError);
  return (
    <main className="app hero">
      <div className="stack">
        <h1>{joinFileId ? t('bootstrap.join') : t('bootstrap.noFamily')}</h1>
        <p className="muted">
          {joinFileId ? t('bootstrap.joinHint') : t('bootstrap.noFamilyHint')}
        </p>
        {error && <ErrorBanner error={error} />}
        {joinFileId ? (
          <button type="button" className="button button--primary" onClick={open} disabled={busy}>
            {t('bootstrap.joinButton')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="button button--primary"
              onClick={() => setCreating(true)}
              disabled={busy}
            >
              {t('bootstrap.create')}
            </button>
            <button type="button" className="button" onClick={open} disabled={busy}>
              {t('bootstrap.open')}
            </button>
          </>
        )}
        <button type="button" className="button" onClick={() => void actions.signOut()}>
          {t('settings.signOut')}
        </button>
      </div>
    </main>
  );
}

export function ChooseFamily({ files }: { files: DriveFile[] }) {
  const { t } = useTranslation();
  const { actions, busy } = useApp();
  return (
    <main className="app">
      <h1 style={{ marginBlockStart: '1.5rem' }}>{t('bootstrap.choose')}</h1>
      <div className="stack">
        {files.map((f) => (
          <button
            key={f.id}
            type="button"
            className="card"
            onClick={() => void actions.chooseFile(f)}
            disabled={busy}
            style={{ textAlign: 'start', cursor: 'pointer' }}
          >
            <strong>{f.name}</strong>
          </button>
        ))}
        <button
          type="button"
          className="button"
          onClick={() => void actions.openExisting()}
          disabled={busy}
        >
          {t('bootstrap.open')}
        </button>
      </div>
    </main>
  );
}

export function ErrorScreen({ error }: { error: AppError }) {
  const { actions } = useApp();
  const { t } = useTranslation();
  return (
    <main className="app" style={{ paddingBlockStart: '2rem' }}>
      <ErrorBanner error={error} onRetry={() => void actions.refresh()} />
      <div className="button-row">
        <button type="button" className="button" onClick={() => actions.switchFamily()}>
          {t('bootstrap.switch')}
        </button>
        <button type="button" className="button" onClick={() => void actions.signOut()}>
          {t('settings.signOut')}
        </button>
      </div>
    </main>
  );
}
