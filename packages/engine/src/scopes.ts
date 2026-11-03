import { assertNever } from '@arkham/util';
import type { EngineContext } from './cards';
import { enemiesAt } from './enemies';
import type { InvestigatorId } from './ids';
import type { CardInstance, GameState } from './state';

/**
 * The cards a constant ability is about, relative to the card that has it, shared by modifiers
 * (`Modifier.of`) and "cannot" restrictions (`LocationCardRestriction.of`):
 * - `self`: the card itself ("You cannot move into the Parlor").
 * - `host`: the card it is attached to ("Attached location gets +2 shroud").
 * - `enemiesHere`: for a location, each enemy at it, engaged ones included ("Each enemy at
 *   Dining Hall gets +1 fight"; Rules Reference, "Engaged": an engaged enemy is at its
 *   investigator's location).
 */
export type CardScope = 'self' | 'host' | 'enemiesHere';

/**
 * The investigators a constant ability binds, relative to the card that has it, shared by
 * modifiers and restrictions: `threatArea`, the one in whose threat area it is, an enemy engaged
 * with them included (Rules Reference, "Threat Area"), so both "while you are engaged with The
 * Masked Hunter" and a treachery's "you".
 */
export type InvestigatorScope = 'threatArea';

/** Whether `scope`, read from `source`, names `card`. */
export function namesCard(
  ctx: EngineContext,
  state: GameState,
  source: CardInstance,
  scope: CardScope,
  card: CardInstance,
): boolean {
  switch (scope) {
    case 'self':
      return source.id === card.id;
    case 'host':
      return source.zone.kind === 'attachedTo' && source.zone.hostId === card.id;
    case 'enemiesHere':
      return enemiesAt(ctx, state, source.id).some((enemy) => enemy.id === card.id);
    default:
      return assertNever(scope);
  }
}

/** Whether `scope`, read from `source`, binds `investigator`. */
export function binds(
  source: CardInstance,
  scope: InvestigatorScope,
  investigator: InvestigatorId,
): boolean {
  switch (scope) {
    case 'threatArea':
      return (
        (source.zone.kind === 'threatArea' || source.zone.kind === 'engaged') &&
        source.zone.investigatorId === investigator
      );
    default:
      return assertNever(scope);
  }
}
