import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

/** A native <dialog>, styled as a sheet from the bottom. Focus trap, Esc and backdrop come free. */
export function Dialog({
  open,
  onClose,
  title,
  avatar,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  avatar?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
    >
      {open && (
        <>
          <div className="dialog__head">
            {avatar !== undefined && (
              <div className="avatar avatar--sm" aria-hidden="true">
                {avatar || '🙂'}
              </div>
            )}
            <h2 id="dialog-title">{title}</h2>
            <button
              type="button"
              className="icon-button dialog__close"
              onClick={onClose}
              aria-label={t('app.close')}
            >
              <Icon name="close" size={16} strokeWidth={2.6} />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
