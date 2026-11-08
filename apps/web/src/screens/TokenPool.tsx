import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { investigatorAt } from '../investigators/dropTarget';
import { enemyAt, locationAt } from '../map/dropTarget';
import type { GameActions } from '../state/gameActions';
import { overHeaderCard } from './headerDropTarget';
import { GameToken, type GameTokenKind } from '../tokens/GameToken';
import { TokenGhost } from './TokenGhost';
import { useTokenDrag, type TokenDragHandlers } from './useTokenDrag';

/**
 * The token pool in the header's top left corner (M3.11c): a doom, a clue, a damage, a horror and
 * a resource token, the supply on the table that card effects take tokens from and that tokens
 * taken off go back to. A token dragged off it is placed where it is dropped, as a card effect
 * places it, one step a drop:
 * - doom on a location or an enemy (`adjustTokens`, `PlaceDoom`) or on the agenda (`placeDoom`),
 *   so it counts towards the threshold;
 * - a clue on a location (`adjustTokens`), as a card adds one there;
 * - damage on an enemy (`damageEnemy`), which defeats it at its health, or on an investigator's
 *   card (`adjust`, which takes it by rule); an enemy in their threat area is found first, since
 *   its card lies on theirs;
 * - horror on an investigator's card, which they take (`adjust`), and a resource, which they gain.
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
    const card = enemyAt(client) ?? locationAt(client);
    if (card) void actions.adjustTokens(card, 'doom', 1);
  });
  const clue = useTokenDrag((client) => {
    const location = locationAt(client);
    if (location) void actions.adjustTokens(location, 'clue', 1);
  });
  const damage = useTokenDrag((client) => {
    const enemy = enemyAt(client);
    if (enemy) {
      void actions.damageEnemy(enemy, 1);
      return;
    }
    const investigator = investigatorAt(client);
    if (investigator) void actions.adjust(investigator, 'damage', 1);
  });
  const horror = useTokenDrag((client) => {
    const investigator = investigatorAt(client);
    if (investigator) void actions.adjust(investigator, 'horror', 1);
  });
  const resource = useTokenDrag((client) => {
    const investigator = investigatorAt(client);
    if (investigator) void actions.adjust(investigator, 'resources', 1);
  });
  const tokens = [
    { kind: 'doom', label: t('header.poolDoom'), drag: doom },
    { kind: 'clue', label: t('header.poolClue'), drag: clue },
    { kind: 'damage', label: t('header.poolDamage'), drag: damage },
    { kind: 'horror', label: t('header.poolHorror'), drag: horror },
    { kind: 'resource', label: t('header.poolResource'), drag: resource },
  ] as const;
  const off = busy || adjusting;
  return (
    <section aria-labelledby={id} data-pool>
      <p id={id}>{t('header.pool')}</p>
      {tokens.map(({ kind, label, drag }) => (
        <PoolToken key={kind} kind={kind} label={label} drag={off ? undefined : drag.handlers} />
      ))}
      {tokens.map(
        ({ kind, drag }) => drag.at && <TokenGhost key={kind} kind={kind} at={drag.at} />,
      )}
    </section>
  );
}

/** One token of the pool, `data-pool-token` with its `kind`, draggable with `drag`. */
function PoolToken({
  kind,
  label,
  drag,
}: {
  kind: GameTokenKind;
  label: string;
  drag: TokenDragHandlers | undefined;
}) {
  return (
    <GameToken
      kind={kind}
      label={label}
      data-pool-token={kind}
      data-drag={drag && kind}
      {...drag}
    />
  );
}
