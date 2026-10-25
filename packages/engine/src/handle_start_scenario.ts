import { cardStats, type EngineContext } from './cards';
import type { StartScenario, StartingCard, StartingInvestigator } from './commands';
import { readyEnemyEngagements } from './engagement';
import type { DeckShuffled, Event, ScenarioStarted } from './events';
import { validateConnections, validateLayout } from './board';
import { instanceId, type InstanceId, type MapId } from './ids';
import { requireCard } from './lookup';
import { createMap, type GameMap, type MapSpec } from './map';
import { validateZone, type ZoneRefs } from './placement';
import { apply, replay } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, GameState, TokenKind } from './state';
import { BASE_ACTIONS_PER_TURN } from './turns';
import { zoneKey, type Zone } from './zone';

/**
 * `StartScenario`: validates the compiled setup (card codes, zones,
 * connections, starting locations) and returns `ScenarioStarted`, the
 * encounter deck's shuffle and the engagements of enemies that start at an
 * investigator's location.
 */
export function handleStartScenario(
  ctx: EngineContext,
  state: GameState,
  cmd: StartScenario,
): Event[] {
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
  for (const [mapId, map] of Object.entries(maps) as [MapId, GameMap][])
    validateLayout(mapId, map, locationsOn(cards, mapId));
  for (const inv of cmd.investigators) {
    if (inv.locationId !== undefined) validateLocation(byId, inv.locationId);
  }

  const started: ScenarioStarted = {
    type: 'ScenarioStarted',
    scenarioId: cmd.scenarioId,
    difficulty: cmd.difficulty,
    seed: cmd.seed,
    investigators: cmd.investigators.map((inv) => ({
      ...inv,
      actionsRemaining: BASE_ACTIONS_PER_TURN,
    })),
    maps,
    cards,
    chaosBag: cmd.chaosBag ?? [],
    ...(cmd.campaign ? { campaign: cmd.campaign } : {}),
  };
  const shuffled =
    (cmd.shuffleEncounterDeck ?? true)
      ? [started, ...encounterDeckShuffle(apply(state, started))]
      : [started];
  return [...shuffled, ...readyEnemyEngagements(ctx, replay(shuffled, state))];
}

/** The investigators' IDs; rejects a duplicate. */
function uniqueInvestigatorIds(investigators: readonly StartingInvestigator[]): Set<string> {
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
  const card = requireCard(cards, cardId);
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

/** The starting cards placed on map `mapId`, the locations its layout may give cells to. */
function locationsOn(cards: readonly CardInstance[], mapId: MapId): ReadonlySet<InstanceId> {
  return new Set(
    cards
      .filter((card) => card.zone.kind === 'location' && card.zone.mapId === mapId)
      .map((card) => card.id),
  );
}
