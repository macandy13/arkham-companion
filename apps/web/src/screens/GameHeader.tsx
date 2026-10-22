import { useTranslation } from 'react-i18next';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardView } from '@arkham/engine';
import type { AppState, OpenGame } from '../state/appStore';
import { cluesInSeatOrder } from '../state/gameActions';
import { downloadGameExport } from './downloadFile';

/**
 * The play screen's always-on status: round and phase, the "Next" that runs the phase assistant,
 * the agenda's doom and the act's clues, the undo and the export. Its buttons wait while a step is queued (`OpenGame.busy`), since a second tap
 * would act on whatever the first one leaves open. `board` is the open game's `OpenGame.board`.
 */
export function GameHeader({
  store,
  open,
  board,
}: {
  store: StoreApi<AppState>;
  open: OpenGame;
  board: BoardView;
}) {
  const { t } = useTranslation();
  const { actions } = store.getState();
  const blocked = open.busy;

  /** The title the home screen lists the game under, so both export it under the same name. */
  function gameTitle({ gameId }: OpenGame): string {
    const { games } = store.getState();
    const index = games.findIndex((game) => game.gameId === gameId);
    return games[index]?.title || t('games.untitled', { n: games.length - index });
  }

  return (
    <header>
      <h1>{t('app.title')}</h1>
      <p>
        {t('header.roundPhase', {
          round: board.round,
          phase: t(`games.phases.${board.phase}`),
        })}
      </p>
      <button type="button" disabled={blocked} onClick={() => void actions.nextPhase()}>
        {t('header.next')}
      </button>
      <AgendaStatus store={store} board={board} blocked={blocked} />
      <ActStatus store={store} board={board} blocked={blocked} />
      <button type="button" disabled={blocked || !open.canUndo} onClick={() => void actions.undo()}>
        {t('header.undo')}
      </button>
      <button
        type="button"
        onClick={() => void downloadGameExport(store, open.gameId, gameTitle(open))}
      >
        {t('games.export')}
      </button>
    </header>
  );
}

/**
 * The current agenda as a landscape card (`data-card`, styled like the map's card faces) with the
 * doom its threshold counts (all doom in play, `doomInPlay`), and beside it steppers for the doom
 * on the agenda itself, which card effects add or the players correct.
 */
function AgendaStatus({
  store,
  board,
  blocked,
}: {
  store: StoreApi<AppState>;
  board: BoardView;
  blocked: boolean;
}) {
  const { t } = useTranslation();
  const { agenda } = board;
  if (!agenda) return null;
  const { actions } = store.getState();

  return (
    <section aria-label={t('header.agenda')}>
      <article data-card="agenda">
        <h2>{agenda.name}</h2>
        <p>
          {agenda.threshold === undefined
            ? t('header.doom', { doom: board.doomInPlay })
            : t('header.doomOf', { doom: board.doomInPlay, threshold: agenda.threshold })}
        </p>
      </article>
      <button
        type="button"
        aria-label={t('header.removeDoom')}
        disabled={blocked || agenda.doom === 0}
        onClick={() => void actions.removeDoom(1)}
      >
        −
      </button>
      <button
        type="button"
        aria-label={t('header.addDoom')}
        disabled={blocked}
        onClick={() => void actions.placeDoom(1)}
      >
        +
      </button>
    </section>
  );
}

/**
 * The current act as a landscape card with the clues the investigators hold against the clues it
 * needs, and beside it its advance once they hold enough, paid in seat order (`cluesInSeatOrder`).
 */
function ActStatus({
  store,
  board,
  blocked,
}: {
  store: StoreApi<AppState>;
  board: BoardView;
  blocked: boolean;
}) {
  const { t } = useTranslation();
  const { act } = board;
  if (!act) return null;
  const { actions } = store.getState();
  const needed = act.clues;
  return (
    <section aria-label={t('header.act')}>
      <article data-card="act">
        <h2>{act.name}</h2>
        {needed !== undefined && (
          <p>{t('header.cluesOf', { clues: board.cluesHeld, threshold: needed })}</p>
        )}
      </article>
      {needed !== undefined && (
        <button
          type="button"
          disabled={blocked || board.cluesHeld < needed}
          onClick={() => void actions.advanceAct(cluesInSeatOrder(board.investigators, needed))}
        >
          {t('header.advanceAct')}
        </button>
      )}
    </section>
  );
}
