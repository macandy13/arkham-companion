import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardView,
  CardFaceView,
  CluePayerView,
  InstanceId,
  InvestigatorId,
} from '@arkham/engine';
import { InvestigatorArt } from '../investigators/InvestigatorArt';
import { CardDialog } from './CardDialog';
import './clue_payment.css';
import type { ClueSpend } from '../state/gameActions';

/**
 * Whether the players have a split to choose for a group clue cost of `required`: more than one of
 * `payers` holds clues and together they hold more than it asks. Otherwise the engine's split is
 * the only one, and the action is taken at once.
 */
export function offersClueSplit(payers: readonly CluePayerView[], required: number): boolean {
  const holders = payers.filter(({ clues }) => clues > 0);
  const held = holders.reduce((sum, { clues }) => sum + clues, 0);
  return holders.length > 1 && held > required;
}

/**
 * The clues each of `payers` pays when `required` clues are split as evenly as their clues allow:
 * one each in turn, in `payers` order, skipping whoever has none left, until `required` are taken
 * or nobody has any left.
 */
export function evenClueSplit(
  payers: readonly CluePayerView[],
  required: number,
): ReadonlyMap<InvestigatorId, number> {
  const pays = new Map(payers.map(({ id }) => [id, 0]));
  let left = required;
  while (left > 0) {
    const takers = payers.filter(({ id, clues }) => (pays.get(id) ?? 0) < clues);
    if (takers.length === 0) break;
    for (const { id } of takers.slice(0, left)) pays.set(id, (pays.get(id) ?? 0) + 1);
    left -= Math.min(left, takers.length);
  }
  return pays;
}

/**
 * The players choose who pays a group clue cost ("as a group", RR "Act Deck": "Any or all
 * investigators may contribute any number of clues"), on the card shell (`CardDialog`, MD.6b4):
 * - the card the cost is paid for (`card`: the act to advance, the card whose action it is) beside
 *   the page, an act over it;
 * - that card and the clues the group pays as the kicker, the question as the title;
 * - the clues chosen against `required`;
 * - each payer (`BoardView.cluePayers`) as a row: their round portrait cut from their card, their
 *   name over the clues they hold, and those clues as tokens, the ones they pay pressed, starting
 *   at the engine's split. Tapping a pressed token keeps one more of theirs, tapping another pays
 *   one more, so a payer's pressed tokens always come first;
 * - Split evenly (`evenClueSplit`), and Pay, its one primary, once they are `required`.
 * Escape and its × close it, paying nothing. On a phone it is the shell's sheet.
 */
export function CluePaymentDialog({
  card,
  payers,
  required,
  onPay,
  onCancel,
}: {
  card: CardFaceView;
  payers: readonly CluePayerView[];
  required: number;
  onPay: (spend: readonly ClueSpend[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [pays, setPays] = useState<ReadonlyMap<InvestigatorId, number>>(
    () => new Map(payers.map(({ id, pays }) => [id, pays])),
  );
  const paysOf = (id: InvestigatorId) => pays.get(id) ?? 0;
  const total = payers.reduce((sum, { id }) => sum + paysOf(id), 0);

  return (
    <CardDialog
      name="clue-payment"
      card={card}
      kicker={t('cluePayment.kicker', { count: required, card: card.name })}
      title={t('cluePayment.title')}
      onCancel={(event) => {
        // React passes `cancel` on to a details dialog this one opened from, which Escape keeps open.
        event.stopPropagation();
        onCancel();
      }}
      onClose={onCancel}
    >
      <p>{t('cluePayment.total', { total, required })}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onPay(
            payers
              .map(({ id }) => ({ investigator: id, clues: paysOf(id) }))
              .filter(({ clues }) => clues > 0),
          );
        }}
      >
        <ul>
          {payers.map(({ id, name, image, clues }) => (
            <li key={id}>
              <InvestigatorArt image={image} />
              <p>
                {name}
                <span>{t('cluePayment.pays', { count: clues, pays: paysOf(id) })}</span>
              </p>
              <ul aria-label={t('cluePayment.tokens', { name })}>
                {Array.from({ length: clues }, (_, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      aria-label={t('cluePayment.token', { name, number: i + 1 })}
                      aria-pressed={i < paysOf(id)}
                      onClick={() =>
                        setPays(new Map(pays).set(id, paysOf(id) + (i < paysOf(id) ? -1 : 1)))
                      }
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <footer>
          <button type="button" onClick={() => setPays(evenClueSplit(payers, required))}>
            {t('cluePayment.splitEvenly')}
          </button>
          <button type="submit" disabled={total !== required}>
            {t('cluePayment.pay')}
          </button>
        </footer>
      </form>
    </CardDialog>
  );
}

/**
 * Takes an action for the investigator whose turn it is that may have a group clue cost: one
 * without (`required` undefined) or with no split to choose (`offersClueSplit`) at once, with the
 * engine's split; else after the players split it in the `CluePaymentDialog` beside the card
 * `cardId` the cost is paid for, which `dialog` renders while it is open. `take` gets the
 * split (none for the engine's).
 */
export function useCluePayment(board: BoardView): {
  dialog: ReactNode;
  pay: (
    required: number | undefined,
    cardId: InstanceId,
    take: (spend?: readonly ClueSpend[]) => void,
  ) => void;
} {
  const [asked, setAsked] = useState<{
    required: number;
    cardId: InstanceId;
    payers: readonly CluePayerView[];
    take: (spend?: readonly ClueSpend[]) => void;
  }>();
  const pay = (
    required: number | undefined,
    cardId: InstanceId,
    take: (spend?: readonly ClueSpend[]) => void,
  ) => {
    const first = board.turn;
    const payers =
      required === undefined || first === undefined ? [] : board.cluePayers(first, required);
    if (required !== undefined && offersClueSplit(payers, required))
      setAsked({ required, cardId, payers, take });
    else take();
  };
  const dialog = asked && (
    <CluePaymentDialog
      card={board.cardFace(asked.cardId)}
      payers={asked.payers}
      required={asked.required}
      onPay={(spend) => {
        setAsked(undefined);
        asked.take(spend);
      }}
      onCancel={() => setAsked(undefined)}
    />
  );
  return { dialog, pay };
}
