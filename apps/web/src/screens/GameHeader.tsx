import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardView, CardImagePath, CardName } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import type { AppState, OpenGame } from '../state/appStore';

/**
 * The play screen's header, laid out like the scenario's cards on the table, centred and each under
 * its label like the playmat's: the encounter deck and its discard pile (placeholders until the
 * encounter phase draws), the agenda, the act and the scenario card. The scenario's name is the
 * screen's heading. The cards' buttons wait while a step is queued (`OpenGame.busy`), since a
 * second tap would act on whatever the first one leaves open; the agenda's and act's steppers show
 * only while the players adjust the board (`OpenGame.adjusting`). The round, the phase and the
 * buttons that run the game sit in the status row below (`GameStatus`). A tap on the agenda or act
 * opens it as a full card (`CardDetails`). `board` is the open game's `OpenGame.board`.
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
      <EncounterDeck />
      <AgendaStatus store={store} board={board} blocked={blocked} adjusting={adjusting} />
      <ActStatus store={store} board={board} blocked={blocked} adjusting={adjusting} />
      <ScenarioCard open={open} />
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
    <HeaderSlot label={t('header.encounterDeck')}>
      <div data-card="encounter" />
      <div role="img" aria-label={t('header.encounterDiscard')} data-pile="discard" />
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
  const [zoomed, setZoomed] = useState(false);
  const { agenda } = board;
  if (!agenda) return null;
  const { actions } = store.getState();
  const tokenAndPlate = (
    <>
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
    </>
  );

  return (
    <HeaderSlot label={t('header.agenda')}>
      <HeaderCard
        kind="agenda"
        name={agenda.name}
        image={agenda.image}
        onOpen={() => setZoomed(true)}
      >
        {tokenAndPlate}
      </HeaderCard>
      {zoomed && (
        <CardDetails
          kind="agenda"
          name={agenda.name}
          image={agenda.image}
          onClose={() => setZoomed(false)}
        >
          {tokenAndPlate}
        </CardDetails>
      )}
    </HeaderSlot>
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
  const [zoomed, setZoomed] = useState(false);
  const { act } = board;
  if (!act) return null;
  const { actions } = store.getState();
  const { clues, threshold } = act;
  const tokenAndPlate = (onAdvance?: () => void) => (
    <>
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
            onClick={() => {
              onAdvance?.();
              void actions.advanceAct([]);
            }}
          >
            {t('header.advanceAct')}
          </button>
        </footer>
      )}
    </>
  );

  // Advancing can raise a decision (act 3's question), and that dialog must be the only one open.
  const close = () => setZoomed(false);
  return (
    <HeaderSlot label={t('header.act')}>
      <HeaderCard kind="act" name={act.name} image={act.image} onOpen={() => setZoomed(true)}>
        {tokenAndPlate()}
      </HeaderCard>
      {zoomed && (
        <CardDetails kind="act" name={act.name} image={act.image} onClose={close}>
          {tokenAndPlate(close)}
        </CardDetails>
      )}
    </HeaderSlot>
  );
}

/**
 * A big round token on the agenda or act, like the doom and clue tokens on the table: the `count`
 * and, when the card has one, its `threshold` under it ("2 of 7"). `label` says it in words for
 * screen readers, since the token's colour alone says what it counts.
 */
function Token({
  kind,
  count,
  threshold,
  label,
}: {
  kind: 'doom' | 'clue';
  count: number;
  threshold: number | undefined;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <p role="img" aria-label={label} data-token={kind}>
      <data value={count}>{count}</data>
      {threshold !== undefined && <span>{t('header.tokenThreshold', { threshold })}</span>}
    </p>
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
 * The landscape card of the agenda or act (`kind`) in the header: its name band and, as
 * `children`, its token and plate. A tap on the card, or on its name, which is a button for the
 * keyboard, calls `onOpen`; a tap on the plate's buttons only does what the button says.
 */
function HeaderCard({
  kind,
  name,
  image,
  onOpen,
  children,
}: {
  kind: 'agenda' | 'act';
  name: CardName;
  image: CardImagePath | undefined;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <CardFace
      kind={kind}
      image={image}
      onClick={(event) => {
        if (!(event.target instanceof Element && event.target.closest('button'))) onOpen();
      }}
    >
      <h2>
        <button type="button" onClick={onOpen}>
          {name}
        </button>
      </h2>
      {children}
    </CardFace>
  );
}

/**
 * The agenda or act (`kind`) as a full card in a dialog, as big as a zoomed card: the same face as
 * in the header with its picture large, its name as the dialog's title, and its token and plate
 * (`children`) with their buttons. The card text joins it once the card data has text. A native
 * modal `<dialog>` brings focus trapping and Escape.
 */
function CardDetails({
  kind,
  name,
  image,
  onClose,
  children,
}: {
  kind: 'agenda' | 'act';
  name: CardName;
  image: CardImagePath | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="card">
      <button type="button" data-icon="close" aria-label={t('header.close')} onClick={onClose} />
      <CardFace kind={kind} image={image}>
        <h2 id={titleId}>{name}</h2>
        {children}
      </CardFace>
    </dialog>
  );
}

/**
 * The face of the agenda or act (`kind`), holding its name band, token and plate (`children`).
 * When its side has a picture (`image`), the picture fills the card once it has loaded
 * (`data-picture`), and the stylesheet hides the name band the picture prints; the token and
 * plate stay, since their count and buttons are live.
 */
function CardFace({
  kind,
  image,
  onClick,
  children,
}: {
  kind: 'agenda' | 'act';
  image: CardImagePath | undefined;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const picture = useCardPicture(image);
  return (
    <div data-card={kind} data-picture={picture?.shown ? 'shown' : undefined} onClick={onClick}>
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      {children}
    </div>
  );
}
