import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoreApi } from 'zustand/vanilla';
import {
  cardImagePath,
  type ActAdvance,
  type ActView,
  type BoardView,
  type CardFaceView,
  type CardImagePath,
  type CardName,
  type EncounterSetCode,
  type ReferenceView,
} from '@arkham/engine';
import type { CardCatalog, ReferenceSideTexts } from '@arkham/carddata';
import { useCardPicture } from '../catalog/cardImages';
import { cardText } from '../catalog/cardText';
import { EncounterPiles, HeaderPile, type PileProps } from '../encounter/EncounterPiles';
import type { AppState, OpenGame } from '../state/appStore';
import type { GameActions } from '../state/gameActions';
import { ActionGroup, CardActions, cardActionsOn } from './ActionRow';
import { BookFace } from './BookFace';
import { ScenarioFace } from './ScenarioFace';
import { useCluePayment } from './CluePaymentDialog';
import { DetailsDialog, useDecisionHost } from './DetailsDialog';
import { Token } from './Token';
import type { HeaderCardKind } from './useDetailView';

/**
 * The play screen's header, laid out like the scenario's cards on the table, centred and each under
 * its label like the playmat's: the encounter deck and its discard pile, the agenda, the act and
 * the scenario card. The scenario's name is the screen's heading. The cards' buttons wait while a
 * step is queued (`OpenGame.busy`), since a second tap would act on whatever the first one leaves
 * open; the agenda's and act's steppers show only while the players adjust the board
 * (`OpenGame.adjusting`). The round, the phase and the buttons that run the game sit in the status
 * row below (`GameStatus`). A tap on the agenda or act opens it on the card shell (`BookDetails`).
 * `board` is the open game's `OpenGame.board`. On a phone's compact view a tap on any of the four
 * cards calls `onOpenCard` instead (the detail view opens on it), so the card's own buttons and
 * dialogs wait for the detail view. There the cards show `full`: the agenda and act are already
 * as large as the screen allows, so their action rows sit under them and a tap opens no second,
 * full-card dialog. `printedReference` is what the card catalog prints on the scenario card's
 * side in play; until it has loaded the card shows its rows without texts.
 */
export function GameHeader({
  store,
  open,
  board,
  printedReference,
  onOpenCard,
  full = false,
}: {
  store: StoreApi<AppState>;
  open: OpenGame;
  board: BoardView;
  printedReference: PrintedReference | undefined;
  onOpenCard?: ((card: HeaderCardKind) => void) | undefined;
  full?: boolean;
}) {
  const { t } = useTranslation();
  const blocked = open.busy;
  const { adjusting } = open;
  const piles: PileProps = {
    board,
    actions: store.getState().actions,
    busy: blocked,
    adjusting,
    onSpawn: (enemy) => store.getState().startSpawn(enemy),
  };

  return (
    <header>
      <HeaderSlot label={t('header.encounterDeck')} card="encounter" onOpen={onOpenCard}>
        <EncounterPiles {...piles} />
      </HeaderSlot>
      <AgendaStatus
        store={store}
        board={board}
        blocked={blocked}
        adjusting={adjusting}
        full={full}
        onOpen={onOpenCard}
      />
      <ActStatus
        store={store}
        board={board}
        blocked={blocked}
        adjusting={adjusting}
        full={full}
        onOpen={onOpenCard}
      />
      <HeaderSlot label={t('header.scenario')} card="scenario" onOpen={onOpenCard}>
        <ScenarioStatus
          open={open}
          board={board}
          printed={printedReference}
          opens={!onOpenCard && !full}
        />
        <HeaderPile pile="setAside" {...piles} />
      </HeaderSlot>
      <HeaderSlot label={t('header.victory')}>
        <HeaderPile pile="victoryDisplay" {...piles} />
      </HeaderSlot>
    </header>
  );
}

/**
 * What the card catalog has for the side of the scenario reference card a game plays with
 * (`BoardView.reference`): its printed texts and its picture (`ReferencePictures`), each absent
 * until the catalog has loaded or when the card data has none.
 */
export interface PrintedReference {
  texts?: ReferenceSideTexts;
  picture?: CardImagePath;
}

/** What `catalog` has for the side of the reference card that `reference` names (`PrintedReference`). */
export function printedReferenceOf(
  catalog: CardCatalog,
  reference: ReferenceView,
): PrintedReference {
  const { code, side } = reference;
  const picture = catalog.referencePictures?.[code]?.[side];
  return {
    texts: catalog.references?.[code]?.[side],
    picture: picture === undefined ? undefined : cardImagePath(picture),
  };
}

/**
 * The scenario as an upright card, like the reference card on the table (`ScenarioCard`). Its name
 * (`OpenGame.scenarioNameKey`) is the screen's heading, since the play screen shows no app title:
 * the scenario is what the players are playing. Where the card `opens`, a tap on it, or on its
 * name, which is a button for the keyboard, opens it as a full card to read its rows.
 */
function ScenarioStatus({
  open,
  board,
  printed,
  opens,
}: {
  open: OpenGame;
  board: BoardView;
  printed: PrintedReference | undefined;
  opens: boolean;
}) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const name = open.scenarioNameKey ? t(open.scenarioNameKey) : t('header.scenario');
  const zoom = () => setZoomed(true);
  return (
    <>
      <ScenarioCard
        reference={board.reference}
        printed={printed}
        onClick={opens ? zoom : undefined}
      >
        <h1>
          {opens ? (
            <button type="button" onClick={zoom}>
              {name}
            </button>
          ) : (
            name
          )}
        </h1>
      </ScenarioCard>
      {zoomed && (
        <ScenarioDetails
          name={name}
          reference={board.reference}
          printed={printed}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
}

/**
 * The scenario's full card (`ScenarioStatus`), as big as a zoomed card: the same face as in the
 * header, where the rows' texts are too small to read.
 */
function ScenarioDetails({
  name,
  reference,
  printed,
  onClose,
}: {
  name: string;
  reference: ReferenceView | undefined;
  printed: PrintedReference | undefined;
  onClose: () => void;
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
      <ScenarioCard reference={reference} printed={printed}>
        <h2 id={titleId}>{name}</h2>
      </ScenarioCard>
    </dialog>
  );
}

/**
 * The face of the scenario reference card: in the Exact card theme our drawing of its frame
 * (`ScenarioFace`) under its title (`children`), the side the game's difficulty plays with and one
 * row per symbol token, the token's game symbol (named for screen readers) beside its printed
 * text (`printed`, from the card catalog, for the side `BoardView.reference` names). A game without
 * a reference card shows only the title. In the card pictures theme the side's picture lies over
 * it all once loaded (`data-picture`), and the stylesheet hides what the picture prints; the
 * rows stay beneath it for assistive technology.
 */
function ScenarioCard({
  reference,
  printed,
  onClick,
  children,
}: {
  reference: ReferenceView | undefined;
  printed: PrintedReference | undefined;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const picture = useCardPicture(printed?.picture, 'portrait');
  return (
    <div
      data-card="scenario"
      data-picture={picture?.shown ? 'shown' : undefined}
      onClick={
        onClick &&
        ((event) => {
          if (!(event.target instanceof Element && event.target.closest('button'))) onClick();
        })
      }
    >
      <ScenarioFace set={reference?.encounterSet} />
      {children}
      {reference && (
        <>
          <p>{t(`header.referenceSide.${reference.side}`)}</p>
          <ul aria-label={t('header.reference')}>
            {reference.rows.map(({ token }) => {
              const text = printed?.texts?.[token];
              return (
                <li key={token} data-chaos-token={token}>
                  <span role="img" aria-label={t(`chaosToken.${token}`)} />
                  {text !== undefined && <p>{cardText(text)}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
    </div>
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
  full,
  onOpen,
}: {
  store: StoreApi<AppState>;
  board: BoardView;
  blocked: boolean;
  adjusting: boolean;
  full: boolean;
  onOpen: ((card: HeaderCardKind) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const { agenda } = board;
  if (!agenda) return null;
  const { actions } = store.getState();
  const close = () => setZoomed(false);
  const offered = adjusting ? [] : cardActionsOn(board, agenda.id);
  const actionRow = offered.length > 0 && (
    <CardActions board={board} offered={offered} actions={actions} busy={blocked} onUse={close} />
  );
  const doomToken = (
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
  );
  const doomSteppers = (
    <>
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
    </>
  );
  const tokenAndPlate = (
    <>
      {doomToken}
      {adjusting && <footer>{doomSteppers}</footer>}
    </>
  );

  return (
    <HeaderSlot label={t('header.agenda')} card="agenda" onOpen={onOpen}>
      <HeaderCard
        kind="agenda"
        name={agenda.name}
        image={agenda.image}
        set={agenda.encounterSet}
        threshold={agenda.threshold}
        onOpen={full ? undefined : () => setZoomed(true)}
      >
        {tokenAndPlate}
      </HeaderCard>
      {full && actionRow && <footer>{actionRow}</footer>}
      {zoomed && !full && (
        <BookDetails
          kind="agenda"
          board={board}
          actions={actions}
          busy={blocked}
          card={board.cardFace(agenda.id)}
          threshold={agenda.threshold}
          token={doomToken}
          value={{
            name: t('header.doomName'),
            count: board.doomInPlay,
            ...(agenda.threshold === undefined ? {} : { threshold: agenda.threshold }),
          }}
          corrections={
            adjusting && <ActionGroup title={t('header.onAgenda')}>{doomSteppers}</ActionGroup>
          }
          onClose={close}
        />
      )}
    </HeaderSlot>
  );
}

/**
 * The current act as a landscape card: its name, a big clue token with the clues that count towards
 * advancing it against the clues it needs (`ActAdvance`), and a plate at its foot. For an act the
 * investigators advance by spending clues, the token counts the clues they hold and the plate has
 * its advance, the act's own action, which the investigator whose turn it is takes once they hold
 * enough, after the players choose who pays when they can (`useCluePayment`); advancing is play,
 * not a correction, so it waits while the players adjust. For an act
 * that advances itself once clues lie on it, the token counts those and the plate has steppers for
 * them while adjusting, a correction by hand.
 */
function ActStatus({
  store,
  board,
  blocked,
  adjusting,
  full,
  onOpen,
}: {
  store: StoreApi<AppState>;
  board: BoardView;
  blocked: boolean;
  adjusting: boolean;
  full: boolean;
  onOpen: ((card: HeaderCardKind) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const { dialog, pay } = useCluePayment(board);
  const { act } = board;
  if (!act) return null;
  // Advancing can raise a decision (act 3's question), and that dialog must be the only one open.
  const close = () => setZoomed(false);
  const { actions } = store.getState();
  const offered = adjusting ? [] : cardActionsOn(board, act.id);
  const actionRow = offered.length > 0 && (
    <CardActions board={board} offered={offered} actions={actions} busy={blocked} onUse={close} />
  );
  const { advance } = act;
  const clues = advance && actClues(act, advance);
  const clueToken = advance && clues !== undefined && (
    <Token
      kind="clue"
      count={clues}
      threshold={advance.threshold}
      label={t('header.cluesOf', { clues, threshold: advance.threshold })}
    />
  );
  const clueSteppers = advance?.kind === 'cluesOnAct' && adjusting && (
    <>
      <button
        type="button"
        aria-label={t('header.removeClue')}
        disabled={blocked || act.clues === 0}
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
  );
  /** The act's advance, for an act the investigators advance by spending clues (`primary` in its full card). */
  const advanceButton = (onAdvance?: () => void, primary = false) =>
    advance?.kind === 'spendClues' && (
      <button
        type="button"
        data-primary={primary || undefined}
        disabled={
          blocked || adjusting || board.turn === undefined || advance.held < advance.threshold
        }
        onClick={() =>
          pay(advance.threshold, t('cluePayment.advanceTitle', { act: act.name }), (spend) => {
            onAdvance?.();
            void actions.advanceAct(spend);
          })
        }
      >
        {t('header.advanceAct')}
      </button>
    );
  const tokenAndPlate = advance && (
    <>
      {clueToken}
      <footer>
        {clueSteppers}
        {advanceButton()}
      </footer>
    </>
  );

  return (
    <HeaderSlot label={t('header.act')} card="act" onOpen={onOpen}>
      <HeaderCard
        kind="act"
        name={act.name}
        image={act.image}
        set={act.encounterSet}
        threshold={advance?.threshold}
        onOpen={full ? undefined : () => setZoomed(true)}
      >
        {tokenAndPlate}
      </HeaderCard>
      {full && actionRow && <footer>{actionRow}</footer>}
      {zoomed && !full && (
        <BookDetails
          kind="act"
          board={board}
          actions={actions}
          busy={blocked}
          card={board.cardFace(act.id)}
          threshold={advance?.threshold}
          token={clueToken}
          {...(advance && clues !== undefined
            ? {
                value: {
                  name: t(advance.kind === 'spendClues' ? 'header.cluesHeld' : 'header.cluesOnAct'),
                  count: clues,
                  threshold: advance.threshold,
                },
              }
            : {})}
          corrections={
            clueSteppers && <ActionGroup title={t('header.onAct')}>{clueSteppers}</ActionGroup>
          }
          primary={advanceButton(close, true)}
          onClose={close}
        />
      )}
      {dialog}
    </HeaderSlot>
  );
}

/**
 * One place of the header: the playmat's `label` over the card or cards (`children`) that lie
 * there. The label names the place for screen readers too. With `onOpen` (the phone's compact
 * view), a tap anywhere in the place, its buttons included, opens the detail view on its `card`
 * instead: the tap is caught before it reaches them.
 */
function HeaderSlot({
  label,
  card,
  onOpen,
  children,
}: {
  label: string;
  card?: HeaderCardKind;
  onOpen?: ((card: HeaderCardKind) => void) | undefined;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      data-slot={card}
      onClickCapture={
        card &&
        onOpen &&
        ((event) => {
          event.stopPropagation();
          onOpen(card);
        })
      }
    >
      <p id={id}>{label}</p>
      {children}
    </section>
  );
}

/**
 * The landscape card of the agenda or act (`kind`) in the header: its face printing `threshold`,
 * its name and, as `children`, its token and plate. A tap on the card, or on its name, which is a button for the
 * keyboard, calls `onOpen`; a tap on the plate's buttons only does what the button says. Without
 * `onOpen` (the card shown full) the name is plain text and a tap does nothing.
 */
function HeaderCard({
  kind,
  name,
  image,
  set,
  threshold,
  onOpen,
  children,
}: {
  kind: 'agenda' | 'act';
  name: CardName;
  image: CardImagePath | undefined;
  set: EncounterSetCode | undefined;
  threshold: number | undefined;
  onOpen: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <CardFace
      kind={kind}
      image={image}
      set={set}
      threshold={threshold}
      onClick={
        onOpen &&
        ((event) => {
          if (!(event.target instanceof Element && event.target.closest('button'))) onOpen();
        })
      }
    >
      <h2>
        {onOpen ? (
          <button type="button" onClick={onOpen}>
            {name}
          </button>
        ) : (
          name
        )}
      </h2>
      {children}
    </CardFace>
  );
}

/**
 * The agenda or act (`kind`) opened from the header, on the card shell (`DetailsDialog`, MD.6b2):
 * - the landscape card over the page, the same face as in the header with its `token`, tapped to
 *   read it whole (`CardZoom`);
 * - what it is as the kicker, its name as the title;
 * - its count on the page (`value`: the doom in play, the clues that count towards advancing);
 * - while the players adjust, its steppers (`corrections`);
 * - the card actions it offers the investigator whose turn it is;
 * - the act's Advance as the dialog's one primary (`primary`).
 * A card action keeps it open and shows the decision it raises in place of its page
 * (`useDecisionHost`); Advance closes it first, since the act it was about is gone. The card text
 * joins it once the card data has text.
 */
function BookDetails({
  kind,
  board,
  actions,
  busy,
  card,
  threshold,
  token,
  value,
  corrections,
  primary,
  onClose,
}: {
  kind: 'agenda' | 'act';
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  card: CardFaceView;
  threshold: number | undefined;
  token: ReactNode;
  value?: { name: string; count: number; threshold?: number };
  corrections: ReactNode;
  primary?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hosted = useDecisionHost();
  const offered = cardActionsOn(board, card.id);
  return (
    <DetailsDialog
      board={board}
      actions={actions}
      busy={busy}
      hosted={hosted}
      name="book"
      card={card}
      drawn={
        <CardFace kind={kind} image={card.image} set={card.encounterSet} threshold={threshold}>
          {/* Inside the card's button, so its name is no second heading; the page's title is. */}
          <span data-part="name">{card.name}</span>
          {token}
        </CardFace>
      }
      kicker={t(`header.${kind}`)}
      title={card.name}
      onClose={onClose}
    >
      {value && (
        <dl>
          <div>
            <dt>{value.name}</dt>
            <dd>
              {value.threshold === undefined
                ? value.count
                : t('header.countOf', { count: value.count, threshold: value.threshold })}
            </dd>
          </div>
        </dl>
      )}
      {(corrections || offered.length > 0 || primary) && (
        <footer>
          {corrections}
          {offered.length > 0 && (
            <CardActions
              board={board}
              offered={offered}
              actions={actions}
              busy={busy}
              onUse={hosted.host}
            />
          )}
          {primary}
        </footer>
      )}
    </DetailsDialog>
  );
}

/**
 * The face of the agenda or act (`kind`), holding its name, token and plate (`children`): in the
 * Exact card theme our drawing of the printed card (`BookFace`) with its `threshold` on the disc,
 * the art cut from its picture (`image`) once it has loaded (`data-picture`), the name on the
 * page and the token as the count on the disc. In the card pictures theme the whole picture lies
 * over the drawing once loaded, and the stylesheet hides the name the picture prints; the token
 * and plate stay, since their count and buttons are live.
 */
function CardFace({
  kind,
  image,
  set,
  threshold,
  onClick,
  children,
}: {
  kind: 'agenda' | 'act';
  image: CardImagePath | undefined;
  set: EncounterSetCode | undefined;
  threshold: number | undefined;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const picture = useCardPicture(image, 'landscape');
  return (
    <div data-card={kind} data-picture={picture?.shown ? 'shown' : undefined} onClick={onClick}>
      <BookFace kind={kind} picture={picture} threshold={threshold} set={set} />
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      {children}
    </div>
  );
}

/**
 * The clues that count towards advancing the act (`advance`, its `ActAdvance`): those the
 * investigators hold for an act they advance by spending clues, else those lying on it.
 */
export function actClues(act: ActView, advance: ActAdvance): number {
  return advance.kind === 'spendClues' ? advance.held : act.clues;
}
