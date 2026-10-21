import { cardStats, resolveValue, type CardStats, type EngineContext } from './cards';
import type {
  DamageEnemy,
  DefeatEnemy,
  DisengageEnemy,
  EngageEnemy,
  ExhaustEnemy,
  MoveEnemy,
  ReadyEnemy,
} from './commands';
import { engageEvents } from './engagement';
import type { EnemyDefeated, EnemyEngaged, Event, ExhaustChanged } from './events';
import { activeInvestigator } from './handle_investigator';
import type { InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { requireCard } from './lookup';
import { moveCardEvent } from './placement';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { encounterDiscard, type Zone } from './zone';

const VICTORY_DISPLAY: Zone = { kind: 'victoryDisplay' };

/**
 * `EngageEnemy`: the enemy engages the investigator, who must be at its
 * location. A massive enemy is rejected rather than ignored, so the UI can
 * explain that it already counts as engaged with everyone at its location.
 */
export function handleEngageEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: EngageEnemy,
): EnemyEngaged[] {
  const { enemy, stats } = inPlayEnemyOf(ctx, state, cmd.enemyId);
  if (hasKeyword(stats, 'massive'))
    throw new CommandRejected({ code: 'massiveNotEngageable', cardId: enemy.id });
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

/**
 * `MoveEnemy`: places the enemy unengaged at `to`, then lets it engage there.
 * `to` must be a location; it need not be revealed or connected.
 */
export function handleMoveEnemy(ctx: EngineContext, state: GameState, cmd: MoveEnemy): Event[] {
  const { enemy } = inPlayEnemyOf(ctx, state, cmd.enemyId);
  if (requireCard(state.cards, cmd.to).zone.kind !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId: cmd.to });
  if (locationOf(state, enemy) === cmd.to)
    throw new CommandRejected({
      code: 'enemyAlreadyAtLocation',
      cardId: enemy.id,
      locationId: cmd.to,
    });
  const moved = moveCardEvent(enemy, { kind: 'atLocation', locationId: cmd.to });
  return [moved, ...engageEvents(ctx, replay([moved], state), enemy.id)];
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
  const enemy = requireCard(state.cards, enemyId);
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
export function locationOf(state: GameState, enemy: CardInstance): InstanceId {
  if (enemy.zone.kind === 'atLocation') return enemy.zone.locationId;
  if (enemy.zone.kind === 'engaged') {
    const { investigatorId } = enemy.zone;
    const location = state.investigators.find((inv) => inv.id === investigatorId)?.locationId;
    if (location !== undefined) return location;
    throw new CommandRejected({ code: 'investigatorHasNoLocation', investigatorId });
  }
  throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
}

/**
 * The enemies in play at `locationId`, unengaged there or engaged with an
 * investigator standing there, in card order. Used for "enemies at your
 * location" (e.g. The Gathering's skull token).
 */
export function enemiesAt(state: GameState, locationId: InstanceId): CardInstance[] {
  return Object.values(state.cards).filter((card) => {
    const zone = card.zone;
    if (zone.kind === 'atLocation') return zone.locationId === locationId;
    if (zone.kind !== 'engaged') return false;
    const engaged = state.investigators.find((inv) => inv.id === zone.investigatorId);
    return engaged?.locationId === locationId;
  });
}

function defeated(enemyId: InstanceId, stats: CardStats): EnemyDefeated {
  const hasVictory = (stats.victory ?? 0) > 0;
  return { type: 'EnemyDefeated', enemyId, to: hasVictory ? VICTORY_DISPLAY : encounterDiscard };
}

function exhaustChange(enemy: CardInstance, exhausted: boolean): ExhaustChanged {
  if (enemy.exhausted === exhausted)
    throw new CommandRejected({ code: 'exhaustUnchanged', cardId: enemy.id, exhausted });
  return { type: 'ExhaustChanged', cardId: enemy.id, exhausted };
}
