import {
  firstSteps,
  isLocationInPlay,
  neighbours,
  requireLocationInPlay,
  shortestPaths,
} from './board';
import type { CardStats, EngineContext } from './cards';
import type {
  DamageEnemy,
  HealEnemy,
  DefeatEnemy,
  DisengageEnemy,
  EngageEnemy,
  EvadeEnemy,
  ExhaustEnemy,
  MoveEnemy,
  MoveEnemyTowards,
  ReadyEnemy,
  RetreatEnemy,
} from './commands';
import { chooseLocation, engageEvents, investigatorsAt } from './engagement';
import type { EnemyDefeated, EnemyDisengaged, EnemyEngaged, Event, ExhaustChanged } from './events';
import { enemyHealth, enemyOf, isEngagedWith, isEnemyOnTable, locationOf } from './enemies';
import { activeInvestigator, requireInvestigator } from './investigators';
import type { InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { moveCardEvent } from './placement';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { encounterDiscard, victoryDisplay } from './zone';

/**
 * `EngageEnemy`: the enemy engages the investigator, who must be at its
 * location. A massive enemy is rejected rather than ignored, so the UI can
 * explain that it already counts as engaged with everyone at its location.
 * A card's "engages you" does what it can instead (`cardEngagement`).
 */
export function handleEngageEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: EngageEnemy,
): EnemyEngaged[] {
  if (cmd.source !== undefined) return cardEngagement(ctx, state, cmd);
  const { enemy, stats } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (hasKeyword(stats, 'massive'))
    throw new CommandRejected({ code: 'massiveNotEngageable', cardId: enemy.id });
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (isEngagedWith(enemy, investigator))
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

/**
 * "[It] engages you" from a card (`EngageEnemy` with a `source`): the enemy goes to the
 * investigator's threat area from wherever it is, so it ends up at their location without moving
 * (our reading of Rules Reference, "Enemy Engagement"; a card that means a move says "moves to …
 * and engages you"). A massive enemy never enters a threat area, and an enemy engaged with the
 * investigator already, one that has left play or an investigator no longer active leave
 * nothing to do, so all of them change nothing.
 */
function cardEngagement(ctx: EngineContext, state: GameState, cmd: EngageEnemy): EnemyEngaged[] {
  const { enemy, stats } = enemyOf(ctx, state, cmd.enemyId);
  const investigator = requireInvestigator(state, cmd.investigatorId);
  if (
    !isEnemyOnTable(enemy) ||
    investigator.status !== 'active' ||
    hasKeyword(stats, 'massive') ||
    isEngagedWith(enemy, investigator)
  )
    return [];
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
  return [disengaged(state, enemy)];
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

/**
 * `MoveEnemyTowards`: one connection along the shortest paths to `towards`.
 * Ties between first steps go to the lead investigator (Rules Reference,
 * "Choices"), whose answer is a plain `MoveEnemy` to a neighbour.
 */
export function handleMoveEnemyTowards(
  ctx: EngineContext,
  state: GameState,
  cmd: MoveEnemyTowards,
): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (enemy.zone.kind === 'engaged' && cmd.forced !== true)
    throw new CommandRejected({
      code: 'enemyEngaged',
      cardId: enemy.id,
      investigatorId: enemy.zone.investigatorId,
    });
  // A target not in play yet (the Parlor while act 1 holds it set aside) has no path to it.
  if (!isLocationInPlay(state, cmd.towards)) return [];
  const steps = firstSteps(shortestPaths(ctx, state, locationOf(state, enemy), cmd.towards));
  const [only] = steps;
  if (only === undefined) return [];
  const moveTo = (to: InstanceId): MoveEnemy => ({
    type: 'MoveEnemy',
    enemyId: enemy.id,
    to,
    ...(cmd.forced === true ? { forced: true } : {}),
  });
  if (steps.length === 1) return handleMoveEnemy(ctx, state, moveTo(only));
  return chooseLocation(
    ctx,
    state,
    enemy.id,
    `towards:${enemy.id}`,
    'decision.chooseEnemyDestination',
    steps,
    moveTo,
  );
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

/**
 * `EvadeEnemy`: an exhausted enemy stays exhausted and one engaged with
 * someone else stays engaged, but either is still evaded, so the window opens.
 */
export function handleEvadeEnemy(ctx: EngineContext, state: GameState, cmd: EvadeEnemy): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  const investigator = activeInvestigator(state, cmd.investigatorId);
  return [
    ...(enemy.exhausted ? [] : [exhaustChange(enemy.id, true)]),
    ...(isEngagedWith(enemy, investigator) ? [disengaged(state, enemy)] : []),
    { type: 'EnemyEvaded', enemyId: enemy.id, investigatorId: investigator.id },
  ];
}

/**
 * `ExhaustEnemy`: an exhausted enemy stays as it is, so "exhaust each enemy at
 * your location" resolves whether or not some of them are exhausted.
 */
export function handleExhaustEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: ExhaustEnemy,
): ExhaustChanged[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  return enemy.exhausted ? [] : [exhaustChange(enemy.id, true)];
}

/**
 * `ReadyEnemy`: readies the enemy; one that is unengaged then engages an
 * investigator at its location (Rules Reference, "Engaged"). A ready enemy
 * stays as it is.
 */
export function handleReadyEnemy(ctx: EngineContext, state: GameState, cmd: ReadyEnemy): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (!enemy.exhausted) return [];
  const change = exhaustChange(enemy.id, false);
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
    to: hasVictory ? victoryDisplay : encounterDiscard,
    locationId: locationOf(state, enemy),
  };
}

/**
 * `RetreatEnemy`: the elusive retreat. The destination is a connecting location without
 * investigators if there is one, else any connecting location; with none the enemy only
 * disengages and exhausts. It exhausts on arrival, so it engages nobody there.
 */
export function handleRetreatEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: RetreatEnemy,
): Event[] {
  const enemy = state.cards[cmd.enemyId];
  if (enemy === undefined || !isEnemyOnTable(enemy) || enemy.exhausted) return [];
  const connecting = neighbours(ctx, state, locationOf(state, enemy));
  if (cmd.to !== undefined && !connecting.includes(cmd.to))
    throw new CommandRejected({ code: 'notConnected', from: locationOf(state, enemy), to: cmd.to });
  const empty = connecting.filter((id) => investigatorsAt(state, id).length === 0);
  const pool = empty.length > 0 ? empty : connecting;
  if (cmd.to === undefined && pool.length > 1)
    return chooseLocation(
      ctx,
      state,
      enemy.id,
      `retreat:${enemy.id}`,
      'decision.chooseEnemyDestination',
      pool,
      (to) => ({ type: 'RetreatEnemy', enemyId: enemy.id, to }),
    );
  const to = cmd.to ?? pool[0];
  const events: Event[] = enemy.zone.kind === 'engaged' ? [disengaged(state, enemy)] : [];
  const unengaged = replay(events, state).cards[enemy.id] ?? enemy;
  if (to !== undefined)
    events.push(moveCardEvent(unengaged, { kind: 'atLocation', locationId: to }));
  return [...events, exhaustChange(enemy.id, true)];
}

function disengaged(state: GameState, enemy: CardInstance): EnemyDisengaged {
  return { type: 'EnemyDisengaged', enemyId: enemy.id, locationId: locationOf(state, enemy) };
}

function exhaustChange(cardId: InstanceId, exhausted: boolean): ExhaustChanged {
  return { type: 'ExhaustChanged', cardId, exhausted };
}
