import { includesAny, withoutEmptyLists } from '@arkham/util';
import { cardStats, type EngineContext, type Trait } from './cards';
import { cardsInPlay } from './doom';
import type { InvestigatorId } from './ids';
import { cardsInZones, locationOfCard, type CardFilter } from './lookup';
import { binds, namesCard, type CardScope, type InvestigatorScope } from './scopes';
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
 * Every verb a "cannot" can forbid an investigator, by the noun it acts on
 * (`InvestigatorRestriction`), in the order `Forbidden` lists them: The Masked Hunter's "you
 * cannot discover or spend clues" is `clues: discover, spend`, Dissonant Voices' "You cannot play
 * assets or events" `cards: play`, Languor's "you cannot play or commit cards of that type"
 * `cards: play, commit`. A new "cannot" (healing horror, gaining resources) adds its
 * verb, or its noun and verbs, here and a check in the handler that does it.
 */
const RESTRICTED_VERBS = {
  clues: ['discover', 'spend'],
  cards: ['play', 'commit'],
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
 * The location a restriction is about (`CardScope`): the card itself (a location's own text) or
 * the card it is attached to (a treachery on a location).
 */
export type RestrictedLocation = Extract<CardScope, 'self' | 'host'>;

/**
 * A "cannot" about which enemies may enter a location: `{ cannot: 'enemiesMoveInto', of: 'host',
 * exceptTraits: [trait('Elite')] }` is Barricade ("Non-Elite enemies cannot move into attached
 * location"). Enemies with one of `exceptTraits` are not held back. Read by `isClosedToEnemy`.
 */
export interface EnemyLocationRestriction {
  cannot: 'enemiesMoveInto';
  of: RestrictedLocation;
  exceptTraits?: readonly Trait[];
}

/**
 * What a constant "cannot" ability forbids an enemy (`EnemyCardRestriction.cannot`):
 * - `ready`: it stays exhausted ("it cannot ready", Handcuffs).
 * - `placeDoom`: no doom is placed on it ("doom cannot be placed on it", Handcuffs).
 * - `damaged`: no damage is dealt to it ("cannot be damaged", A Gathering).
 * - `move`: it stays where it is ("cannot move", Elokoss): it takes no hunter step, a card effect
 *   leaves it in place, and an investigator it is engaged with moves away without it
 *   (`isClosedToEnemy`).
 * - `attackOfOpportunity`: an action of an investigator engaged with it does not provoke its attack
 *   ("cannot make attacks of opportunity", Elokoss).
 */
export type EnemyRestriction = (typeof ENEMY_RESTRICTIONS)[number];

/** Every `EnemyRestriction`. */
const ENEMY_RESTRICTIONS = [
  'ready',
  'placeDoom',
  'damaged',
  'move',
  'attackOfOpportunity',
] as const;

/**
 * A "cannot" about an enemy: `{ cannot: 'ready', of: 'host', exceptTraits: [trait('Elite')] }` is
 * Handcuffs ("If the attached enemy is non-Elite, it cannot ready"). An enemy with one of
 * `exceptTraits` is not held, and with `atLocationWith` only an enemy whose location has a card
 * attached that matches it: `{ cannot: 'damaged', of: 'eachEnemy', atLocationWith: { code: fire }
 * }` is A Gathering ("Each enemy at a location with a copy of Fire! attached cannot be damaged").
 * Read by `isEnemyRestricted`.
 */
export interface EnemyCardRestriction {
  cannot: EnemyRestriction;
  of: Extract<CardScope, 'self' | 'host' | 'eachEnemy'>;
  exceptTraits?: readonly Trait[];
  atLocationWith?: CardFilter;
}

/** A "cannot" about a location: `{ cannot: 'investigate', of: 'host' }` is Locked Door. */
export interface LocationCardRestriction {
  cannot: LocationRestriction;
  of: RestrictedLocation;
  /** Printed on a location's unrevealed side: it holds only while the location is unrevealed. */
  unrevealed?: true;
}

/** The player card types that are played: skills are committed to tests instead (RR "Play"). */
type PlayedCardType = 'asset' | 'event';

/** The player card types a `cards` restriction can name: the played ones and skills. */
export type PlayerCardType = PlayedCardType | 'skill';

/**
 * The player cards a `cards` restriction names: those of one of `types` and, when `traits` is
 * set, with one of them; every card when absent.
 */
export interface PlayedCardFilter {
  types?: readonly PlayerCardType[];
  traits?: readonly Trait[];
}

/**
 * What an investigator cannot do: verbs and the noun they act on. `{ cannot: ['discover',
 * 'spend'], what: 'clues' }` is The Masked Hunter's, `{ cannot: ['play'], what: 'cards', cards: {
 * types: ['asset', 'event'] } }` Dissonant Voices'; `cards` narrows which cards. A card's text
 * holds it as an `InvestigatorCardRestriction`, an effect for a while as a `LastingRestriction`.
 */
export type InvestigatorRestriction =
  | { cannot: readonly RestrictedVerbs['clues'][]; what: 'clues' }
  | { cannot: readonly RestrictedVerbs['cards'][]; what: 'cards'; cards?: PlayedCardFilter };

/**
 * A "cannot" about an investigator on a card, binding those `who` names: The Masked Hunter's is
 * `who: 'threatArea'`, so it binds the investigator it is engaged with.
 */
export type InvestigatorCardRestriction = InvestigatorRestriction & { who: InvestigatorScope };

/**
 * A "cannot" an effect gives one investigator until the round ends (`RestrictInvestigator`):
 * Languor's "you cannot play or commit cards of that type (asset, event, or skill) this round"
 * is `{ cannot: ['play', 'commit'], what: 'cards', cards: { types: ['skill'] } }` once the
 * discarded card was a skill. Kept in `GameMeta.lastingRestrictions`, cleared by `RoundEnded`.
 */
export interface LastingRestriction {
  investigatorId: InvestigatorId;
  until: 'round';
  restriction: InvestigatorRestriction;
}

/**
 * A constant "cannot" ability (`CardStats.restrictions`), as card data. Like a `Modifier` it
 * holds while its card is in play, and a location's restriction only once it is revealed,
 * unless it is printed on the unrevealed side (`unrevealed`, the Parlor's barrier), which holds
 * until then. `isRestricted`, `isRestrictedFor`, `isClosedToEnemy` and `isEnemyRestricted` are
 * the only places that read them, so the handlers and the views agree.
 */
export type CardRestriction =
  | LocationCardRestriction
  | EnemyLocationRestriction
  | EnemyCardRestriction
  | InvestigatorCardRestriction;

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
        namesCard(ctx, state, source, restriction.of, location),
    ),
  );
}

/**
 * Whether a card in play keeps `enemy` from moving into `location`: the location is closed to it
 * (`EnemyLocationRestriction`, Barricade), or the enemy cannot move at all (`move`, Elokoss). A
 * hunter takes another equally short step or stays, a card effect leaves the enemy where it is,
 * and an investigator it is engaged with moves away without it.
 */
export function isClosedToEnemy(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  location: CardInstance,
): boolean {
  if (isEnemyRestricted(ctx, state, enemy, 'move')) return true;
  const traits = cardStats(ctx.cards, enemy.code).traits;
  return cardsInPlay(state).some((source) =>
    activeRestrictions(ctx, source).some(
      (restriction) =>
        restriction.cannot === 'enemiesMoveInto' &&
        !includesAny(traits, restriction.exceptTraits) &&
        namesCard(ctx, state, source, restriction.of, location),
    ),
  );
}

/**
 * Whether a card in play forbids `enemy` to do `cannot` (`EnemyCardRestriction`): a handcuffed
 * enemy does not ready in the upkeep phase or by a card effect, and no doom is placed on it; an
 * enemy at a burning location takes no damage while A Gathering is the agenda.
 */
export function isEnemyRestricted(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  cannot: EnemyRestriction,
): boolean {
  const { traits } = cardStats(ctx.cards, enemy.code);
  return cardsInPlay(state).some((source) =>
    activeRestrictions(ctx, source)
      .filter(isEnemyCardRestriction)
      .some(
        (restriction) =>
          restriction.cannot === cannot &&
          !includesAny(traits, restriction.exceptTraits) &&
          namesCard(ctx, state, source, restriction.of, enemy) &&
          (restriction.atLocationWith === undefined ||
            isAtLocationWith(ctx, state, enemy, restriction.atLocationWith)),
      ),
  );
}

/** Whether a card matching `attached` is attached to the location `enemy` is at. */
function isAtLocationWith(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  attached: CardFilter,
): boolean {
  const location = locationOfCard(state, enemy);
  return (
    location !== undefined &&
    cardsInZones(ctx, state, [{ kind: 'attachedTo', hostId: location }], attached).length > 0
  );
}

/**
 * Whether a card in play, or an effect lasting this round (`GameMeta.lastingRestrictions`),
 * forbids `investigator` to do `cannot` to `what`, as `isRestricted` does for a location. The
 * engine never sees the player card a `PlayCard` plays or a test is committed, so a `cards`
 * restriction holds only where it names every card (Dissonant Voices); a narrower one ("cannot
 * play Firearm assets", Languor's one card type) stays text for the players.
 */
export function isRestrictedFor<N extends RestrictedNoun>(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
  cannot: RestrictedVerbs[N],
  what: N,
): boolean {
  const forbids = (restriction: InvestigatorRestriction) =>
    restriction.what === what &&
    restriction.cannot.some((verb) => verb === cannot) &&
    (restriction.what !== 'cards' || namesEveryCard(restriction.cards));
  return (
    cardsInPlay(state).some((source) =>
      activeRestrictions(ctx, source).some(
        (restriction) =>
          'who' in restriction &&
          forbids(restriction) &&
          binds(state, source, restriction.who, investigator),
      ),
    ) || lastingRestrictionsOf(state, investigator).some((restriction) => forbids(restriction))
  );
}

/** What effects forbid `investigator` until the round ends (`LastingRestriction`), oldest first. */
export function lastingRestrictionsOf(
  state: GameState,
  investigator: InvestigatorId,
): InvestigatorRestriction[] {
  return (state.meta.lastingRestrictions ?? [])
    .filter((lasting) => lasting.investigatorId === investigator)
    .map(({ restriction }) => restriction);
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

// Every played card is an asset or an event, so a filter naming both names every card a play
// restriction is about.
function namesEveryCard(cards: PlayedCardFilter | undefined): boolean {
  if (cards === undefined) return true;
  const types = cards.types ?? PLAYED_CARD_TYPES;
  return cards.traits === undefined && PLAYED_CARD_TYPES.every((type) => types.includes(type));
}

const PLAYED_CARD_TYPES: readonly PlayedCardType[] = ['asset', 'event'];

function isEnemyCardRestriction(restriction: CardRestriction): restriction is EnemyCardRestriction {
  return ENEMY_RESTRICTIONS.some((cannot) => cannot === restriction.cannot);
}
