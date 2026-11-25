import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView } from '@arkham/engine';
import { CardDialog } from './CardDialog';
import { ChaosBag } from './ChaosBag';
import './chaos_bag.css';

/**
 * The chaos bag in the header (ME.32a): our drawing of a cloth bag with the number of tokens in
 * it (`BoardView.chaosBag`), small above the Victory display, since the players reach for it
 * rarely between tests. A tap opens the bag in a dialog of its own on the page shell
 * (`CardDialog` without a card), where the players seal, release, add and reveal tokens
 * (`ChaosBag`). The scenario card's page used to hold it under its rows, where it was hard to find.
 */
export function ChaosBagButton({ board }: { board: BoardView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const count = board.chaosBag.length;
  return (
    <>
      <button
        type="button"
        data-part="chaos-bag-button"
        aria-label={t('chaosBag.open', { count })}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 96 126" aria-hidden="true">
          <path d="M30 26c6 4 30 4 36 0l-4 12c14 10 24 30 24 50 0 22-16 32-38 32S10 110 10 88c0-20 10-40 24-50z" />
          <path data-part="cord" d="M34 38c8 3 20 3 28 0M30 26c-2-6 4-10 8-6M66 26c2-6-4-10-8-6" />
        </svg>
        <data value={count}>{count}</data>
      </button>
      {open && (
        <CardDialog
          name="chaos-bag"
          title={t('chaosBag.title')}
          onCancel={() => setOpen(false)}
          onClose={() => setOpen(false)}
        >
          <ChaosBag board={board} />
        </CardDialog>
      )}
    </>
  );
}
