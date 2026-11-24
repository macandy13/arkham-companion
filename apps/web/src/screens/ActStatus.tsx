import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ActAdvance, type ActView, type BoardView } from '@arkham/engine';
import { HeaderPile, type PileProps } from '../encounter/EncounterPiles';
import { CardActions, cardActionsOn } from './ActionRow';
import { ConfirmDialog } from './ConfirmDialog';
import { useCluePayment } from './CluePaymentDialog';
import { Token } from './Token';
import type { HeaderCardKind } from './useDetailView';
import { usePlay } from './PlayContext';
import { HeaderSlot, HeaderCard, BookDetails } from './HeaderSlot';

/**
 * The current act as a landscape card: its name, a big clue token with the clues that count towards
 * advancing it against the clues it needs (`ActAdvance`), and a plate at its foot. For an act the
 * investigators advance by spending clues, the token counts the clues they hold and the plate has
 * its advance, the act's own action, which the investigator whose turn it is takes once they hold
 * enough, after the players choose who pays when they can (`useCluePayment`). For an act
 * that advances itself once clues lie on it, the token counts those, and a double tap opens their
 * − / + bubble, a correction by hand. Once cards lie beneath it, they are fanned at its corner
 * like the discard pile at the deck's (`HeaderPile`), and a tap opens them in the encounter dialog. Its full card also offers "Advance by hand", after a
 * confirmation, for an objective the engine leaves to the players.
 */
export function ActStatus({
  board,
  full,
  piles,
  onOpen,
}: {
  board: BoardView;
  full: boolean;
  piles: PileProps;
  onOpen: ((card: HeaderCardKind) => void) | undefined;
}) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { dialog, pay } = useCluePayment(board);
  const { act } = board;
  if (!act) return null;
  // Advancing can raise a decision (act 3's question), and that dialog must be the only one open.
  const close = () => setZoomed(false);
  const offered = cardActionsOn(board, act.id);
  const actionRow = offered.length > 0 && (
    <CardActions board={board} offered={offered} onUse={close} />
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
  const counter = t('header.clueCount');
  // Only for clues lying on the act: the clues the investigators hold are on their cards.
  const bubble =
    advance?.kind === 'cluesOnAct'
      ? {
          title: t('header.counterBubble', { card: act.name, counter }),
          counts: [
            {
              label: counter,
              value: String(act.clues),
              lower: { label: t('header.removeClue'), disabled: busy || act.clues === 0 },
              raise: { label: t('header.addClue'), disabled: busy },
              onStep: (delta: -1 | 1) =>
                void actions.correct({ kind: 'tokens', cardId: act.id, token: 'clue', delta }),
            },
          ],
        }
      : undefined;
  /** The act's advance, for an act the investigators advance by spending clues (`primary` in its full card). */
  const advanceButton = (onAdvance?: () => void, primary = false) =>
    advance?.kind === 'spendClues' && (
      <button
        type="button"
        data-primary={primary || undefined}
        disabled={busy || board.turn === undefined || advance.held < advance.threshold}
        onClick={() =>
          pay(advance.threshold, act.id, (spend) => {
            onAdvance?.();
            void actions.advanceAct(spend);
          })
        }
      >
        {t('header.advanceAct')}
      </button>
    );
  // Every act has it, since an objective the engine leaves to the players can only be met by hand.
  const byHandButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        close();
        setConfirming(true);
      }}
    >
      {t('header.advanceActByHand')}
    </button>
  );
  const tokenAndPlate = advance && (
    <>
      {clueToken}
      <footer>{advanceButton()}</footer>
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
        bubble={bubble}
      >
        {tokenAndPlate}
      </HeaderCard>
      {board.encounter.beneathAct.length > 0 && <HeaderPile pile="beneathAct" {...piles} />}
      {full && (
        <footer>
          {actionRow}
          {byHandButton}
        </footer>
      )}
      {zoomed && !full && (
        <BookDetails
          kind="act"
          board={board}
          card={board.cardFace(act.id)}
          threshold={advance?.threshold}
          token={clueToken}
          {...(advance && clues !== undefined
            ? {
                value: {
                  name: t(advance.kind === 'cluesOnAct' ? 'header.cluesOnAct' : 'header.cluesHeld'),
                  count: clues,
                  threshold: advance.threshold,
                },
              }
            : {})}
          advances={
            <>
              {advanceButton(close, true)}
              {byHandButton}
            </>
          }
          onClose={close}
        />
      )}
      {confirming && (
        <ConfirmDialog
          title={t('header.advanceActByHandTitle', { act: act.name })}
          confirmLabel={t('header.advanceActByHand')}
          onConfirm={() => {
            setConfirming(false);
            void actions.perform({ type: 'Advance', deck: 'act' });
          }}
          onCancel={() => setConfirming(false)}
        >
          <p>{t('header.advanceActByHandText')}</p>
        </ConfirmDialog>
      )}
      {dialog}
    </HeaderSlot>
  );
}

/**
 * The clues that count towards advancing the act (`advance`, its `ActAdvance`): those the
 * investigators hold for an act they advance by spending clues, else those lying on it.
 */
export function actClues(act: ActView, advance: ActAdvance): number {
  return advance.kind === 'cluesOnAct' ? act.clues : advance.held;
}
