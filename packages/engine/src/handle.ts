import { cardStats, type EngineContext } from './cards';
import type { Adjustment, Command, StartScenario } from './commands';
import type { CardMoved, Event, ScenarioStarted, TokensChanged } from './events';
import { instanceId, type InstanceId, type MapId } from './ids';
import { apply } from './reducer';
import { CommandRejected } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, GameState } from './state';
import { sameZone, zoneKey, type Zone } from './zone';

/**
 * Validates a command against the current state and returns the resulting events.
 * Card data comes from `ctx.cards`; whatever a rule reads from it ends up in the
 * events, so `apply` never needs the `CardDb`.
 * Pure: the same state, command and card data always yield the same events.
 */
export function handle(state: GameState, command: Command, ctx: EngineContext): Event[] {
  switch (command.type) {
    case 'StartScenario':
      return handleStartScenario(state, command, ctx);
    case 'ManualAdjust':
      return [handleAdjustment(state, command.adjustment)];
  }
}

function handleStartScenario(state: GameState, cmd: StartScenario, ctx: EngineContext): Event[] {
  if (!Number.isInteger(cmd.seed))
    throw new CommandRejected({ code: 'invalidSeed', seed: cmd.seed });
  // Catch typos in scenario data at setup instead of when a rule first needs the card.
  for (const card of cmd.cards) cardStats(ctx.cards, card.code);
  const investigatorIds = new Set<string>();
  for (const inv of cmd.investigators) {
    if (investigatorIds.has(inv.id))
      throw new CommandRejected({ code: 'duplicateInvestigator', investigatorId: inv.id });
    investigatorIds.add(inv.id);
  }

  const maps: ScenarioStarted['maps'] = {};
  for (const [id, m] of Object.entries(cmd.maps ?? {})) {
    maps[id as MapId] = { name: m.name, visible: m.visible ?? true };
  }

  const cards: CardInstance[] = cmd.cards.map((c, i) => ({
    id: c.id ?? instanceId(`c${i}`),
    code: c.code,
    zone: c.zone,
    faceUp: c.faceUp ?? false,
    exhausted: false,
    tokens: {},
    flags: {},
  }));
  const byId: Record<InstanceId, CardInstance> = {};
  for (const card of cards) {
    if (byId[card.id]) throw new CommandRejected({ code: 'duplicateCard', cardId: card.id });
    byId[card.id] = card;
  }
  const refs: ZoneRefs = {
    cards: byId,
    investigators: investigatorIds,
    maps: new Set(Object.keys(maps)),
  };
  for (const card of cards) validateZone(refs, card.id, card.zone);

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
  const events: Event[] = [started];

  if (cmd.shuffleEncounterDeck ?? true) {
    const afterStart = apply(state, started);
    const zone: Zone = { kind: 'encounterDeck' };
    const deck = afterStart.order[zoneKey(zone)] ?? [];
    if (deck.length > 1) {
      const [order, rngState] = shuffle(deck, afterStart.meta.rngState);
      events.push({ type: 'DeckShuffled', zone, order, rngState });
    }
  }
  return events;
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
