import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
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
          <h2 id="dialog-title">{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}
