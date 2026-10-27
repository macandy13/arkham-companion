import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import { cardsInPlay } from './doom';
import type { InvestigatorId } from './ids';
import type { CardInstance, GameState } from './state';

/**
 * What a constant "cannot" ability forbids at a location (`LocationCardRestriction.cannot`):
 * - `moveInto`: no investigator may move into it ("You cannot move into the Parlor").
 * - `investigate`: no investigator may investigate it ("The attached location cannot be
 *   investigated").
 */
export type LocationRestriction = (typeof LOCATION_RESTRICTIONS)[number];

/** Every `LocationRestriction`, in the order a `LocationView.forbidden` lists them. */
export const LOCATION_RESTRICTIONS = ['moveInto', 'investigate'] as const;

/**
 * What a constant "cannot" ability forbids an investigator (`InvestigatorCardRestriction.cannot`):
 * - `discoverClues`, `spendClues`: The Masked Hunter's "you cannot discover or spend clues".
 * - `playAssetsOrEvents`: Dissonant Voices' "You cannot play assets or events". Only assets and
 *   events are played (skills are committed), so it forbids every `PlayCard`.
 */
export type InvestigatorRestriction = (typeof INVESTIGATOR_RESTRICTIONS)[number];

/** Every `InvestigatorRestriction`, in the order an `InvestigatorView.forbidden` lists them. */
export const INVESTIGATOR_RESTRICTIONS = [
  'discoverClues',
  'spendClues',
  'playAssetsOrEvents',
] as const;

/**
 * The location a restriction is about, relative to the card that has it: the card itself (a
 * location's own text) or the card it is attached to (a treachery on a location).
 */
export type RestrictedLocation = 'self' | 'host';

/**
 * The investigator a restriction binds, relative to the card that has it: `threatArea`, the one
 * in whose threat area it is, an enemy engaged with them included (Rules Reference, "Threat
 * Area"), so both "while you are engaged with The Masked Hunter" and a treachery's "you".
 */
export type RestrictedInvestigator = 'threatArea';

/** A "cannot" about a location: `{ cannot: 'investigate', of: 'host' }` is Locked Door. */
export interface LocationCardRestriction {
  cannot: LocationRestriction;
  of: RestrictedLocation;
  /** Printed on a location's unrevealed side: it holds only while the location is unrevealed. */
  unrevealed?: true;
}

/**
 * A "cannot" about an investigator: `{ cannot: 'playAssetsOrEvents', who: 'threatArea' }` is
 * Dissonant Voices.
 */
export interface InvestigatorCardRestriction {
  cannot: InvestigatorRestriction;
  who: RestrictedInvestigator;
}

/**
 * A constant "cannot" ability (`CardStats.restrictions`), as card data. Like a `CardModifier` it
 * holds while its card is in play, and a location's restriction only once it is revealed,
 * unless it is printed on the unrevealed side (`unrevealed`, the Parlor's barrier), which holds
 * until then. `isRestricted` and `isRestrictedFor` are the only places that read them, so the
 * handlers and the views agree.
 */
export type CardRestriction = LocationCardRestriction | InvestigatorCardRestriction;

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
    activeRestrictions(ctx, source).some(
      (restriction) =>
        'of' in restriction &&
        restriction.cannot === cannot &&
        isAbout(source, restriction.of, location),
    ),
  );
}

/** Whether a card in play forbids `investigator` to do `cannot`, as `isRestricted` does for a location. */
export function isRestrictedFor(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
  cannot: InvestigatorRestriction,
): boolean {
  return cardsInPlay(state).some((source) =>
    activeRestrictions(ctx, source).some(
      (restriction) =>
        'who' in restriction &&
        restriction.cannot === cannot &&
        binds(source, restriction.who, investigator),
    ),
  );
}

function activeRestrictions(ctx: EngineContext, source: CardInstance): readonly CardRestriction[] {
  const stats = cardStats(ctx.cards, source.code);
  if (!stats.restrictions) return [];
  if (stats.typeCode !== 'location') return stats.restrictions;
  const onUnrevealedSide = !source.faceUp;
  return stats.restrictions.filter(
    (restriction) =>
      ('unrevealed' in restriction && restriction.unrevealed === true) === onUnrevealedSide,
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

function binds(
  source: CardInstance,
  who: RestrictedInvestigator,
  investigator: InvestigatorId,
): boolean {
  switch (who) {
    case 'threatArea':
      return (
        (source.zone.kind === 'threatArea' || source.zone.kind === 'engaged') &&
        source.zone.investigatorId === investigator
      );
    default:
      return assertNever(who);
  }
}
