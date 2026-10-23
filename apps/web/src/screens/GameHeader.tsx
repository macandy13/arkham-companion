import { useTranslation } from 'react-i18next';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardView, InvestigatorView } from '@arkham/engine';
import type { AppState, OpenGame } from '../state/appStore';
import { cluesInSeatOrder } from '../state/gameActions';

/**
 * The play screen's always-on status, laid out like the scenario's cards on the table: the
 * encounter deck and its discard pile (placeholders until the encounter phase draws), the agenda,
 * the act and the scenario card, then "Next", which runs the phase assistant, and undo. The
 * scenario's name is the screen's heading, since the app title already sits in the title bar. Its
 * buttons wait while a step is queued (`OpenGame.busy`), since a second tap would act on whatever
 * the first one leaves open. `board` is the open game's `OpenGame.board`.
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

  return (
    <header>
      <EncounterDeck />
      <AgendaStatus store={store} board={board} blocked={blocked} />
      <ActStatus store={store} board={board} blocked={blocked} />
      <ScenarioCard open={open} board={board} />
      <button type="button" disabled={blocked} onClick={() => void actions.nextPhase()}>
        {t('header.next')}
      </button>
      <button type="button" disabled={blocked || !open.canUndo} onClick={() => void actions.undo()}>
        {t('header.undo')}
      </button>
    </header>
  );
}

/**
 * The encounter deck as an upright card back and its discard pile as a small card outline beside
 * it. Both are placeholders until the encounter phase draws cards, so they show no counts yet.
 */
function EncounterDeck() {
  const { t } = useTranslation();
  return (
    <>
      <section aria-label={t('header.encounterDeck')} data-card="encounter">
        <p>{t('header.encounterDeck')}</p>
      </section>
      <div role="img" aria-label={t('header.encounterDiscard')} data-pile="discard" />
    </>
  );
}

/**
 * The scenario as a landscape card: its name (`OpenGame.scenarioNameKey`) is the screen's heading,
 * since the app title already sits in the title bar, and its plate shows the round and phase.
 */
function ScenarioCard({ open, board }: { open: OpenGame; board: BoardView }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('header.scenario')} data-card="scenario">
      <h1>{open.scenarioNameKey ? t(open.scenarioNameKey) : t('header.scenario')}</h1>
      <footer>
        <p>
          {t('header.roundPhase', {
            round: board.round,
            phase: t(`games.phases.${board.phase}`),
          })}
        </p>
      </footer>
    </section>
  );
}

/**
 * The current agenda as a landscape card (`data-card`, styled like the map's card faces): its
 * name, and on the plate at its foot the doom its threshold counts (all doom in play,
 * `doomInPlay`) with steppers for the doom on the agenda itself, which card effects add or the
 * players correct. The buttons sit on the card to keep the header compact.
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
    <section aria-label={t('header.agenda')} data-card="agenda">
      <h2>{agenda.name}</h2>
      <footer>
        <p>
          {agenda.threshold === undefined
            ? t('header.doom', { doom: board.doomInPlay })
            : t('header.doomOf', { doom: board.doomInPlay, threshold: agenda.threshold })}
        </p>
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
      </footer>
    </section>
  );
}

/**
 * The current act as a landscape card: its name, and on the plate at its foot the clues the
 * investigators hold against the clues it needs, with its advance once they hold enough, paid in
 * seat order (`cluesInSeatOrder`). Its steppers correct the clues of the investigator whose turn it
 * is, or of the lead investigator between turns (`clueHolder`), until a dialog lets the players pick
 * whose clues change.
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
  const holder = clueHolder(board);
  return (
    <section aria-label={t('header.act')} data-card="act">
      <h2>{act.name}</h2>
      {needed !== undefined && (
        <footer>
          <p>{t('header.cluesOf', { clues: board.cluesHeld, threshold: needed })}</p>
          <button
            type="button"
            aria-label={t('header.removeClue')}
            disabled={blocked || !holder || holder.clues === 0}
            onClick={() => holder && void actions.adjust(holder.id, 'clues', -1)}
          >
            −
          </button>
          <button
            type="button"
            aria-label={t('header.addClue')}
            disabled={blocked || !holder}
            onClick={() => holder && void actions.adjust(holder.id, 'clues', 1)}
          >
            +
          </button>
          <button
            type="button"
            disabled={blocked || board.cluesHeld < needed}
            onClick={() => void actions.advanceAct(cluesInSeatOrder(board.investigators, needed))}
          >
            {t('header.advanceAct')}
          </button>
        </footer>
      )}
    </section>
  );
}

/** Whose clues the act's steppers change: the investigator whose turn it is, else the lead. */
function clueHolder(board: BoardView): InvestigatorView | undefined {
  const id = board.turn ?? board.lead;
  return board.investigators.find((investigator) => investigator.id === id);
}
