import { cardStats, resolveValue, type CardStats, type EngineContext } from './cards';
import type {
  DamageEnemy,
  DefeatEnemy,
  DisengageEnemy,
  EngageEnemy,
  ExhaustEnemy,
  ReadyEnemy,
  SpawnEnemy,
} from './commands';
import { chooseLocation, engageEvents } from './engagement';
import type { CardMoved, EnemyDefeated, EnemyEngaged, Event, ExhaustChanged } from './events';
import { activeInvestigator } from './handle-investigator';
import type { InstanceId, InvestigatorId } from './ids';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import type { Zone } from './zone';

const ENCOUNTER_DISCARD: Zone = { kind: 'encounterDiscard' };
const VICTORY_DISPLAY: Zone = { kind: 'victoryDisplay' };

/** Where an enemy is spawned: the explicit location and the investigator who drew it. */
export interface SpawnTarget {
  at?: InstanceId;
  investigatorId?: InvestigatorId;
}

/** `SpawnEnemy`: see `spawnEvents`. */
export function handleSpawnEnemy(ctx: EngineContext, state: GameState, cmd: SpawnEnemy): Event[] {
  return spawnEvents(ctx, state, cmd.enemyId, cmd);
}

/**
 * Puts the enemy into play at its spawn location and lets it engage. Shared by
 * `SpawnEnemy` and `DrawEncounter`, so a drawn enemy follows exactly the same
 * rules as one spawned by a card effect. See `spawnPlan` for where it appears.
 *
 * Rules Reference, "Spawn": with several qualifying locations the investigator
 * chooses, with none the enemy is discarded. A choice (several matches, or
 * spawn text the engine cannot read) raises a `chooseLocation` decision (id
 * `spawn:<enemy>`) and leaves the enemy where it is; answering it needs
 * `ResolveDecision` (M1.9), until then the players move it with `ManualAdjust`.
 * A drawn enemy without a spawn instruction engages the drawer, whatever its
 * prey ("Spawn" in the Rules Reference); prey only picks among investigators
 * for an enemy that spawns elsewhere.
 */
export function spawnEvents(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
  target: SpawnTarget,
): Event[] {
  const { enemy, stats } = enemyOf(ctx, state, enemyId);
  if (isInPlay(enemy)) throw new CommandRejected({ code: 'enemyAlreadyInPlay', cardId: enemyId });
  const plan = spawnPlan(ctx, state, enemy, stats, target);
  if (plan.kind === 'choose')
    return chooseLocation(
      ctx,
      state,
      enemyId,
      `spawn:${enemyId}`,
      'decision.chooseSpawnLocation',
      plan.candidates,
    );
  if (plan.kind === 'discard')
    return [
      { type: 'CardMoved', cardId: enemyId, from: enemy.zone, to: ENCOUNTER_DISCARD, index: 0 },
    ];
  const placed: CardMoved = {
    type: 'CardMoved',
    cardId: enemyId,
    from: enemy.zone,
    to: { kind: 'atLocation', locationId: plan.locationId },
  };
  return [placed, ...engageEvents(ctx, replay([placed], state), enemyId, plan.drawerId)];
}

/** `EngageEnemy`: the enemy engages the investigator, who must be at its location. */
export function handleEngageEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: EngageEnemy,
): EnemyEngaged[] {
  const { enemy } = inPlayEnemyOf(ctx, state, cmd.enemyId);
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (enemy.zone.kind === 'engaged' && enemy.zone.investigatorId === investigator.id)
    throw new CommandRejected({
      code: 'alreadyEngaged',
      cardId: enemy.id,
      investigatorId: investigator.id,
    });
  const enemyLocation = locationOf(state, enemy);
  if (enemyLocation !== investigator.locationId)
    throw new CommandRejected({
      code: 'investigatorNotAtLocation',
      investigatorId: investigator.id,
      locationId: enemyLocation,
    });
  return [{ type: 'EnemyEngaged', enemyId: enemy.id, investigatorId: investigator.id }];
}

/** `DisengageEnemy`: the enemy stays at the location of the investigator it was engaged with. */
export function handleDisengageEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: DisengageEnemy,
): Event[] {
  const { enemy } = inPlayEnemyOf(ctx, state, cmd.enemyId);
  if (enemy.zone.kind !== 'engaged')
    throw new CommandRejected({ code: 'notEngaged', cardId: enemy.id });
  return [
    {
      type: 'EnemyDisengaged',
      enemyId: enemy.id,
      locationId: locationOf(state, enemy),
    },
  ];
}

/** `DamageEnemy`: adds damage and defeats the enemy in the same step once it has as much as its health. */
export function handleDamageEnemy(ctx: EngineContext, state: GameState, cmd: DamageEnemy): Event[] {
  const { enemy, stats } = inPlayEnemyOf(ctx, state, cmd.enemyId);
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  const damaged: Event = {
    type: 'TokensChanged',
    cardId: enemy.id,
    token: 'damage',
    delta: cmd.amount,
  };
  const total = (enemy.tokens.damage ?? 0) + cmd.amount;
  // An enemy without printed health cannot be defeated by damage.
  if (stats.health === undefined || total < resolveValue(stats.health, state.meta.playerCount))
    return [damaged];
  return [damaged, defeated(enemy.id, stats)];
}

/** `DefeatEnemy`: to the victory display if the card has victory, else to the encounter discard. */
export function handleDefeatEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: DefeatEnemy,
): EnemyDefeated[] {
  const { enemy, stats } = inPlayEnemyOf(ctx, state, cmd.enemyId);
  return [defeated(enemy.id, stats)];
}

/** `ExhaustEnemy`. */
export function handleExhaustEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: ExhaustEnemy,
): ExhaustChanged[] {
  return [exhaustChange(inPlayEnemyOf(ctx, state, cmd.enemyId).enemy, true)];
}

/**
 * `ReadyEnemy`: readies the enemy; one that is unengaged then engages an
 * investigator at its location (Rules Reference, "Engaged").
 */
export function handleReadyEnemy(ctx: EngineContext, state: GameState, cmd: ReadyEnemy): Event[] {
  const change = exhaustChange(inPlayEnemyOf(ctx, state, cmd.enemyId).enemy, false);
  return [change, ...engageEvents(ctx, replay([change], state), cmd.enemyId)];
}

/** A card that is an enemy by type, with its stats; rejects anything else. */
export function enemyOf(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
): { enemy: CardInstance; stats: CardStats } {
  const enemy = state.cards[enemyId];
  if (!enemy) throw new CommandRejected({ code: 'unknownCard', cardId: enemyId });
  const stats = cardStats(ctx.cards, enemy.code);
  if (stats.typeCode !== 'enemy')
    throw new CommandRejected({ code: 'notAnEnemy', cardId: enemyId });
  return { enemy, stats };
}

/** Whether the enemy is on the table: unengaged at a location or engaged with an investigator. */
export function isInPlay(enemy: CardInstance): boolean {
  return enemy.zone.kind === 'atLocation' || enemy.zone.kind === 'engaged';
}

function inPlayEnemyOf(ctx: EngineContext, state: GameState, enemyId: InstanceId) {
  const found = enemyOf(ctx, state, enemyId);
  if (!isInPlay(found.enemy))
    throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemyId });
  return found;
}

/** The location an enemy in play is at; an engaged enemy is where its investigator is. */
function locationOf(state: GameState, enemy: CardInstance): InstanceId {
  if (enemy.zone.kind === 'atLocation') return enemy.zone.locationId;
  if (enemy.zone.kind === 'engaged') {
    const { investigatorId } = enemy.zone;
    const location = state.investigators.find((inv) => inv.id === investigatorId)?.locationId;
    if (location !== undefined) return location;
    throw new CommandRejected({ code: 'investigatorHasNoLocation', investigatorId });
  }
  throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
}

function defeated(enemyId: InstanceId, stats: CardStats): EnemyDefeated {
  const hasVictory = (stats.victory ?? 0) > 0;
  return { type: 'EnemyDefeated', enemyId, to: hasVictory ? VICTORY_DISPLAY : ENCOUNTER_DISCARD };
}

function exhaustChange(enemy: CardInstance, exhausted: boolean): ExhaustChanged {
  if (enemy.exhausted === exhausted)
    throw new CommandRejected({ code: 'exhaustUnchanged', cardId: enemy.id, exhausted });
  return { type: 'ExhaustChanged', cardId: enemy.id, exhausted };
}

/**
 * Where the enemy spawns: `target.at`; else its `spawn` instruction; else the
 * drawer's location, where the drawer (`drawerId`) is engaged regardless of prey.
 */
type SpawnPlan =
  | { kind: 'at'; locationId: InstanceId; drawerId?: InvestigatorId }
  | { kind: 'choose'; candidates: InstanceId[] }
  | { kind: 'discard' };

function spawnPlan(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  stats: CardStats,
  target: SpawnTarget,
): SpawnPlan {
  if (target.at !== undefined) return { kind: 'at', locationId: locationInPlay(state, target.at) };
  const detail = stats.keywords?.find((keyword) => keyword.name === 'spawn')?.detail;
  if (detail !== undefined) return instructedSpawn(ctx, state, detail);
  if (target.investigatorId === undefined)
    throw new CommandRejected({ code: 'noSpawnLocation', cardId: enemy.id });
  const drawer = activeInvestigator(state, target.investigatorId);
  if (drawer.locationId === undefined)
    throw new CommandRejected({
      code: 'investigatorHasNoLocation',
      investigatorId: drawer.id,
    });
  return { kind: 'at', locationId: drawer.locationId, drawerId: drawer.id };
}

/**
 * Reads a spawn instruction that names a location, e.g. "Spawn - Hallway".
 * Text that matches no location card at all (e.g. "the location with the most
 * clues") cannot be interpreted, so the players choose among all locations in
 * play instead of the engine guessing. A name that no location in play has
 * (the location is set aside or gone) discards the enemy.
 */
function instructedSpawn(ctx: EngineContext, state: GameState, detail: string): SpawnPlan {
  const wanted = detail.trim().replace(/\.$/, '').toLowerCase();
  const locations = Object.values(state.cards).filter(
    (card) => ctx.cards.get(card.code)?.typeCode === 'location',
  );
  const matches = locations.filter(
    (card) => card.zone.kind === 'location' && nameOf(ctx, card) === wanted,
  );
  const [only] = matches;
  if (only !== undefined && matches.length === 1) return { kind: 'at', locationId: only.id };
  if (matches.length > 1) return { kind: 'choose', candidates: matches.map((card) => card.id) };
  if (locations.some((card) => nameOf(ctx, card) === wanted)) return { kind: 'discard' };
  return {
    kind: 'choose',
    candidates: locations.filter((card) => card.zone.kind === 'location').map((card) => card.id),
  };
}

function nameOf(ctx: EngineContext, card: CardInstance): string | undefined {
  return ctx.cards.get(card.code)?.name.toLowerCase();
}

function locationInPlay(state: GameState, locationId: InstanceId): InstanceId {
  const card = state.cards[locationId];
  if (!card) throw new CommandRejected({ code: 'unknownCard', cardId: locationId });
  if (card.zone.kind !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId: locationId });
  return locationId;
}
