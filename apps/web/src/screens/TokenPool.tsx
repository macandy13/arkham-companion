import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { locationAt } from '../map/dropTarget';
import type { GameActions } from '../state/gameActions';
import { overHeaderCard } from './headerDropTarget';
import { TokenGhost } from './TokenGhost';
import { useTokenDrag, type TokenDragHandlers } from './useTokenDrag';

/** The tokens the pool offers (`TokenPool`). */
type PoolKind = 'clue' | 'doom';

/**
 * The token pool beside the header's cards (M3.11c): a doom and a clue token, the supply on the
 * table that card effects place tokens from and that tokens taken off go back to. A token dragged
 * off it is placed where it is dropped:
 * - doom on a location (`adjustLocation`, `PlaceDoom`) or on the agenda (`placeDoom`), as a card
 *   effect places it, so it counts towards the threshold;
 * - a clue on a location (`adjustLocation`), as a card adds one there.
 * The pool is also a drop target (`data-pool`): the map gives back a token dropped on it
 * (`overTokenPool`). Not drag sources while a step is queued or the players adjust the board. A
 * phone has no room for it (`game.css`).
 */
export function TokenPool({
  actions,
  busy,
  adjusting,
}: {
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const doom = useTokenDrag((client) => {
    if (overHeaderCard('agenda', client)) {
      void actions.placeDoom(1);
      return;
    }
    const location = locationAt(client);
    if (location) void actions.adjustLocation(location, 'doom', 1);
  });
  const clue = useTokenDrag((client) => {
    const location = locationAt(client);
    if (location) void actions.adjustLocation(location, 'clue', 1);
  });
  const off = busy || adjusting;
  return (
    <section aria-labelledby={id} data-pool>
      <p id={id}>{t('header.pool')}</p>
      <PoolToken kind="doom" label={t('header.poolDoom')} drag={off ? undefined : doom.handlers} />
      <PoolToken kind="clue" label={t('header.poolClue')} drag={off ? undefined : clue.handlers} />
      {doom.at && <TokenGhost kind="doom" at={doom.at} />}
      {clue.at && <TokenGhost kind="clue" at={clue.at} />}
    </section>
  );
}

/** One token of the pool, `data-pool-token` with its `kind`, draggable with `drag`. */
function PoolToken({
  kind,
  label,
  drag,
}: {
  kind: PoolKind;
  label: string;
  drag: TokenDragHandlers | undefined;
}) {
  return (
    <span role="img" aria-label={label} data-pool-token={kind} data-drag={drag && kind} {...drag} />
  );
}
