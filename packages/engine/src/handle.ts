import { cardStats, type EngineContext } from './cards';
import {
  handleAddConnection,
  handleRemoveConnection,
  handleRevealLocation,
  validateConnections,
} from './handle-board';
import {
  handleAdjustInvestigator,
  handleDiscoverClues,
  handleMoveInvestigator,
} from './handle-investigator';
import type { Adjustment, Command, StartScenario, StartingCard } from './commands';
import type { CardMoved, DeckShuffled, Event, ScenarioStarted, TokensChanged } from './events';
import { instanceId, type InstanceId, type MapId } from './ids';
import { createMap, type GameMap, type MapSpec } from './map';
import { apply } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, GameState, Investigator, TokenKind } from './state';
import { sameZone, zoneKey, type Zone } from './zone';

/**
 * Validates a command against the current state and returns the resulting events.
 * Card data comes from `ctx.cards`; whatever a rule reads from it ends up in the
 * events, so `apply` never needs the `CardDb`.
 * Pure: the same state, command and card data always yield the same events.
 */
export function handle(ctx: EngineContext, state: GameState, command: Command): Event[] {
  switch (command.type) {
    case 'StartScenario':
      return handleStartScenario(ctx, state, command);
    case 'ManualAdjust':
      return [handleAdjustment(state, command.adjustment)];
    case 'AddConnection':
      return handleAddConnection(ctx, state, command);
    case 'RemoveConnection':
      return handleRemoveConnection(ctx, state, command);
    case 'RevealLocation':
      return handleRevealLocation(ctx, state, command);
    case 'MoveInvestigator':
      return handleMoveInvestigator(ctx, state, command);
    case 'AdjustInvestigator':
      return handleAdjustInvestigator(state, command);
    case 'DiscoverClues':
      return handleDiscoverClues(state, command);
  }
}

function handleStartScenario(ctx: EngineContext, state: GameState, cmd: StartScenario): Event[] {
  if (!Number.isInteger(cmd.seed))
    throw new CommandRejected({ code: 'invalidSeed', seed: cmd.seed });
  // Catch typos in scenario data at setup instead of when a rule first needs the card.
  for (const card of cmd.cards) cardStats(ctx.cards, card.code);
  const investigatorIds = uniqueInvestigatorIds(cmd.investigators);
  const maps = startingMaps(cmd.maps ?? {});
  const cards = startingInstances(cmd.cards);
  const byId = cardsById(cards);
  const refs: ZoneRefs = {
    cards: byId,
    investigators: investigatorIds,
    maps: new Set(Object.keys(maps)),
  };
  for (const card of cards) validateZone(refs, card.id, card.zone);
  validateConnections(ctx, byId, maps);
  for (const inv of cmd.investigators) {
    if (inv.locationId !== undefined) validateLocation(byId, inv.locationId);
  }

  const started: ScenarioStarted = {
    type: 'ScenarioStarted',
    scenarioId: cmd.scenarioId,
    difficulty: cmd.difficulty,
    seed: cmd.seed,
    investigators: cmd.investigators,
    maps,
    cards,
    chaosBag: cmd.chaosBag ?? [],
    ...(cmd.campaign ? { campaign: cmd.campaign } : {}),
  };
  if (!(cmd.shuffleEncounterDeck ?? true)) return [started];
  return [started, ...encounterDeckShuffle(apply(state, started))];
}

/** The investigators' IDs; rejects a duplicate. */
function uniqueInvestigatorIds(investigators: readonly Investigator[]): Set<string> {
  const ids = new Set<string>();
  for (const inv of investigators) {
    if (ids.has(inv.id))
      throw new CommandRejected({ code: 'duplicateInvestigator', investigatorId: inv.id });
    ids.add(inv.id);
  }
  return ids;
}

/** Card instances for the starting cards; rejects invalid token counts. */
function startingInstances(starting: readonly StartingCard[]): CardInstance[] {
  return starting.map((c, i) => {
    const id = c.id ?? instanceId(`c${i}`);
    const tokens = c.tokens ?? {};
    for (const [token, amount] of Object.entries(tokens) as [TokenKind, number][]) {
      if (!Number.isInteger(amount) || amount < 0)
        throw new CommandRejected({ code: 'invalidStartingTokens', cardId: id, token, amount });
    }
    return {
      id,
      code: c.code,
      zone: c.zone,
      faceUp: c.faceUp ?? false,
      exhausted: false,
      tokens,
      flags: {},
    };
  });
}

/** Indexes cards by ID; rejects a duplicate ID. */
function cardsById(cards: readonly CardInstance[]): Record<InstanceId, CardInstance> {
  const byId: Record<InstanceId, CardInstance> = {};
  for (const card of cards) {
    if (byId[card.id]) throw new CommandRejected({ code: 'duplicateCard', cardId: card.id });
    byId[card.id] = card;
  }
  return byId;
}

/** The game maps for the command's map specs. */
function startingMaps(specs: Readonly<Record<MapId, MapSpec>>): Record<MapId, GameMap> {
  const maps: Record<MapId, GameMap> = {};
  for (const [id, spec] of Object.entries(specs) as [MapId, MapSpec][]) maps[id] = createMap(spec);
  return maps;
}

/** Rejects `cardId` unless it is a known card on a map. */
function validateLocation(cards: Record<InstanceId, CardInstance>, cardId: InstanceId): void {
  const card = cards[cardId];
  if (!card) throw new CommandRejected({ code: 'unknownCard', cardId });
  if (card.zone.kind !== 'location') throw new CommandRejected({ code: 'notALocation', cardId });
}

/** A `DeckShuffled` for the encounter deck, or nothing if there is nothing to shuffle. */
function encounterDeckShuffle(state: GameState): DeckShuffled[] {
  const zone: Zone = { kind: 'encounterDeck' };
  const deck = state.order[zoneKey(zone)] ?? [];
  if (deck.length < 2) return [];
  const [order, rngState] = shuffle(deck, state.meta.rngState);
  return [{ type: 'DeckShuffled', zone, order, rngState }];
}

function handleAdjustment(state: GameState, adj: Adjustment): CardMoved | TokensChanged {
  const card = state.cards[adj.cardId];
  if (!card) throw new CommandRejected({ code: 'unknownCard', cardId: adj.cardId });

  switch (adj.kind) {
    case 'moveCard': {
      validateZone(
        {
          cards: state.cards,
          investigators: new Set(state.investigators.map((i) => i.id)),
          maps: new Set(Object.keys(state.board.maps)),
        },
        card.id,
        adj.to,
      );
      const destSize = (state.order[zoneKey(adj.to)] ?? []).length;
      // When reordering within a zone the card itself is removed first.
      const maxIndex = sameZone(card.zone, adj.to) ? destSize - 1 : destSize;
      if (
        adj.index !== undefined &&
        (!Number.isInteger(adj.index) || adj.index < 0 || adj.index > maxIndex)
      ) {
        throw new CommandRejected({ code: 'indexOutOfRange', index: adj.index, max: maxIndex });
      }
      return {
        type: 'CardMoved',
        cardId: card.id,
        from: card.zone,
        to: adj.to,
        ...(adj.index !== undefined ? { index: adj.index } : {}),
      };
    }
    case 'tokens': {
      if (!Number.isInteger(adj.delta) || adj.delta === 0) {
        throw new CommandRejected({ code: 'invalidTokenDelta', delta: adj.delta });
      }
      if ((card.tokens[adj.token] ?? 0) + adj.delta < 0) {
        throw new CommandRejected({
          code: 'negativeTokens',
          cardId: card.id,
          token: adj.token,
          current: card.tokens[adj.token] ?? 0,
          delta: adj.delta,
        });
      }
      return { type: 'TokensChanged', cardId: card.id, token: adj.token, delta: adj.delta };
    }
  }
}

/** The IDs a zone may refer to, used to validate card placements. */
interface ZoneRefs {
  cards: Record<InstanceId, CardInstance>;
  investigators: ReadonlySet<string>;
  maps: ReadonlySet<string>;
}

/** Checks that every ID a zone refers to exists and that hosting creates no cycle. */
function validateZone(refs: ZoneRefs, cardId: InstanceId, zone: Zone): void {
  switch (zone.kind) {
    case 'location':
      if (!refs.maps.has(zone.mapId))
        throw new CommandRejected({ code: 'unknownMap', mapId: zone.mapId });
      return;
    case 'engaged':
    case 'threatArea':
      if (!refs.investigators.has(zone.investigatorId)) {
        throw new CommandRejected({
          code: 'unknownInvestigator',
          investigatorId: zone.investigatorId,
        });
      }
      return;
    case 'atLocation':
    case 'attachedTo': {
      const hostId = zone.kind === 'atLocation' ? zone.locationId : zone.hostId;
      // Follow the host chain; reaching the moved card again would be a cycle.
      const seen = new Set<InstanceId>();
      let current: InstanceId | undefined = hostId;
      while (current !== undefined) {
        if (current === cardId) throw new CommandRejected({ code: 'hostingCycle', cardId, hostId });
        if (seen.has(current)) break;
        seen.add(current);
        const host: CardInstance | undefined = refs.cards[current];
        if (!host) throw new CommandRejected({ code: 'unknownCard', cardId: current });
        current = hostOf(host.zone);
      }
      return;
    }
    default:
      return;
  }
}

/** The card hosting a card in `zone`, if any (enemy at a location, attachment). */
function hostOf(zone: Zone): InstanceId | undefined {
  if (zone.kind === 'atLocation') return zone.locationId;
  if (zone.kind === 'attachedTo') return zone.hostId;
  return undefined;
}
