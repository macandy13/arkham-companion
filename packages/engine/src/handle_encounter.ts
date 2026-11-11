import { range } from '@arkham/util';
import { cardStats, type CardStats, type EngineContext } from './cards';
import type {
  DiscardEncounterTop,
  DrawBeneath,
  DrawEncounter,
  DrawFromScenarioDeck,
  EncounterMatch,
  EncounterSource,
  FromSetAside,
  GainSurge,
  ResolveRevelation,
  ShuffleInto,
} from './commands';
import type {
  CardFlipped,
  CardMoved,
  DeckShuffled,
  EncounterCardDrawn,
  DecisionRequested,
  Event,
  RevelationResolved,
  SurgeGained,
} from './events';
import { decisionId, type CardCode, type InstanceId, type InvestigatorId } from './ids';
import { activeInvestigator, isActiveInvestigator } from './investigators';
import { hasKeyword } from './keywords';
import { cardsInZone, requireCard } from './lookup';
import { cardMoved } from './placement';
import { spawnEvents } from './spawn';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, Decision, GameState, Investigator } from './state';
import {
  encounterDeck,
  encounterDiscard,
  resolvingZone,
  scenarioDeck,
  setAside,
  type Zone,
} from './zone';

/**
 * `DrawEncounter`: draws one card into the `resolving` zone and turns it face
 * up. The card is the top of the deck or, with `match`, the first matching
 * card; both go through the same `drawOne`, so a card taken from the discard
 * is revealed and placed exactly like one from the deck. Placing it waits:
 * Rules Reference, "Revelation": the revelation resolves as the card is
 * drawn, before an enemy spawns or a treachery is placed or discarded, so
 * `handle` places it (`placeDrawnCard`) only after the forced effects of the
 * reveal, and draws again for surge (`surgeDraw`) after that.
 */
export function handleDrawEncounter(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawEncounter,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (!cmd.match) return drawOne(ctx, state, investigator) ?? rejectEmptyDeck();
  const target = findMatch(ctx, state, cmd.from ?? 'deck', cmd.match);
  // Nothing fits: the effect resolves as far as it can (Golden Rules). With the discard just shuffled
  // in, discarding the whole deck and shuffling it back would end where it started.
  if (target === undefined) return [];
  // Only a deck match has cards above it to discard; a discard match has none.
  const skipped = (cmd.discardSkipped ? cardsAbove(state, target) : []).map((id) =>
    cardMoved(state, requireCard(state.cards, id), encounterDiscard, 0),
  );
  const drawn = drawOne(ctx, replay(skipped, state), investigator, target) ?? rejectEmptyDeck();
  return [...skipped, ...drawn];
}

function rejectEmptyDeck(): never {
  throw new CommandRejected({ code: 'encounterDeckEmpty' });
}

/**
 * The surge draw that follows `events`, the events of one `DrawEncounter`
 * without its forced effects: another draw from the top for the same
 * investigator if the drawn card has surge. Rules Reference, "Surge": the
 * draw comes after the card has resolved, so `handle` runs it only after the
 * card's forced effects and decisions.
 */
export function surgeDraw(events: readonly Event[]): DrawEncounter | undefined {
  const drawn = events.find((event) => event.type === 'EncounterCardDrawn');
  return drawn?.surge ? { type: 'DrawEncounter', investigatorId: drawn.investigatorId } : undefined;
}

/** `GainSurge`: the resolving card draws again once placed (`CardInstance.gainedSurge`). */
export function handleGainSurge(state: GameState, cmd: GainSurge): SurgeGained[] {
  if (requireCard(state.cards, cmd.cardId).zone.kind !== 'resolving')
    throw new CommandRejected({ code: 'notResolving', cardId: cmd.cardId });
  return [{ type: 'SurgeGained', cardId: cmd.cardId }];
}

/**
 * `ResolveRevelation`: the players' answer to `revelationDecision`, recorded for the revealed
 * window (`windowsOpenedBy`) to open or not.
 */
export function handleResolveRevelation(
  state: GameState,
  cmd: ResolveRevelation,
): RevelationResolved[] {
  if (requireCard(state.cards, cmd.cardId).zone.kind !== 'resolving')
    throw new CommandRejected({ code: 'notResolving', cardId: cmd.cardId });
  const { cardId, investigatorId } = cmd;
  return [
    {
      type: 'RevelationResolved',
      cardId,
      investigatorId,
      ...(cmd.cancelled && { cancelled: true }),
    },
  ];
}

/** What every `revelationDecision`'s id starts with, before the card's instance id. */
const REVELATION_ID_PREFIX = 'revelation:';

/** Whether `decision` is a drawn treachery's question before its revelation (`revelationDecision`). */
export function isRevelationDecision(decision: Pick<Decision, 'id'>): boolean {
  return decision.id.startsWith(REVELATION_ID_PREFIX);
}

/** The id of `revelationDecision`'s option that cancels the revelation, which a bot looks for. */
export const CANCEL_REVELATION_OPTION = 'cancel';

/**
 * The question a drawn treachery asks its drawer before its revelation: resolve it, or cancel
 * it with a card such as Ward of Protection ("When you draw a non-weakness treachery card"),
 * which the players hold in their hands, out of the app's sight. So every treachery asks, and
 * the players offer the cancel only where their card fits.
 */
export function revelationDecision(cardId: InstanceId, investigatorId: InvestigatorId): Decision {
  const answer = (cancelled: boolean): ResolveRevelation => ({
    type: 'ResolveRevelation',
    cardId,
    investigatorId,
    ...(cancelled && { cancelled: true }),
  });
  return {
    id: decisionId(`${REVELATION_ID_PREFIX}${cardId}`),
    kind: 'confirm',
    subject: cardId,
    prompt: 'decision.revelation',
    decider: { kind: 'investigator', investigatorId },
    options: [
      { id: 'resolve', label: 'decision.resolveRevelation', commands: [answer(false)] },
      {
        id: CANCEL_REVELATION_OPTION,
        label: 'decision.cancelRevelation',
        commands: [answer(true)],
      },
    ],
  };
}

/**
 * Whether the investigator can draw an encounter card: they are still in the
 * scenario and the deck or its discard has a card. A mythos draw or a surge
 * without either is skipped rather than refused.
 */
export function canDrawEncounter(state: GameState, investigatorId: InvestigatorId): boolean {
  return isActiveInvestigator(state, investigatorId) && encounterCardCount(state) > 0;
}

/**
 * The first card of `from` that fulfils every field of `match`: deck top-down,
 * then discard top-down; none when no card matches.
 */
function findMatch(
  ctx: EngineContext,
  state: GameState,
  from: EncounterSource,
  match: EncounterMatch,
): InstanceId | undefined {
  const zones =
    from === 'deckOrDiscard'
      ? [encounterDeck, encounterDiscard]
      : [from === 'deck' ? encounterDeck : encounterDiscard];
  return zones
    .flatMap((zone) => cardsInZone(state, zone))
    .find((id) => matchesEncounter(cardStats(ctx.cards, requireCard(state.cards, id).code), match));
}

/**
 * Whether the card fulfils every field `match` sets, as a matched
 * `DrawEncounter` checks it.
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
  const deck = cardsInZone(state, encounterDeck);
  const index = deck.indexOf(cardId);
  return index < 0 ? [] : deck.slice(0, index);
}

/** `DrawFromScenarioDeck`: the deck's top card spawns, with the drawer as the fallback location. */
export function handleDrawFromScenarioDeck(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawFromScenarioDeck,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const [top] = cardsInZone(state, scenarioDeck(cmd.deck));
  if (top === undefined) throw new CommandRejected({ code: 'scenarioDeckEmpty', deck: cmd.deck });
  return spawnEvents(ctx, state, top, { investigatorId: investigator.id });
}

/** `DrawBeneath`: the facedown card beneath the investigator's location, turned up and spawned. */
export function handleDrawBeneath(ctx: EngineContext, state: GameState, cmd: DrawBeneath): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { locationId } = investigator;
  if (locationId === undefined)
    throw new CommandRejected({
      code: 'investigatorHasNoLocation',
      investigatorId: investigator.id,
    });
  const facedown = cardsInZone(state, { kind: 'beneath', hostId: locationId }).find(
    (id) => !requireCard(state.cards, id).faceUp,
  );
  if (facedown === undefined) throw new CommandRejected({ code: 'nothingBeneath', locationId });
  const flipped: CardFlipped = { type: 'CardFlipped', cardId: facedown, faceUp: true };
  return [
    flipped,
    ...spawnEvents(ctx, replay([flipped], state), facedown, { investigatorId: investigator.id }),
  ];
}

/** `FromSetAside`: moves one set-aside copy of each code to `to`. */
export function handleFromSetAside(state: GameState, cmd: FromSetAside): CardMoved[] {
  return takeFromSetAside(state, cmd.codes).map((cardId) =>
    cardMoved(state, requireCard(state.cards, cardId), cmd.to),
  );
}

/** `ShuffleInto`: adds one set-aside copy of each code to the zone and shuffles it. */
export function handleShuffleInto(state: GameState, cmd: ShuffleInto): Event[] {
  const cardIds = takeFromSetAside(state, cmd.codes, {
    asManyAsThereAre: cmd.source !== undefined,
  });
  return shuffleInto(state, cardIds, cmd.zone);
}

/** `ShuffleEncounterDeck`: the deck in a new order; an empty deck stays as it is. */
export function handleShuffleEncounterDeck(state: GameState): DeckShuffled[] {
  const deck = cardsInZone(state, encounterDeck);
  if (deck.length === 0) return [];
  const [order, rngState] = shuffle(deck, state.meta.rngState);
  return [{ type: 'DeckShuffled', zone: encounterDeck, order, rngState }];
}

/**
 * `ShuffleEncounterDiscard`: the whole discard goes into the encounter deck,
 * which is then shuffled. Rules Reference, "Discard Piles": shuffling an empty
 * discard pile into a deck does not shuffle the deck, so that yields nothing.
 */
export function handleShuffleEncounterDiscard(state: GameState): Event[] {
  return shuffleInto(state, cardsInZone(state, encounterDiscard), encounterDeck);
}

/**
 * `DiscardEncounterTop`: one card at a time, so a deck that runs out is refilled on the way and,
 * like after a draw (`placeDrawnCard`), once more if the last discard left it empty.
 */
export function handleDiscardEncounterTop(state: GameState, cmd: DiscardEncounterTop): Event[] {
  const discarded = range(cmd.count).reduce<Event[]>((events) => {
    const current = replay(events, state);
    const refill = refillIfEmpty(current);
    const refilled = replay(refill, current);
    const top = cardsInZone(refilled, encounterDeck)[0];
    if (top === undefined) return events;
    return [
      ...events,
      ...refill,
      cardMoved(refilled, requireCard(refilled.cards, top), encounterDiscard, 0),
    ];
  }, []);
  return [...discarded, ...refillIfEmpty(replay(discarded, state))];
}

/** Cards in the encounter deck and its discard, i.e. how many cards could still be drawn. */
export function encounterCardCount(state: GameState): number {
  return cardsInZone(state, encounterDeck).length + cardsInZone(state, encounterDiscard).length;
}

/**
 * Draws `target` (default: the top card of the encounter deck) into the
 * `resolving` zone and reveals it. `undefined` when there is no card left to
 * draw.
 */
function drawOne(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  target?: InstanceId,
): Event[] | undefined {
  // Draws keep the deck refilled themselves; an empty deck with a discard can
  // still come from a manual correction or a setup, and the rule applies then too.
  const refill = refillIfEmpty(state);
  const cardId = target ?? cardsInZone(replay(refill, state), encounterDeck)[0];
  if (cardId === undefined) return undefined;

  const stats = cardStats(ctx.cards, requireCard(state.cards, cardId).code);
  // Only a revelation the app resolves asks; one it has no abilities for the players do by hand.
  const asksRevelation =
    stats.typeCode === 'treachery' &&
    (stats.abilities ?? []).some((ability) => ability.window.kind === 'revealed');
  const drawn: EncounterCardDrawn = {
    type: 'EncounterCardDrawn',
    investigatorId: investigator.id,
    cardId,
    peril: hasKeyword(stats, 'peril'),
    surge: hasKeyword(stats, 'surge'),
    ...(asksRevelation && { asksRevelation: true }),
  };
  const resolving = cardMoved(
    replay(refill, state),
    requireCard(state.cards, cardId),
    resolvingZone,
  );
  const revealed: CardFlipped = { type: 'CardFlipped', cardId, faceUp: true };
  const asked: DecisionRequested[] = asksRevelation
    ? [{ type: 'DecisionRequested', decision: revelationDecision(cardId, investigator.id) }]
    : [];
  return [...refill, drawn, resolving, revealed, ...asked];
}

/**
 * The rest of a `DrawEncounter` once the drawn card's revelation has
 * resolved: the card is placed (`placement`), and if that left the deck
 * empty the discard is shuffled back in, so a discarded card is in the deck
 * again before the next draw. A card the revelation has already moved out of
 * `resolving` (`putIntoThreatArea`) is not placed, but the deck is still
 * refilled. A drawer who has left the scenario meanwhile
 * has no location or threat area to take the card (`withoutDrawer`).
 */
export function placeDrawnCard(
  ctx: EngineContext,
  state: GameState,
  drawn: EncounterCardDrawn,
): Event[] {
  const card = requireCard(state.cards, drawn.cardId);
  if (card.zone.kind !== 'resolving') return refillIfEmpty(state);
  const drawer = state.investigators.find((inv) => inv.id === drawn.investigatorId);
  const stats = cardStats(ctx.cards, card.code);
  const placed =
    drawer?.status === 'active'
      ? placement(ctx, state, stats, card.id, drawer)
      : withoutDrawer(ctx, state, stats, card);
  return [...placed, ...refillIfEmpty(replay(placed, state))];
}

/**
 * Rules Reference: "If the encounter deck is empty, shuffle the encounter
 * discard pile back into the encounter deck." Nothing while the deck has cards
 * or the discard is empty.
 */
function refillIfEmpty(state: GameState): Event[] {
  if (cardsInZone(state, encounterDeck).length > 0) return [];
  return shuffleInto(state, cardsInZone(state, encounterDiscard), encounterDeck);
}

/**
 * The events that place a drawn card, which waits in the `resolving` zone.
 * An enemy spawns (spawn instruction, engagement) like `SpawnEnemy`, with
 * the drawer as fallback location; every other card goes to the top of the
 * discard, unless its revelation put it somewhere else (`putIntoThreatArea`,
 * `attachToLocation`, `attachTo`). It runs once the revelation has resolved, a revelation test's answer
 * included (Rules Reference: a card is discarded after its revelation
 * resolves).
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
  // Index 0 is the top, and the discard's top is what "topmost" effects look for.
  return [cardMoved(state, card, encounterDiscard, 0)];
}

/**
 * The placement of a drawn card whose drawer was eliminated by its
 * revelation. An enemy with a spawn instruction still spawns there, since
 * the instruction does not need the drawer; without one it would spawn
 * engaged with the drawer, an instruction that can no longer be fulfilled,
 * so it is discarded (2026 Core rulebook p. 19). Any other card is
 * discarded, as the drawer's threat area and location are gone with them.
 * The rules have no explicit ruling on this case (rules.md, "Encounter
 * draws").
 */
function withoutDrawer(
  ctx: EngineContext,
  state: GameState,
  stats: CardStats,
  card: CardInstance,
): Event[] {
  const instructed = stats.keywords?.some((keyword) => keyword.name === 'spawn') ?? false;
  if (stats.typeCode === 'enemy' && instructed) return spawnEvents(ctx, state, card.id, {});
  return [cardMoved(state, card, encounterDiscard, 0)];
}

/**
 * Moves `cardIds` into `zone` and shuffles the whole zone with the state's
 * RNG. The shuffled order is in the event, so replaying never draws random
 * numbers. Nothing for an empty list, so an empty discard does not shuffle.
 */
function shuffleInto(state: GameState, cardIds: readonly InstanceId[], zone: Zone): Event[] {
  if (cardIds.length === 0) return [];
  const moves = cardIds.map((cardId) => cardMoved(state, requireCard(state.cards, cardId), zone));
  const remaining = cardsInZone(state, zone).filter((id) => !cardIds.includes(id));
  const [order, rngState] = shuffle([...remaining, ...cardIds], state.meta.rngState);
  const shuffled: DeckShuffled = { type: 'DeckShuffled', zone, order, rngState };
  return [...moves, shuffled];
}

/**
 * One set-aside copy of each code, in the order of `codes`; rejects a code with no copy left,
 * unless `asManyAsThereAre`, which skips it.
 */
function takeFromSetAside(
  state: GameState,
  codes: readonly CardCode[],
  { asManyAsThereAre = false }: { asManyAsThereAre?: boolean } = {},
): InstanceId[] {
  const { taken } = codes.reduce(
    (acc, code) => {
      const cardId = acc.available.find((id) => requireCard(state.cards, id).code === code);
      if (cardId === undefined && asManyAsThereAre) return acc;
      if (cardId === undefined)
        throw new CommandRejected({ code: 'cardNotInZone', zone: 'setAside', match: code });
      return {
        taken: [...acc.taken, cardId],
        available: acc.available.filter((id) => id !== cardId),
      };
    },
    { taken: [] as InstanceId[], available: cardsInZone(state, setAside) },
  );
  return taken;
}
