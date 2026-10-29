import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CluePayerView, InvestigatorId } from '@arkham/engine';
import { Stepper } from '../investigators/TestCalculation';
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
 * The players choose who pays a group clue cost ("as a group", RR "Act Deck": "Any or all
 * investigators may contribute any number of clues"): a stepper per payer (`BoardView.cluePayers`)
 * from 0 to the clues they hold, starting at the engine's split, and Pay once the total is
 * `required`. A native modal `<dialog>` brings focus trapping and Escape, which cancels.
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
      <p>{t('cluePayment.total', { total, required })}</p>
      {payers.map(({ id, name, clues }) => (
        <Stepper
          key={id}
          label={t('cluePayment.payer', { name, count: clues })}
          value={paysOf(id)}
          shown={String(paysOf(id))}
          min={0}
          max={clues}
          onChange={(value) => setPays(new Map(pays).set(id, value))}
        />
      ))}
      <footer>
        <button type="button" onClick={onCancel}>
          {t('games.cancel')}
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
