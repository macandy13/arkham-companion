import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocationView } from '@arkham/engine';
import type { GameActions, LocationToken } from '../state/gameActions';

/**
 * What the players can do to one location by hand, opened by a long press on its tile: reveal it
 * and add or remove its clues and doom, as a card effect or the table asks, so the screen keeps
 * up with the physical game. Investigating stays with the investigator, not the location. It stays open across taps, since a correction often takes several, and reads the
 * location fresh from the board, so its counts follow each step. A native modal `<dialog>` brings
 * focus trapping and Escape; nothing is tapped while a step is queued (`busy`).
 */
export function LocationMenu({
  location,
  actions,
  busy,
  onClose,
}: {
  location: LocationView;
  actions: GameActions;
  busy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const doom = location.doom ?? 0;

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose}>
      <h2 id={titleId}>{location.name}</h2>
      {!location.revealed && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void actions.revealLocation(location.id)}
        >
          {t('locationMenu.reveal')}
        </button>
      )}
      <TokenStepper
        token="clue"
        count={location.clues}
        onStep={(delta) => void actions.adjustLocation(location.id, 'clue', delta)}
        busy={busy}
      />
      <TokenStepper
        token="doom"
        count={doom}
        onStep={(delta) => void actions.adjustLocation(location.id, 'doom', delta)}
        busy={busy}
      />
      <footer>
        <button type="button" onClick={onClose}>
          {t('locationMenu.close')}
        </button>
      </footer>
    </dialog>
  );
}

/** The count of one token on the location with − and + buttons; − is off at none. */
function TokenStepper({
  token,
  count,
  onStep,
  busy,
}: {
  token: LocationToken;
  count: number;
  onStep: (delta: number) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t(`locationMenu.${token}.label`)}>
      <p>{t(`locationMenu.${token}.count`, { count })}</p>
      <button
        type="button"
        aria-label={t(`locationMenu.${token}.remove`)}
        disabled={busy || count === 0}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <button
        type="button"
        aria-label={t(`locationMenu.${token}.add`)}
        disabled={busy}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </section>
  );
}
