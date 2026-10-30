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
 * handling for free (and is not `window.confirm`, which is unstyled and blocks the page). The
 * confirm button submits the dialog's form, which marks it as the dialog's primary (base.css).
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
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} role="alertdialog" aria-labelledby="confirm-title" onCancel={onCancel}>
      <h2 id="confirm-title">{title}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        {children}
        <footer>
          <button type="button" onClick={onCancel}>
            {t('games.cancel')}
          </button>
          <button type="submit">{confirmLabel}</button>
        </footer>
      </form>
    </dialog>
  );
}
