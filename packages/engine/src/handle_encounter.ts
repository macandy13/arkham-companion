import { asArray } from '@arkham/util';
import { cardStats, type CardStats, type EngineContext } from './cards';
import type {
  DrawCard,
  DrawWeakness,
  EncounterMatch,
  GainSurge,
  ResolveRevelation,
} from './commands';
import type {
  CardFlipped,
  DeckShuffled,
  EncounterCardDrawn,
  DecisionRequested,
  Event,
  RevelationResolved,
  SurgeGained,
  WeaknessDrawn,
} from './events';
import { decisionId, type InstanceId, type InvestigatorId } from './ids';
import { activeInvestigator, isActiveInvestigator, findInvestigator } from './investigators';
import { hasKeyword } from './keywords';
import { cardsInZone, newCardId, requireCard } from './lookup';
import { cardMoved } from './placement';
import { discardPileOf } from './player_cards';
import { spawnEvents } from './spawn';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, Decision, GameState, Investigator } from './state';
import { encounterDeck, encounterDiscard, resolvingZone, sameZone, type Zone } from './zone';

/**
 * `DrawCard`: draws one card into the `resolving` zone and turns it face up. The card is the top
 * of `from` or the one `pick` finds; all go through `revealDrawn`, so a card taken from the
 * discard, the Cultist deck or beneath a location is revealed and placed exactly like one from the
 * encounter deck. Placing it waits: Rules Reference, "Revelation": the revelation resolves as the
 * card is drawn, before an enemy spawns or a treachery is placed or discarded, so `handle` places
 * it (`placeDrawnCard`) only after the forced effects of the reveal, and draws again for surge
 * (`surgeDraw`) after that.
 */
export function handleDrawCard(ctx: EngineContext, state: GameState, cmd: DrawCard): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const zones = asArray(cmd.from);
  const { pick } = cmd;
  if (pick === undefined) return drawTop(ctx, state, investigator, zones[0] ?? encounterDeck);
  if ('card' in pick) {
    const { zone } = requireCard(state.cards, pick.card);
    return zones.some((from) => sameZone(from, zone))
      ? drawFound(ctx, state, investigator, pick.card)
      : [];
  }
  const target = findMatch(ctx, state, zones, pick.match);
  const [only, ...others] = zones;
  const fromDeck = only !== undefined && others.length === 0 && sameZone(only, encounterDeck);
  if (target === undefined)
    return pick.discardSkipped && fromDeck
      ? discardDeckForDiscardMatch(ctx, state, cmd, pick.match)
      : [];
  // Only a deck match has cards above it to discard; a discard match has none.
  const skipped = (pick.discardSkipped ? cardsAbove(state, target) : []).map((id) =>
    cardMoved(state, requireCard(state.cards, id), encounterDiscard, 0),
  );
  return [...skipped, ...drawFound(ctx, replay(skipped, state), investigator, target)];
}

/**
 * The top card of `from`: from the encounter deck with its discard shuffled back in first when
 * the deck is empty (`drawOne`); rejected when there is none.
 */
function drawTop(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  from: Zone,
): Event[] {
  if (sameZone(from, encounterDeck)) return drawOne(ctx, state, investigator) ?? rejectEmptyDeck();
  const [top] = cardsInZone(state, from);
  if (top === undefined) throw new CommandRejected({ code: 'nothingToDraw', zone: from });
  return revealDrawn(ctx, state, investigator, top);
}

/** A card a `pick` found: an encounter card goes through `drawOne`'s refill, any other is revealed. */
function drawFound(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  cardId: InstanceId,
): Event[] {
  const { kind } = requireCard(state.cards, cardId).zone;
  if (kind !== 'encounterDeck' && kind !== 'encounterDiscard')
    return revealDrawn(ctx, state, investigator, cardId);
  return drawOne(ctx, state, investigator, cardId) ?? rejectEmptyDeck();
}

/**
 * Discarding until a match turns up with no match left in the deck (Infested Pipes late in the
 * scenario): Rules Reference, "Encounter Deck": the deck runs out, so the discard – now holding
 * the whole deck – is shuffled back and the discarding goes on until the match from the discard
 * turns up. Without a match in the discard either, nothing fits and the effect resolves as far as
 * it can (Golden Rules): discarding and shuffling back would end where it started, as after Rise
 * of the Ghouls' own shuffle.
 */
function discardDeckForDiscardMatch(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawCard,
  match: EncounterMatch,
): Event[] {
  if (findMatch(ctx, state, [encounterDiscard], match) === undefined) return [];
  const discarded = cardsInZone(state, encounterDeck).map((id) =>
    cardMoved(state, requireCard(state.cards, id), encounterDiscard, 0),
  );
  const emptied = replay(discarded, state);
  const shuffled = shuffleInto(emptied, cardsInZone(emptied, encounterDiscard), encounterDeck);
  return [...discarded, ...shuffled, ...handleDrawCard(ctx, replay(shuffled, emptied), cmd)];
}

function rejectEmptyDeck(): never {
  throw new CommandRejected({ code: 'encounterDeckEmpty' });
}

/**
 * The surge draw that follows `events`, the events of one `DrawCard`
 * without its forced effects: another draw from the top for the same
 * investigator if the drawn card has surge. Rules Reference, "Surge": the
 * draw comes after the card has resolved, so `handle` runs it only after the
 * card's forced effects and decisions.
 */
export function surgeDraw(events: readonly Event[]): DrawCard | undefined {
  const drawn = events.find((event) => event.type === 'EncounterCardDrawn');
  return drawn?.surge ? encounterDraw(drawn.investigatorId) : undefined;
}

/** `investigatorId` draws the top card of the encounter deck: the mythos draw, a surge. */
export function encounterDraw(investigatorId: InvestigatorId): DrawCard {
  return { type: 'DrawCard', investigatorId, from: encounterDeck };
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
function revelationDecision(cardId: InstanceId, investigatorId: InvestigatorId): Decision {
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
 * The first card of `zones` that fulfils every field of `match`, each zone top-down in order;
 * none when no card matches.
 */
function findMatch(
  ctx: EngineContext,
  state: GameState,
  zones: readonly Zone[],
  match: EncounterMatch,
): InstanceId | undefined {
  return zones
    .flatMap((zone) => cardsInZone(state, zone))
    .find((id) => matchesEncounter(cardStats(ctx.cards, requireCard(state.cards, id).code), match));
}

/**
 * Whether the card fulfils every field `match` sets, as a matched
 * `DrawCard` checks it.
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
 * The cards a surge chain that starts with the draw in `events` can draw (`TriggerBudget`): those
 * in the encounter deck and its discard (`encounterCardCount`), plus a first card drawn from
 * elsewhere, which is none of them: a weakness from a player deck (not in `state` yet), a card
 * from the Cultist deck or beneath a location (`DrawCard`).
 */
export function surgeChainCards(state: GameState, events: readonly Event[]): number {
  const drawn = events.find((event) => event.type === 'EncounterCardDrawn');
  const from = drawn && state.cards[drawn.cardId]?.zone.kind;
  const fromElsewhere =
    drawn !== undefined && from !== 'encounterDeck' && from !== 'encounterDiscard' ? 1 : 0;
  return encounterCardCount(state) + fromElsewhere;
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
  return [...refill, ...revealDrawn(ctx, replay(refill, state), investigator, cardId)];
}

/**
 * `DrawWeakness`: the weakness comes into the game as a new card the drawer owns, and is then
 * drawn like an encounter card (`revealDrawn`), so its revelation, peril, surge and placement are
 * the encounter draw's.
 */
export function handleDrawWeakness(
  ctx: EngineContext,
  state: GameState,
  cmd: DrawWeakness,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { typeCode } = cardStats(ctx.cards, cmd.code);
  if (typeCode !== 'enemy' && typeCode !== 'treachery')
    throw new CommandRejected({ code: 'notAWeaknessToDraw', cardCode: cmd.code });
  const drawn: WeaknessDrawn = {
    type: 'WeaknessDrawn',
    cardId: newCardId(state, `${investigator.id}:weakness`),
    code: cmd.code,
    investigatorId: investigator.id,
  };
  return [drawn, ...revealDrawn(ctx, replay([drawn], state), investigator, drawn.cardId)];
}

/**
 * Moves `cardId` into the `resolving` zone and reveals it as drawn by `investigator`; a treachery
 * whose revelation the app resolves asks the players first (`revelationDecision`).
 */
function revealDrawn(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  cardId: InstanceId,
): Event[] {
  const stats = cardStats(ctx.cards, requireCard(state.cards, cardId).code);
  // Only a revelation the app resolves asks; one it has no abilities for the players do by hand.
  const asksRevelation =
    stats.typeCode === 'treachery' &&
    (stats.abilities ?? []).some((ability) => ability.window.on === 'revealed');
  const drawn: EncounterCardDrawn = {
    type: 'EncounterCardDrawn',
    investigatorId: investigator.id,
    cardId,
    peril: hasKeyword(stats, 'peril'),
    surge: hasKeyword(stats, 'surge'),
    ...(asksRevelation && { asksRevelation: true }),
  };
  const resolving = cardMoved(state, requireCard(state.cards, cardId), resolvingZone);
  const revealed: CardFlipped = { type: 'CardFlipped', cardId, faceUp: true };
  const asked: DecisionRequested[] = asksRevelation
    ? [{ type: 'DecisionRequested', decision: revelationDecision(cardId, investigator.id) }]
    : [];
  return [drawn, resolving, revealed, ...asked];
}

/**
 * The rest of a `DrawCard` once the drawn card's revelation has
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
  const drawer = findInvestigator(state, drawn.investigatorId);
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
  return [cardMoved(state, card, discardPileOf(ctx, card), 0)];
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
  return [cardMoved(state, card, discardPileOf(ctx, card), 0)];
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
