import { useTranslation } from 'react-i18next';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState, OpenGame } from '../state/appStore';

/**
 * The play screen's always-on status: round and phase, the "Next" that runs the phase assistant
 * and the undo. Its buttons wait while a step is queued (`OpenGame.busy`), since a second tap
 * would act on whatever the first one leaves open, and stay off for a game that can only be shown.
 */
export function GameHeader({ store, open }: { store: StoreApi<AppState>; open?: OpenGame }) {
  const { t } = useTranslation();
  const { actions } = store.getState();
  const blocked = !open?.playable || open.busy;

  return (
    <header>
      <h1>{t('app.title')}</h1>
      <p>
        {open
          ? t('header.roundPhase', {
              round: open.state.meta.round,
              phase: t(`games.phases.${open.state.meta.phase}`),
            })
          : t('header.noGame')}
      </p>
      <button type="button" disabled={blocked} onClick={() => void actions.nextPhase()}>
        {t('header.next')}
      </button>
      <button type="button" disabled={blocked || !open.canUndo} onClick={() => void actions.undo()}>
        {t('header.undo')}
      </button>
    </header>
  );
}
