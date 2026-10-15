import { cardStats, type EngineContext } from './cards';
import {
  handleAddConnection,
  handleAddMap,
  handleRemoveConnection,
  handleRevealLocation,
  validateConnections,
} from './handle_board';
import {
  handleAdjustInvestigator,
  handleDiscoverClues,
  handleMoveInvestigator,
} from './handle_investigator';
import { handleDrawEncounter, handleFromSetAside, handleShuffleInto } from './handle_encounter';
import {
  handleDamageEnemy,
  handleDefeatEnemy,
  handleDisengageEnemy,
  handleEngageEnemy,
  handleExhaustEnemy,
  handleReadyEnemy,
} from './handle_enemy';
import { startingEngagements } from './engagement';
import { handleSpawnEnemy } from './spawn';
import { handleMoveHunters } from './hunters';
import { withAgendaCheck } from './doom';
import {
  completeAdvance,
  handleAdvanceAct,
  handleAdvanceAgenda,
  handleEndScenario,
  handlePlaceDoom,
} from './handle_scenario';
import type { Adjustment, Command, MoveCard, StartScenario, StartingCard } from './commands';
import type { CardMoved, DeckShuffled, Event, ScenarioStarted, TokensChanged } from './events';
import { instanceId, type InstanceId, type MapId } from './ids';
import { requireCard } from './lookup';
import { createMap, type GameMap, type MapSpec } from './map';
import { apply, replay } from './reducer';
import { CommandRejected, type Rejection } from './rejection';
import { shuffle } from './rng';
import type { CardInstance, GameState, Investigator, TokenKind } from './state';
import { cardMoved, validateZone, type ZoneRefs } from './placement';
import { MAX_TRIGGERED_COMMANDS, triggeredCommands } from './triggers';
import { zoneKey, type Zone } from './zone';

/**
 * Validates a command against the current state and returns the resulting events.
 * Card data comes from `ctx.cards`; whatever a rule reads from it ends up in the
 * events, so `apply` never needs the `CardDb`.
 *
 * The returned events include the whole chain of forced effects the command
 * triggered (`ctx.hooks`, `ctx.effects`): the follow-up commands are handled
 * like player commands after the events of the command that triggered them
 * (depth first, so a follow-up's own chain resolves before the next sibling),
 * and their events are appended to the originating command's list. A command
 * whose rules continue after those effects (advancing agenda/act, see
 * `completeCommand`) appends its remaining events and their chains, under the
 * same loop guard. One player command
 * therefore yields one list of events, which undo (M1.11) removes as a unit.
 * A rejected follow-up or a chain longer than `MAX_TRIGGERED_COMMANDS`
 * rejects the originating command, so a bad hook can neither hang the app nor
 * leave half its effect behind.
 * Pure: the same state, command and context always yield the same events.
 */
export function handle(ctx: EngineContext, state: GameState, command: Command): Event[] {
  return handleWithTriggers(ctx, state, command, { remaining: MAX_TRIGGERED_COMMANDS });
}

/** How many follow-up commands the current chain may still run; shared by the whole chain. */
interface TriggerBudget {
  remaining: number;
}

function handleWithTriggers(
  ctx: EngineContext,
  state: GameState,
  command: Command,
  budget: TriggerBudget,
): Event[] {
  const events = withForcedEffects(ctx, state, handleCommand(ctx, state, command), command, budget);
  const after = replay(events, state);
  const completion = completeCommand(state, after, command);
  if (completion.length === 0) return events;
  return [...events, ...withForcedEffects(ctx, after, completion, command, budget)];
}

/** `events` (produced from `state`) followed by the chains of forced effects they trigger. */
function withForcedEffects(
  ctx: EngineContext,
  state: GameState,
  events: Event[],
  command: Command,
  budget: TriggerBudget,
): Event[] {
  if (!firesTriggers(command)) return events;
  const followUps = triggeredCommands(ctx, state, events);
  let current = replay(events, state);
  const chain = [...events];
  for (const followUp of followUps) {
    if (budget.remaining === 0)
      throw new CommandRejected({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
    budget.remaining -= 1;
    const followUpEvents = handleFollowUp(ctx, current, followUp, budget);
    current = replay(followUpEvents, current);
    chain.push(...followUpEvents);
  }
  return chain;
}

/**
 * The rest of a command whose rules continue only after the forced effects
 * of its first events have resolved; empty for most commands. Advancing
 * agenda/act is the case: the reverse side resolves before the next card
 * becomes current (`completeAdvance`). `before` is the state the command
 * started from, `after` the state after its first events and their effects.
 */
function completeCommand(before: GameState, after: GameState, command: Command): Event[] {
  switch (command.type) {
    case 'AdvanceAgenda':
      return completeAdvance(before, after, 'agenda', command.resolution);
    case 'AdvanceAct':
      return completeAdvance(before, after, 'act', command.resolution);
    default:
      return [];
  }
}

/**
 * Corrections and setup are not game events: fixing a misplaced token must not
 * re-fire "after doom is placed", and cards put out during setup do not
 * "enter play".
 */
function firesTriggers(command: Command): boolean {
  return command.type !== 'ManualAdjust' && command.type !== 'StartScenario';
}

/** Handles a hook's command, naming the command when it is rejected. */
function handleFollowUp(
  ctx: EngineContext,
  state: GameState,
  command: Command,
  budget: TriggerBudget,
): Event[] {
  try {
    return handleWithTriggers(ctx, state, command, budget);
  } catch (error) {
    // Rethrow nested wrappers and loop reports as they are: the innermost reason is the useful one.
    if (!(error instanceof CommandRejected) || isChainRejection(error.rejection)) throw error;
    throw new CommandRejected({
      code: 'triggeredCommandRejected',
      command: command.type,
      reason: error.rejection,
    });
  }
}

function isChainRejection(rejection: Rejection): boolean {
  return rejection.code === 'triggerLoop' || rejection.code === 'triggeredCommandRejected';
}

/** The events of `command` alone, without the forced effects it triggers. */
function handleCommand(ctx: EngineContext, state: GameState, command: Command): Event[] {
  switch (command.type) {
    case 'StartScenario':
      return handleStartScenario(ctx, state, command);
    case 'ManualAdjust':
      return [handleAdjustment(state, command.adjustment)];
    case 'MoveCard':
      return [handleMoveCard(state, command)];
    case 'AddMap':
      return handleAddMap(ctx, state, command);
    case 'AddConnection':
      return handleAddConnection(ctx, state, command);
    case 'RemoveConnection':
      return handleRemoveConnection(ctx, state, command);
    case 'RevealLocation':
      return handleRevealLocation(ctx, state, command);
    case 'MoveInvestigator':
      return handleMoveInvestigator(ctx, state, command);
    case 'AdjustInvestigator':
      return command.stat === 'doomOnPlayerCards'
        ? withAgendaCheck(ctx, state, handleAdjustInvestigator(state, command))
        : handleAdjustInvestigator(state, command);
    case 'DiscoverClues':
      return handleDiscoverClues(state, command);
    case 'PlaceDoom':
      return withAgendaCheck(ctx, state, handlePlaceDoom(state, command));
    case 'AdvanceAgenda':
      return handleAdvanceAgenda(state, command);
    case 'AdvanceAct':
      return handleAdvanceAct(ctx, state, command);
    case 'EndScenario':
      return handleEndScenario(command);
    case 'DrawEncounter':
      return handleDrawEncounter(ctx, state, command);
    case 'FromSetAside':
      return handleFromSetAside(state, command);
    case 'ShuffleInto':
      return handleShuffleInto(state, command);
    case 'SpawnEnemy':
      return handleSpawnEnemy(ctx, state, command);
    case 'EngageEnemy':
      return handleEngageEnemy(ctx, state, command);
    case 'DisengageEnemy':
      return handleDisengageEnemy(ctx, state, command);
    case 'DamageEnemy':
      return handleDamageEnemy(ctx, state, command);
    case 'DefeatEnemy':
      return handleDefeatEnemy(ctx, state, command);
    case 'ExhaustEnemy':
      return handleExhaustEnemy(ctx, state, command);
    case 'ReadyEnemy':
      return handleReadyEnemy(ctx, state, command);
    case 'MoveHunters':
      return handleMoveHunters(ctx, state);
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
  const shuffled =
    (cmd.shuffleEncounterDeck ?? true)
      ? [started, ...encounterDeckShuffle(apply(state, started))]
      : [started];
  return [...shuffled, ...startingEngagements(ctx, replay(shuffled, state))];
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

/** `MoveCard`: the same move a `ManualAdjust` makes, as a game event. */
function handleMoveCard(state: GameState, cmd: MoveCard): CardMoved {
  return cardMoved(state, requireCard(state.cards, cmd.cardId), cmd.to);
}

function handleAdjustment(state: GameState, adj: Adjustment): CardMoved | TokensChanged {
  const card = requireCard(state.cards, adj.cardId);

  switch (adj.kind) {
    case 'moveCard':
      return cardMoved(state, card, adj.to, adj.index);
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
