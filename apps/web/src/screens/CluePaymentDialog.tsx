import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CluePayerView, InvestigatorId } from '@arkham/engine';
import { InvestigatorArt } from '../investigators/InvestigatorArt';
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
 * investigators may contribute any number of clues"): each payer (`BoardView.cluePayers`) as their
 * card's art over their name, or their initial until it loads, with the clues they hold as tokens
 * under it, the ones they pay pressed, starting at the engine's split. Tapping a pressed token
 * keeps one more of theirs, tapping another pays one more, so a payer's pressed tokens always come
 * first. A row of pips counts the clues chosen against `required`; Split evenly chooses
 * `evenClueSplit`, and Pay takes them once they are `required`. A native modal `<dialog>` brings
 * focus trapping and Escape, which closes it like its close button, paying nothing.
 */
export function CluePaymentDialog({
  title,
  payers,
  required,
  onPay,
  onCancel,
}: {
  title: string;
  payers: readonly CluePayerView[];
  required: number;
  onPay: (spend: readonly ClueSpend[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const [pays, setPays] = useState<ReadonlyMap<InvestigatorId, number>>(
    () => new Map(payers.map(({ id, pays }) => [id, pays])),
  );
  const paysOf = (id: InvestigatorId) => pays.get(id) ?? 0;
  const total = payers.reduce((sum, { id }) => sum + paysOf(id), 0);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onCancel} data-dialog="clue-payment">
      <h2 id={titleId}>{title}</h2>
      <button
        type="button"
        data-icon="close"
        aria-label={t('cluePayment.close')}
        onClick={onCancel}
      />
      <p>{t('cluePayment.total', { total, required })}</p>
      <ol aria-hidden="true">
        {Array.from({ length: required }, (_, i) => (
          <li key={i} data-paid={i < total || undefined} />
        ))}
      </ol>
      <ul>
        {payers.map(({ id, name, image, clues }) => (
          <li key={id}>
            <figure>
              <span>{name.charAt(0)}</span>
              <InvestigatorArt image={image} />
              <figcaption>{name}</figcaption>
            </figure>
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
        <button
          type="button"
          disabled={total !== required}
          onClick={() =>
            onPay(
              payers
                .map(({ id }) => ({ investigator: id, clues: paysOf(id) }))
                .filter(({ clues }) => clues > 0),
            )
          }
        >
          {t('cluePayment.pay')}
        </button>
      </footer>
    </dialog>
  );
}

/**
 * Takes an action for the investigator whose turn it is that may have a group clue cost: one
 * without (`required` undefined) or with no split to choose (`offersClueSplit`) at once, with the
 * engine's split; else after the players split it in the `CluePaymentDialog` titled `title`, which
 * `dialog` renders while it is open. `take` gets the split (none for the engine's).
 */
export function useCluePayment(board: BoardView): {
  dialog: ReactNode;
  pay: (
    required: number | undefined,
    title: string,
    take: (spend?: readonly ClueSpend[]) => void,
  ) => void;
} {
  const [asked, setAsked] = useState<{
    required: number;
    title: string;
    payers: readonly CluePayerView[];
    take: (spend?: readonly ClueSpend[]) => void;
  }>();
  const pay = (
    required: number | undefined,
    title: string,
    take: (spend?: readonly ClueSpend[]) => void,
  ) => {
    const first = board.turn;
    const payers =
      required === undefined || first === undefined ? [] : board.cluePayers(first, required);
    if (required !== undefined && offersClueSplit(payers, required))
      setAsked({ required, title, payers, take });
    else take();
  };
  const dialog = asked && (
    <CluePaymentDialog
      title={asked.title}
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
