import { requireLocationInPlay } from './board';
import type { CardStats, EngineContext } from './cards';
import type {
  DamageEnemy,
  HealEnemy,
  DefeatEnemy,
  DisengageEnemy,
  EngageEnemy,
  ExhaustEnemy,
  MoveEnemy,
  ReadyEnemy,
} from './commands';
import { engageEvents } from './engagement';
import type { EnemyDefeated, EnemyEngaged, Event, ExhaustChanged } from './events';
import { enemyHealth, enemyOf, isEnemyOnTable, locationOf } from './enemies';
import { activeInvestigator } from './investigators';
import type { InstanceId } from './ids';
import { hasKeyword } from './keywords';
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
  const { enemy, stats } = onTableEnemyOf(ctx, state, cmd.enemyId);
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
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
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
 * `to` must be a location; it need not be revealed or connected. An enemy
 * already there stays as it is, engaged or not: the effect has nothing to do,
 * which is not a mistake worth refusing.
 */
export function handleMoveEnemy(ctx: EngineContext, state: GameState, cmd: MoveEnemy): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  requireLocationInPlay(state, cmd.to);
  if (locationOf(state, enemy) === cmd.to) return [];
  if (enemy.zone.kind === 'engaged' && !cmd.forced)
    throw new CommandRejected({
      code: 'enemyEngaged',
      cardId: enemy.id,
      investigatorId: enemy.zone.investigatorId,
    });
  const moved = moveCardEvent(enemy, { kind: 'atLocation', locationId: cmd.to });
  return [moved, ...engageEvents(ctx, replay([moved], state), enemy.id)];
}

/** `DamageEnemy`: adds damage and defeats the enemy in the same step once it has as much as its health. */
export function handleDamageEnemy(ctx: EngineContext, state: GameState, cmd: DamageEnemy): Event[] {
  const { enemy, stats } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  const damaged: Event = {
    type: 'TokensChanged',
    cardId: enemy.id,
    token: 'damage',
    delta: cmd.amount,
  };
  const total = (enemy.tokens.damage ?? 0) + cmd.amount;
  const health = enemyHealth(stats, state);
  if (health === undefined || total < health) return [damaged];
  return [damaged, defeated(state, enemy, stats)];
}

/** `HealEnemy`: removes as much of the damage as the enemy has, up to the amount. */
export function handleHealEnemy(ctx: EngineContext, state: GameState, cmd: HealEnemy): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  const healed = Math.min(cmd.amount, enemy.tokens.damage ?? 0);
  if (healed === 0) return [];
  return [{ type: 'TokensChanged', cardId: enemy.id, token: 'damage', delta: -healed }];
}

/** `DefeatEnemy`: to the victory display if the card has victory, else to the encounter discard. */
export function handleDefeatEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: DefeatEnemy,
): EnemyDefeated[] {
  const { enemy, stats } = onTableEnemyOf(ctx, state, cmd.enemyId);
  return [defeated(state, enemy, stats)];
}

/** `ExhaustEnemy`. */
export function handleExhaustEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: ExhaustEnemy,
): ExhaustChanged[] {
  return [exhaustChange(onTableEnemyOf(ctx, state, cmd.enemyId).enemy, true)];
}

/**
 * `ReadyEnemy`: readies the enemy; one that is unengaged then engages an
 * investigator at its location (Rules Reference, "Engaged").
 */
export function handleReadyEnemy(ctx: EngineContext, state: GameState, cmd: ReadyEnemy): Event[] {
  const change = exhaustChange(onTableEnemyOf(ctx, state, cmd.enemyId).enemy, false);
  return [change, ...engageEvents(ctx, replay([change], state), cmd.enemyId)];
}

function onTableEnemyOf(ctx: EngineContext, state: GameState, enemyId: InstanceId) {
  const found = enemyOf(ctx, state, enemyId);
  if (!isEnemyOnTable(found.enemy))
    throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemyId });
  return found;
}

function defeated(state: GameState, enemy: CardInstance, stats: CardStats): EnemyDefeated {
  const hasVictory = (stats.victory ?? 0) > 0;
  return {
    type: 'EnemyDefeated',
    enemyId: enemy.id,
    to: hasVictory ? VICTORY_DISPLAY : encounterDiscard,
    locationId: locationOf(state, enemy),
  };
}

function exhaustChange(enemy: CardInstance, exhausted: boolean): ExhaustChanged {
  if (enemy.exhausted === exhausted)
    throw new CommandRejected({ code: 'exhaustUnchanged', cardId: enemy.id, exhausted });
  return { type: 'ExhaustChanged', cardId: enemy.id, exhausted };
}
