import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import { cardsInPlay } from './doom';
import type { CardInstance, GameState } from './state';

/**
 * What a constant "cannot" ability forbids at a location (`CardRestriction.cannot`):
 * - `moveInto`: no investigator may move into it ("You cannot move into the Parlor").
 * - `investigate`: no investigator may investigate it ("The attached location cannot be
 *   investigated").
 */
export type LocationRestriction = (typeof LOCATION_RESTRICTIONS)[number];

/** Every `LocationRestriction`, in the order a `LocationView.forbidden` lists them. */
export const LOCATION_RESTRICTIONS = ['moveInto', 'investigate'] as const;

/**
 * The location a restriction is about, relative to the card that has it: the card itself (a
 * location's own text) or the card it is attached to (a treachery on a location).
 */
export type RestrictedLocation = 'self' | 'host';

/**
 * A constant "cannot" ability (`CardStats.restrictions`), as card data:
 * `{ cannot: 'investigate', of: 'host' }` is Locked Door. Like a `CardModifier` it holds while
 * its card is in play, and a location's restriction only once it is revealed, unless it is
 * printed on the unrevealed side (`unrevealed`, the Parlor's barrier), which holds until then.
 * `isRestricted` is the one place that reads them, so the handlers and the views agree.
 */
export interface CardRestriction {
  cannot: LocationRestriction;
  of: RestrictedLocation;
  /** Printed on a location's unrevealed side: it holds only while the location is unrevealed. */
  unrevealed?: true;
}

/**
 * Whether a card in play forbids `cannot` at `location` (Rules Reference, "Cannot": a "cannot"
 * outranks any effect that would allow it, so card effects that move an investigator are refused
 * as well as the move action).
 */
export function isRestricted(
  ctx: EngineContext,
  state: GameState,
  location: CardInstance,
  cannot: LocationRestriction,
): boolean {
  return cardsInPlay(state).some((source) =>
    activeRestrictions(ctx, state, source).some(
      (restriction) => restriction.cannot === cannot && isAbout(source, restriction.of, location),
    ),
  );
}

function activeRestrictions(
  ctx: EngineContext,
  state: GameState,
  source: CardInstance,
): readonly CardRestriction[] {
  const stats = cardStats(ctx.cards, source.code);
  if (!stats.restrictions) return [];
  if (stats.typeCode !== 'location') return stats.restrictions;
  const onUnrevealedSide = !source.faceUp;
  return stats.restrictions.filter(
    (restriction) => (restriction.unrevealed === true) === onUnrevealedSide,
  );
}

function isAbout(source: CardInstance, of: RestrictedLocation, location: CardInstance): boolean {
  switch (of) {
    case 'self':
      return source.id === location.id;
    case 'host':
      return source.zone.kind === 'attachedTo' && source.zone.hostId === location.id;
    default:
      return assertNever(of);
  }
}
