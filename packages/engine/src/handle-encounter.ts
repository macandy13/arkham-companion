import { cardStats, type CardStats, type EngineContext } from './cards';
import type { DrawEncounter, DrawTopmostFromDiscard, FromSetAside, ShuffleInto } from './commands';
import type { CardFlipped, CardMoved, DeckShuffled, EncounterCardDrawn, Event } from './events';
import { activeInvestigator } from './handle-investigator';
import type { InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { cardMoved } from './placement';
import { spawnEvents } from './spawn';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { GameState, Investigator } from './state';
import { zoneKey, type Zone } from './zone';

const ENCOUNTER_DECK: Zone = { kind: 'encounterDeck' };
const ENCOUNTER_DISCARD: Zone = { kind: 'encounterDiscard' };
const SET_ASIDE: Zone = { kind: 'setAside' };

/** The events of one card drawn from the encounter deck, and whether it makes the drawer draw again. */
interface Draw {
  events: Event[];
  surge: boolean;
}

/**
 * `DrawEncounter`: draws until a card without surge has been drawn. Each card
 * is resolved (moved to its place) before the next is drawn, and the deck is
 * refilled as soon as its last card has been placed, so a discarded surge card
 * is shuffled back in before the surge draw. The players resolve the
 * revelation effects themselves; the app does not wait for that between surge
 * draws.
 */
export function handleDrawEncounter(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawEncounter,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const events: Event[] = [];
  let current = state;
  // A deck made only of surge cards would otherwise reshuffle and draw forever.
  for (let budget = encounterCardCount(state); budget > 0; budget--) {
    const draw = drawOne(ctx, current, investigator);
    if (!draw) break;
    events.push(...draw.events);
    current = replay(draw.events, current);
    if (!draw.surge) break;
  }
  if (events.length === 0) throw new CommandRejected({ code: 'encounterDeckEmpty' });
  return events;
}

/** `DrawTopmostFromDiscard`: moves the first card of the encounter discard with that name. */
export function handleDrawTopmostFromDiscard(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawTopmostFromDiscard,
): CardMoved[] {
  const cardId = cardsIn(state, ENCOUNTER_DISCARD).find(
    (id) => ctx.cards.get(cardOf(state, id).code)?.name === cmd.name,
  );
  if (cardId === undefined)
    throw new CommandRejected({ code: 'cardNotInZone', zone: 'encounterDiscard', match: cmd.name });
  return [cardMoved(state, cardOf(state, cardId), cmd.to)];
}

/** `FromSetAside`: moves one set-aside copy of each code to `to`. */
export function handleFromSetAside(state: GameState, cmd: FromSetAside): CardMoved[] {
  return takeFromSetAside(state, cmd.codes).map((cardId) =>
    cardMoved(state, cardOf(state, cardId), cmd.to),
  );
}

/** `ShuffleInto`: adds one set-aside copy of each code to the zone and shuffles it. */
export function handleShuffleInto(state: GameState, cmd: ShuffleInto): Event[] {
  const cardIds = takeFromSetAside(state, cmd.codes);
  return shuffleInto(state, cardIds, cmd.zone);
}

/** Cards in the encounter deck and its discard, i.e. how many cards could still be drawn. */
function encounterCardCount(state: GameState): number {
  return cardsIn(state, ENCOUNTER_DECK).length + cardsIn(state, ENCOUNTER_DISCARD).length;
}

/**
 * Draws the top card of the encounter deck and places it; if that emptied the
 * deck, the discard is shuffled back in right away. `undefined` when there is
 * no card left to draw.
 */
function drawOne(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): Draw | undefined {
  // Draws keep the deck refilled themselves; an empty deck with a discard can
  // still come from a manual correction or a setup, and the rule applies then too.
  const refill = refillIfEmpty(state);
  const [cardId] = cardsIn(replay(refill, state), ENCOUNTER_DECK);
  if (cardId === undefined) return undefined;

  const stats = cardStats(ctx.cards, cardOf(state, cardId).code);
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
 * engagement) like `SpawnEnemy`, with the drawer as fallback location.
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
  const to: Zone =
    stats.typeCode === 'treachery' && stats.entersThreatArea
      ? { kind: 'threatArea', investigatorId: investigator.id }
      : ENCOUNTER_DISCARD;
  return [
    {
      type: 'CardMoved',
      cardId,
      from: ENCOUNTER_DECK,
      to,
      // Index 0 is the top, and the discard's top is what "topmost" effects look for.
      ...(to.kind === 'encounterDiscard' ? { index: 0 } : {}),
    },
  ];
}

/**
 * Moves `cardIds` into `zone` and shuffles the whole zone with the state's
 * RNG. The shuffled order is in the event, so replaying never draws random
 * numbers. Nothing for an empty list, so an empty discard does not shuffle.
 */
function shuffleInto(state: GameState, cardIds: readonly InstanceId[], zone: Zone): Event[] {
  if (cardIds.length === 0) return [];
  const moves = cardIds.map((cardId) => cardMoved(state, cardOf(state, cardId), zone));
  const remaining = cardsIn(state, zone).filter((id) => !cardIds.includes(id));
  const [order, rngState] = shuffle([...remaining, ...cardIds], state.meta.rngState);
  const shuffled: DeckShuffled = { type: 'DeckShuffled', zone, order, rngState };
  return [...moves, shuffled];
}

/** One set-aside copy of each code, in the order of `codes`; rejects a code with no copy left. */
function takeFromSetAside(state: GameState, codes: readonly string[]): InstanceId[] {
  const { taken } = codes.reduce(
    (acc, code) => {
      const cardId = acc.available.find((id) => cardOf(state, id).code === code);
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

function cardOf(state: GameState, cardId: InstanceId) {
  const card = state.cards[cardId];
  if (!card) throw new CommandRejected({ code: 'unknownCard', cardId });
  return card;
}
