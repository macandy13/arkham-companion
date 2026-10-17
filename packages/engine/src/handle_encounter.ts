import { locationAttachments } from './board';
import { cardStats, type CardStats, type EngineContext } from './cards';
import type {
  DrawEncounter,
  EncounterMatch,
  EncounterSource,
  FromSetAside,
  MoveCard,
  ShuffleInto,
} from './commands';
import type { CardFlipped, CardMoved, DeckShuffled, EncounterCardDrawn, Event } from './events';
import { activeInvestigator } from './handle_investigator';
import type { CardCode, InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { requireCard } from './lookup';
import { cardMoved } from './placement';
import { revelationTestDecision } from './skill_tests';
import { spawnEvents } from './spawn';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, GameState, Investigator } from './state';
import { zoneKey, type Zone } from './zone';

const ENCOUNTER_DECK: Zone = { kind: 'encounterDeck' };
const ENCOUNTER_DISCARD: Zone = { kind: 'encounterDiscard' };
const SET_ASIDE: Zone = { kind: 'setAside' };
const RESOLVING: Zone = { kind: 'resolving' };

/** The events of one card drawn from the encounter deck, and whether it makes the drawer draw again. */
interface Draw {
  events: Event[];
  surge: boolean;
}

/**
 * `DrawEncounter`: draws until a card without surge has been drawn. The first
 * card is the top of the deck or, with `match`, the first matching card; both
 * go through the same `drawOne`, so a card taken from the discard is revealed,
 * placed and checked for surge exactly like one from the deck, and surge draws
 * continue from the top. Each card is resolved (moved to its place) before the
 * next is drawn, and the deck is refilled as soon as its last card has been
 * placed, so a discarded surge card is shuffled back in before the surge draw.
 * The players resolve the revelation effects themselves; the app does not wait
 * for that between surge draws.
 */
export function handleDrawEncounter(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawEncounter,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const events: Event[] = [];
  let current = state;
  let target: InstanceId | undefined;
  if (cmd.match) {
    const from = cmd.from ?? 'deck';
    target = findMatch(ctx, state, from, cmd.match);
    // Only a deck match has cards above it to discard; a discard match has none.
    const skipped = cmd.discardSkipped ? cardsAbove(state, target) : [];
    events.push(
      ...skipped.map((id) => cardMoved(state, requireCard(state.cards, id), ENCOUNTER_DISCARD, 0)),
    );
    current = replay(events, state);
  }
  // A deck made only of surge cards would otherwise reshuffle and draw forever.
  for (let budget = encounterCardCount(state); budget > 0; budget--) {
    const draw = drawOne(ctx, current, investigator, target);
    target = undefined;
    if (!draw) break;
    events.push(...draw.events);
    current = replay(draw.events, current);
    if (!draw.surge) break;
  }
  if (events.length === 0) throw new CommandRejected({ code: 'encounterDeckEmpty' });
  return events;
}

/**
 * The first card of `from` that fulfils every field of `match`: deck top-down,
 * then discard top-down. Rejects when there is none, before anything changes.
 */
function findMatch(
  ctx: EngineContext,
  state: GameState,
  from: EncounterSource,
  match: EncounterMatch,
): InstanceId {
  const zones =
    from === 'deckOrDiscard'
      ? [ENCOUNTER_DECK, ENCOUNTER_DISCARD]
      : [from === 'deck' ? ENCOUNTER_DECK : ENCOUNTER_DISCARD];
  const found = zones
    .flatMap((zone) => cardsIn(state, zone))
    .find((id) => matchesEncounter(cardStats(ctx.cards, requireCard(state.cards, id).code), match));
  if (found === undefined) throw new CommandRejected({ code: 'noMatchingCard', from, match });
  return found;
}

/**
 * Whether the card fulfils every field `match` sets, as a matched
 * `DrawEncounter` checks it; also for scenario hooks that must know whether a
 * matching card is left before they ask for the draw.
 */
export function matchesEncounter(stats: CardStats, match: EncounterMatch): boolean {
  return (
    (match.name === undefined || stats.name === match.name) &&
    (match.trait === undefined || stats.traits.includes(match.trait)) &&
    (match.typeCode === undefined || stats.typeCode === match.typeCode)
  );
}

/** The deck cards above `cardId`, top first; none when it is not in the deck. */
function cardsAbove(state: GameState, cardId: InstanceId): readonly InstanceId[] {
  const deck = cardsIn(state, ENCOUNTER_DECK);
  const index = deck.indexOf(cardId);
  return index < 0 ? [] : deck.slice(0, index);
}

/** `FromSetAside`: moves one set-aside copy of each code to `to`. */
export function handleFromSetAside(state: GameState, cmd: FromSetAside): CardMoved[] {
  return takeFromSetAside(state, cmd.codes).map((cardId) =>
    cardMoved(state, requireCard(state.cards, cardId), cmd.to),
  );
}

/** `ShuffleInto`: adds one set-aside copy of each code to the zone and shuffles it. */
export function handleShuffleInto(state: GameState, cmd: ShuffleInto): Event[] {
  const cardIds = takeFromSetAside(state, cmd.codes);
  return shuffleInto(state, cardIds, cmd.zone);
}

/**
 * `ShuffleEncounterDiscard`: the whole discard goes into the encounter deck,
 * which is then shuffled. Rules Reference, "Discard Piles": shuffling an empty
 * discard pile into a deck does not shuffle the deck, so that yields nothing.
 */
export function handleShuffleEncounterDiscard(state: GameState): Event[] {
  return shuffleInto(state, cardsIn(state, ENCOUNTER_DISCARD), ENCOUNTER_DECK);
}

/** Cards in the encounter deck and its discard, i.e. how many cards could still be drawn. */
function encounterCardCount(state: GameState): number {
  return cardsIn(state, ENCOUNTER_DECK).length + cardsIn(state, ENCOUNTER_DISCARD).length;
}

/**
 * Draws `target` (default: the top card of the encounter deck) and places it;
 * if that emptied the deck, the discard is shuffled back in right away.
 * `undefined` when there is no card left to draw.
 */
function drawOne(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  target?: InstanceId,
): Draw | undefined {
  // Draws keep the deck refilled themselves; an empty deck with a discard can
  // still come from a manual correction or a setup, and the rule applies then too.
  const refill = refillIfEmpty(state);
  const cardId = target ?? cardsIn(replay(refill, state), ENCOUNTER_DECK)[0];
  if (cardId === undefined) return undefined;

  const stats = cardStats(ctx.cards, requireCard(state.cards, cardId).code);
  const surge = hasKeyword(stats, 'surge');
  const drawn: EncounterCardDrawn = {
    type: 'EncounterCardDrawn',
    investigatorId: investigator.id,
    cardId,
    peril: hasKeyword(stats, 'peril'),
    surge,
  };
  const revealed: CardFlipped = { type: 'CardFlipped', cardId, faceUp: true };
  const events: Event[] = [
    ...refill,
    drawn,
    revealed,
    ...placement(ctx, state, stats, cardId, investigator),
  ];
  return { events: [...events, ...refillIfEmpty(replay(events, state))], surge };
}

/**
 * Rules Reference: "If the encounter deck is empty, shuffle the encounter
 * discard pile back into the encounter deck." Nothing while the deck has cards
 * or the discard is empty.
 */
function refillIfEmpty(state: GameState): Event[] {
  if (cardsIn(state, ENCOUNTER_DECK).length > 0) return [];
  return shuffleInto(state, cardsIn(state, ENCOUNTER_DISCARD), ENCOUNTER_DECK);
}

/**
 * The events that place a drawn card. An enemy spawns (spawn instruction,
 * engagement) like `SpawnEnemy`, with the drawer as fallback location; every
 * other card goes to the threat area, the drawer's location (see
 * `attachmentHost`) or the top of the discard. A treachery
 * with a revelation test asks the drawer for its result; one that does not
 * stay in the threat area waits in the `resolving` zone until the answer
 * discards it (Rules Reference: a card is discarded after its revelation
 * resolves). The card may come from the discard (`match`), so the origin is
 * read from the state.
 */
function placement(
  ctx: EngineContext,
  state: GameState,
  stats: CardStats,
  cardId: InstanceId,
  investigator: Investigator,
): Event[] {
  if (stats.typeCode === 'enemy')
    return spawnEvents(ctx, state, cardId, { investigatorId: investigator.id });
  const card = requireCard(state.cards, cardId);
  const host = attachmentHost(ctx, state, stats, investigator);
  if (host) return [cardMoved(state, card, { kind: 'attachedTo', hostId: host.id })];
  if (stats.typeCode === 'treachery' && stats.entersThreatArea) {
    const moved = cardMoved(state, card, { kind: 'threatArea', investigatorId: investigator.id });
    return [moved, ...revelationTestDecision(ctx, replay([moved], state), cardId, investigator)];
  }
  if (stats.typeCode === 'treachery' && stats.revelationTest) {
    const resolving = cardMoved(state, card, RESOLVING);
    const test = revelationTestDecision(ctx, replay([resolving], state), cardId, investigator, [
      discardToTop(cardId),
    ]);
    return [resolving, ...test];
  }
  // Index 0 is the top, and the discard's top is what "topmost" effects look for.
  return [cardMoved(state, card, ENCOUNTER_DISCARD, 0)];
}

/**
 * The location a treachery with `CardStats.locationAttachment` attaches to:
 * the drawer's. None for any other card, for a drawer without a location, or
 * when the card's limit of one per location is reached, so the card is
 * discarded like one without a lasting effect.
 */
function attachmentHost(
  ctx: EngineContext,
  state: GameState,
  stats: CardStats,
  investigator: Investigator,
): CardInstance | undefined {
  if (stats.typeCode !== 'treachery' || !stats.locationAttachment) return undefined;
  const location =
    investigator.locationId === undefined ? undefined : state.cards[investigator.locationId];
  if (!location) return undefined;
  const limitReached =
    stats.locationAttachment.onePerLocation &&
    locationAttachments(ctx, state, location).some(({ card }) => card.code === stats.code);
  return limitReached ? undefined : location;
}

/** The command that discards a resolved encounter card onto the top of the discard. */
function discardToTop(cardId: InstanceId): MoveCard {
  return { type: 'MoveCard', cardId, to: ENCOUNTER_DISCARD, index: 0 };
}

/**
 * Moves `cardIds` into `zone` and shuffles the whole zone with the state's
 * RNG. The shuffled order is in the event, so replaying never draws random
 * numbers. Nothing for an empty list, so an empty discard does not shuffle.
 */
function shuffleInto(state: GameState, cardIds: readonly InstanceId[], zone: Zone): Event[] {
  if (cardIds.length === 0) return [];
  const moves = cardIds.map((cardId) => cardMoved(state, requireCard(state.cards, cardId), zone));
  const remaining = cardsIn(state, zone).filter((id) => !cardIds.includes(id));
  const [order, rngState] = shuffle([...remaining, ...cardIds], state.meta.rngState);
  const shuffled: DeckShuffled = { type: 'DeckShuffled', zone, order, rngState };
  return [...moves, shuffled];
}

/** One set-aside copy of each code, in the order of `codes`; rejects a code with no copy left. */
function takeFromSetAside(state: GameState, codes: readonly CardCode[]): InstanceId[] {
  const { taken } = codes.reduce(
    (acc, code) => {
      const cardId = acc.available.find((id) => requireCard(state.cards, id).code === code);
      if (cardId === undefined)
        throw new CommandRejected({ code: 'cardNotInZone', zone: 'setAside', match: code });
      return {
        taken: [...acc.taken, cardId],
        available: acc.available.filter((id) => id !== cardId),
      };
    },
    { taken: [] as InstanceId[], available: cardsIn(state, SET_ASIDE) },
  );
  return taken;
}

/** The cards of a zone, top first. */
function cardsIn(state: GameState, zone: Zone): readonly InstanceId[] {
  return state.order[zoneKey(zone)] ?? [];
}
