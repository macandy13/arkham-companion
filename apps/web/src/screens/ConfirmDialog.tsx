import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  /** Label of the confirming (destructive) button. */
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Modal confirmation built on the native `<dialog>`, which brings focus trapping and Escape
 * handling for free (and is not `window.confirm`, which is unstyled and blocks the page).
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // jsdom (unit tests) lacks showModal; the open attribute gives the same markup there.
    if (typeof dialog.current?.showModal === 'function') dialog.current.showModal();
    else dialog.current?.setAttribute('open', '');
  }, []);

  return (
    <dialog ref={dialog} role="alertdialog" aria-labelledby="confirm-title" onCancel={onCancel}>
      <h2 id="confirm-title">{title}</h2>
      {children}
      <footer>
        <button type="button" onClick={onCancel}>
          {t('games.cancel')}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </footer>
    </dialog>
  );
}
