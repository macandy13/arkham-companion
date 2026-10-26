import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardView, CardImagePath } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import { EncounterPiles } from '../encounter/EncounterPiles';
import type { AppState, OpenGame } from '../state/appStore';
import { Token } from './Token';

/**
 * The play screen's header, laid out like the scenario's cards on the table, centred and each under
 * its label like the playmat's: the encounter deck and its discard pile, the agenda, the act and
 * the scenario card. The scenario's name is the screen's heading. The cards' buttons wait while a step is queued (`OpenGame.busy`), since a
 * second tap would act on whatever the first one leaves open; the agenda's and act's steppers show
 * only while the players adjust the board (`OpenGame.adjusting`). The round, the phase and the
 * buttons that run the game sit in the status row below (`GameStatus`). `board` is the open game's
 * `OpenGame.board`.
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
  const blocked = open.busy;
  const { adjusting } = open;

  return (
    <header>
      <EncounterDeck board={board} />
      <AgendaStatus store={store} board={board} blocked={blocked} adjusting={adjusting} />
      <ActStatus store={store} board={board} blocked={blocked} adjusting={adjusting} />
      <ScenarioCard open={open} />
    </header>
  );
}

/**
 * The encounter deck and its discard pile (`EncounterPiles`) under the playmat's label.
 */
function EncounterDeck({ board }: { board: BoardView }) {
  const { t } = useTranslation();
  return (
    <HeaderSlot label={t('header.encounterDeck')}>
      <EncounterPiles board={board} />
    </HeaderSlot>
  );
}

/**
 * The scenario as an upright card, like the reference card on the table. Its name
 * (`OpenGame.scenarioNameKey`) is the screen's heading, since the play screen shows no app title:
 * the scenario is what the players are playing.
 */
function ScenarioCard({ open }: { open: OpenGame }) {
  const { t } = useTranslation();
  return (
    <HeaderSlot label={t('header.scenario')}>
      <div data-card="scenario">
        <h1>{open.scenarioNameKey ? t(open.scenarioNameKey) : t('header.scenario')}</h1>
      </div>
    </HeaderSlot>
  );
}

/**
 * The current agenda as a landscape card (`data-card`, styled like the map's card faces): its
 * name, a big doom token with the doom its threshold counts (all doom in play, `doomInPlay`) and,
 * while adjusting, steppers on the plate at its foot for the doom on the agenda itself, which card
 * effects add or the players correct. The buttons sit on the card to keep the header compact.
 */
function AgendaStatus({
  store,
  board,
  blocked,
  adjusting,
}: {
  store: StoreApi<AppState>;
  board: BoardView;
  blocked: boolean;
  adjusting: boolean;
}) {
  const { t } = useTranslation();
  const { agenda } = board;
  if (!agenda) return null;
  const { actions } = store.getState();

  return (
    <HeaderCard kind="agenda" label={t('header.agenda')} image={agenda.image}>
      <h2>{agenda.name}</h2>
      <Token
        kind="doom"
        count={board.doomInPlay}
        threshold={agenda.threshold}
        label={
          agenda.threshold === undefined
            ? t('header.doom', { doom: board.doomInPlay })
            : t('header.doomOf', { doom: board.doomInPlay, threshold: agenda.threshold })
        }
      />
      {adjusting && (
        <footer>
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
      )}
    </HeaderCard>
  );
}

/**
 * The current act as a landscape card: its name, a big clue token with the clues on the act against
 * the clues it needs, and on the plate at its foot steppers for them while adjusting and its
 * advance once there are enough, paid by the clues on the act. The steppers are a correction by
 * hand that leaves the investigators alone, until a dialog moves clues onto the act from the
 * investigators the players pick. Advancing is play, not a correction, so it waits while the
 * players adjust.
 */
function ActStatus({
  store,
  board,
  blocked,
  adjusting,
}: {
  store: StoreApi<AppState>;
  board: BoardView;
  blocked: boolean;
  adjusting: boolean;
}) {
  const { t } = useTranslation();
  const { act } = board;
  if (!act) return null;
  const { actions } = store.getState();
  const { clues, threshold } = act;
  return (
    <HeaderCard kind="act" label={t('header.act')} image={act.image}>
      <h2>{act.name}</h2>
      {threshold !== undefined && (
        <Token
          kind="clue"
          count={clues}
          threshold={threshold}
          label={t('header.cluesOf', { clues, threshold })}
        />
      )}
      {threshold !== undefined && (
        <footer>
          {adjusting && (
            <>
              <button
                type="button"
                aria-label={t('header.removeClue')}
                disabled={blocked || clues === 0}
                onClick={() => void actions.adjustActClues(-1)}
              >
                −
              </button>
              <button
                type="button"
                aria-label={t('header.addClue')}
                disabled={blocked}
                onClick={() => void actions.adjustActClues(1)}
              >
                +
              </button>
            </>
          )}
          <button
            type="button"
            disabled={blocked || adjusting || clues < threshold}
            onClick={() => void actions.advanceAct([])}
          >
            {t('header.advanceAct')}
          </button>
        </footer>
      )}
    </HeaderCard>
  );
}

/**
 * One place of the header: the playmat's `label` over the card or cards (`children`) that lie
 * there. The label names the place for screen readers too.
 */
function HeaderSlot({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <p id={id}>{label}</p>
      {children}
    </section>
  );
}

/**
 * The landscape card of the agenda or act (`kind`) under its `label`, holding its name band, token
 * and plate (`children`). When its side has a picture (`image`), the picture fills the card once
 * it has loaded (`data-picture`), and the stylesheet hides the name band the picture prints; the
 * token and plate stay, since their count and buttons are live.
 */
function HeaderCard({
  kind,
  label,
  image,
  children,
}: {
  kind: 'agenda' | 'act';
  label: string;
  image: CardImagePath | undefined;
  children: ReactNode;
}) {
  const picture = useCardPicture(image);
  return (
    <HeaderSlot label={label}>
      <div data-card={kind} data-picture={picture?.shown ? 'shown' : undefined}>
        {picture && (
          <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
        )}
        {children}
      </div>
    </HeaderSlot>
  );
}
