import { assertNever, withoutEmptyLists } from '@arkham/util';
import { cardStats, type EngineContext, type Trait } from './cards';
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
 * Every verb a constant "cannot" ability can forbid an investigator, by the noun it acts on
 * (`InvestigatorCardRestriction`), in the order `Forbidden` lists them: The Masked Hunter's "you
 * cannot discover or spend clues" is `clues: discover, spend`, Dissonant Voices' "You cannot play
 * assets or events" `cards: play`. A new "cannot" (healing horror, gaining resources) adds its
 * verb, or its noun and verbs, here and a check in the handler that does it.
 */
export const RESTRICTED_VERBS = {
  clues: ['discover', 'spend'],
  cards: ['play'],
} as const;

/** The verbs a restriction can forbid for each noun (`RESTRICTED_VERBS`). */
export type RestrictedVerbs = {
  -readonly [N in keyof typeof RESTRICTED_VERBS]: (typeof RESTRICTED_VERBS)[N][number];
};

/** What an investigator restriction is about (`RestrictedVerbs`). */
export type RestrictedNoun = keyof RestrictedVerbs;

// `RESTRICTED_VERBS` as a mapped type, so indexing it with a generic noun keeps that noun's verbs.
const VERBS_BY_NOUN: { readonly [N in RestrictedNoun]: readonly RestrictedVerbs[N][] } =
  RESTRICTED_VERBS;

/** One forbidden step, as a rejection names it: `{ cannot: 'spend', what: 'clues' }`. */
export type ForbiddenStep = {
  [N in RestrictedNoun]: { cannot: RestrictedVerbs[N]; what: N };
}[RestrictedNoun];

/**
 * The verbs the cards in play forbid one investigator, by noun (`forbiddenFor`): `{ clues:
 * ['discover', 'spend'] }` while The Masked Hunter is engaged with them.
 */
export type Forbidden = { [N in RestrictedNoun]?: RestrictedVerbs[N][] };

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

/** The player card types that are played: skills are committed to tests instead (RR "Play"). */
export type PlayedCardType = 'asset' | 'event';

/**
 * The player cards a `play` `cards` restriction names: those of one of `types` and, when `traits`
 * is set, with one of them; every played card when absent.
 */
export interface PlayedCardFilter {
  types?: readonly PlayedCardType[];
  traits?: readonly Trait[];
}

/**
 * A "cannot" about an investigator: verbs and the noun they act on. `{ cannot: ['discover',
 * 'spend'], what: 'clues', who: 'threatArea' }` is The Masked Hunter, `{ cannot: ['play'], what:
 * 'cards', who: 'threatArea', cards: { types: ['asset', 'event'] } }` Dissonant Voices; `cards`
 * narrows which cards.
 */
export type InvestigatorCardRestriction =
  | { cannot: readonly RestrictedVerbs['clues'][]; what: 'clues'; who: RestrictedInvestigator }
  | {
      cannot: readonly RestrictedVerbs['cards'][];
      what: 'cards';
      who: RestrictedInvestigator;
      cards?: PlayedCardFilter;
    };

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

/**
 * Whether a card in play forbids `investigator` to do `cannot` to `what`, as `isRestricted` does
 * for a location. The engine never sees the player card a `PlayCard` plays, so `play` `cards`
 * holds only where a restriction names every played card (Dissonant Voices); a narrower one
 * ("cannot play Firearm assets") stays card text for the players.
 */
export function isRestrictedFor<N extends RestrictedNoun>(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
  cannot: RestrictedVerbs[N],
  what: N,
): boolean {
  return cardsInPlay(state).some((source) =>
    activeRestrictions(ctx, source).some(
      (restriction) =>
        'who' in restriction &&
        restriction.what === what &&
        restriction.cannot.some((verb) => verb === cannot) &&
        (restriction.what !== 'cards' || namesEveryPlayedCard(restriction.cards)) &&
        binds(source, restriction.who, investigator),
    ),
  );
}

/** Every verb `isRestrictedFor` holds for `investigator`, by noun; nouns with none left out. */
export function forbiddenFor(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
): Forbidden {
  const verbs = <N extends RestrictedNoun>(what: N): RestrictedVerbs[N][] =>
    VERBS_BY_NOUN[what].filter((cannot) => isRestrictedFor(ctx, state, investigator, cannot, what));
  // Every key required, so a noun added to RESTRICTED_VERBS can't be missed here.
  const byNoun: { [N in RestrictedNoun]: RestrictedVerbs[N][] } = {
    clues: verbs('clues'),
    cards: verbs('cards'),
  };
  return withoutEmptyLists(byNoun);
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

function namesEveryPlayedCard(cards: PlayedCardFilter | undefined): boolean {
  if (cards === undefined) return true;
  const types = cards.types ?? PLAYED_CARD_TYPES;
  return cards.traits === undefined && PLAYED_CARD_TYPES.every((type) => types.includes(type));
}

const PLAYED_CARD_TYPES: readonly PlayedCardType[] = ['asset', 'event'];
