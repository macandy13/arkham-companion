import { isClosedToEnemy, isEnemyRestricted } from './restrictions';
import { requireLocationInPlay } from './board';
import { resolveAmount, type EngineContext } from './cards';
import type {
  DamageEnemy,
  HealEnemy,
  DefeatEnemy,
  DisengageEnemy,
  EngageEnemy,
  EvadeEnemy,
  ExhaustEnemy,
  EnemyDestination,
  MoveEnemy,
  ReadyEnemy,
  RetreatEnemy,
} from './commands';
import { handleEnemyAttacks } from './attacks_of_opportunity';
import { chooseInvestigator, chooseLocation, engageEvents } from './engagement';
import { enemyWay } from './enemy_ways';
import { preyPrompt } from './prey';
import type { EnemyDefeated, EnemyDisengaged, EnemyEngaged, Event, ExhaustChanged } from './events';
import {
  defeatedByDamage,
  enemyDefeatedEvent,
  enemyOf,
  isEngagedWith,
  isEnemyOnTable,
  locationOf,
} from './enemies';
import { activeInvestigator, requireInvestigator } from './investigators';
import type { InstanceId } from './ids';
import { cardHasKeyword } from './card_keywords';
import { moveCardEvent } from './placement';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { AnswerableCommand, CardInstance, GameState } from './state';

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
  strict: boolean,
): EnemyEngaged[] {
  if (!strict) return cardEngagement(ctx, state, cmd);
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (cardHasKeyword(ctx, state, enemy, 'massive'))
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
  const { enemy } = enemyOf(ctx, state, cmd.enemyId);
  const investigator = requireInvestigator(state, cmd.investigatorId);
  if (
    !isEnemyOnTable(enemy) ||
    investigator.status !== 'active' ||
    cardHasKeyword(ctx, state, enemy, 'massive') ||
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
 * `MoveEnemy`: places the enemy unengaged at its destination, then lets it engage there. A direct
 * `to` must be a location; it need not be revealed or connected. An enemy already there stays as
 * it is, engaged or not: the effect has nothing to do, which is not a mistake worth refusing. Nor
 * is a location closed to it (`isClosedToEnemy`, Barricade): it stays where it is. With `toward`
 * it takes one step of its way there (`stepToward`).
 */
export function handleMoveEnemy(ctx: EngineContext, state: GameState, cmd: MoveEnemy): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (cmd.toward === undefined) {
    requireLocationInPlay(state, cmd.to);
    if (locationOf(state, enemy) === cmd.to) return [];
  }
  if (enemy.zone.kind === 'engaged' && cmd.forced !== true)
    throw new CommandRejected({
      code: 'enemyEngaged',
      cardId: enemy.id,
      investigatorId: enemy.zone.investigatorId,
    });
  if (cmd.toward === undefined) return arrive(ctx, state, enemy, cmd.to, cmd);
  return stepToward(ctx, state, enemy, { ...cmd, toward: cmd.toward });
}

/**
 * One step of the way `cmd.toward` leads (`enemyWay`): the only first step, the one the players
 * chose (`to`), or the lead investigator's choice (Rules Reference, "Choices"), first between
 * equally near investigators whose ways part, then between equally short steps.
 */
function stepToward(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  cmd: MoveEnemy & { toward: EnemyDestination },
): Event[] {
  const { steps, investigators } = enemyWay(ctx, state, enemy, cmd.toward);
  const step = (move: { toward: EnemyDestination; to?: InstanceId }): MoveEnemy => ({
    type: 'MoveEnemy',
    enemyId: enemy.id,
    ...move,
    ...(cmd.forced === true ? { forced: true } : {}),
    ...(cmd.attacksIfItEngages === true ? { attacksIfItEngages: true } : {}),
  });
  if (cmd.to !== undefined) {
    if (!steps.includes(cmd.to))
      throw new CommandRejected({ code: 'enemyCannotMove', cardId: enemy.id, to: cmd.to });
    return arrive(ctx, state, enemy, cmd.to, cmd);
  }
  if (investigators !== undefined)
    return chooseInvestigator(
      state,
      enemy.id,
      `move:${enemy.id}:investigator`,
      preyPrompt(ctx, state, enemy, 'decision.chooseHunterTarget'),
      investigators,
      (chosen) => step({ toward: chosen.locationId }),
    );
  const [only] = steps;
  if (only === undefined) return [];
  if (steps.length === 1) return arrive(ctx, state, enemy, only, cmd);
  return chooseLocation(
    ctx,
    state,
    enemy.id,
    `move:${enemy.id}`,
    'decision.chooseEnemyDestination',
    steps,
    (to) => step({ toward: cmd.toward, to }),
  );
}

function arrive(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  to: InstanceId,
  { attacksIfItEngages }: MoveEnemy,
): Event[] {
  // Like a hunter's blocked step (RR "Hunter"), it stays where a card closes the way (Barricade).
  if (isClosedToEnemy(ctx, state, enemy, requireLocationInPlay(state, to))) return [];
  const moved = moveCardEvent(enemy, { kind: 'atLocation', locationId: to });
  const arrived = replay([moved], state);
  const engaging = engageEvents(ctx, arrived, enemy.id);
  return [moved, ...(attacksIfItEngages ? withAttackOnEngaging(ctx, arrived, engaging) : engaging)];
}

/**
 * `engaging` (from `engageEvents`) with the enemy's immediate attack on the investigator it
 * engages: the attack decision after an `EnemyEngaged`, and an `EnemyAttacks` after the
 * `EngageEnemy` of each option when the players choose whom it engages.
 */
function withAttackOnEngaging(ctx: EngineContext, state: GameState, engaging: Event[]): Event[] {
  return engaging.flatMap((event): Event[] => {
    if (event.type === 'EnemyEngaged') {
      const { enemyId, investigatorId } = event;
      return [
        event,
        ...handleEnemyAttacks(ctx, replay([event], state), {
          type: 'EnemyAttacks',
          enemyId,
          investigatorId,
        }),
      ];
    }
    if (event.type !== 'DecisionRequested') return [event];
    const options = event.decision.options.map((option) => ({
      ...option,
      commands: option.commands.flatMap((command): AnswerableCommand[] =>
        command.type === 'EngageEnemy'
          ? [
              command,
              {
                type: 'EnemyAttacks',
                enemyId: command.enemyId,
                investigatorId: command.investigatorId,
              },
            ]
          : [command],
      ),
    }));
    return [{ ...event, decision: { ...event.decision, options } }];
  });
}

/** `DamageEnemy`: adds damage and defeats the enemy in the same step once it has as much as its health. */
export function handleDamageEnemy(ctx: EngineContext, state: GameState, cmd: DamageEnemy): Event[] {
  const { enemy, stats } = onTableEnemyOf(ctx, state, cmd.enemyId);
  const amount = resolveAmount(cmd.amount, state.meta.playerCount);
  if (!Number.isInteger(amount) || amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: amount });
  // A fight that hits it or an effect that damages each enemy still resolves; it just deals none.
  if (isEnemyRestricted(ctx, state, enemy, 'damaged')) return [];
  const damaged: Event = {
    type: 'TokensChanged',
    cardId: enemy.id,
    token: 'damage',
    delta: amount,
  };
  return [damaged, ...defeatedByDamage(state, enemy, stats, amount)];
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
  return [enemyDefeatedEvent(state, enemy, stats)];
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
    {
      type: 'EnemyEvaded',
      enemyId: enemy.id,
      investigatorId: investigator.id,
      ...(cmd.successful && { successful: true }),
    },
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
 * stays as it is, and so does one a card keeps from readying (`isEnemyRestricted`, Handcuffs).
 */
export function handleReadyEnemy(ctx: EngineContext, state: GameState, cmd: ReadyEnemy): Event[] {
  const { enemy } = onTableEnemyOf(ctx, state, cmd.enemyId);
  if (!enemy.exhausted || isEnemyRestricted(ctx, state, enemy, 'ready')) return [];
  const change = exhaustChange(enemy.id, false);
  return [change, ...engageEvents(ctx, replay([change], state), cmd.enemyId)];
}

function onTableEnemyOf(ctx: EngineContext, state: GameState, enemyId: InstanceId) {
  const found = enemyOf(ctx, state, enemyId);
  if (!isEnemyOnTable(found.enemy))
    throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemyId });
  return found;
}

/**
 * `RetreatEnemy`: the elusive retreat. It disengages and exhausts, then steps away from the
 * investigators (`MoveEnemy`), so it engages nobody where it arrives; with no connecting location
 * open to it (`isClosedToEnemy`: Barricade, or an enemy that cannot move) it stays.
 */
export function handleRetreatEnemy(
  ctx: EngineContext,
  state: GameState,
  cmd: RetreatEnemy,
): Event[] {
  const enemy = state.cards[cmd.enemyId];
  if (enemy === undefined || !isEnemyOnTable(enemy) || enemy.exhausted) return [];
  const settled: Event[] = [
    ...(enemy.zone.kind === 'engaged' ? [disengaged(state, enemy)] : []),
    exhaustChange(enemy.id, true),
  ];
  const away: MoveEnemy = {
    type: 'MoveEnemy',
    enemyId: enemy.id,
    toward: 'awayFromInvestigators',
  };
  return [...settled, ...handleMoveEnemy(ctx, replay(settled, state), away)];
}

function disengaged(state: GameState, enemy: CardInstance): EnemyDisengaged {
  return { type: 'EnemyDisengaged', enemyId: enemy.id, locationId: locationOf(state, enemy) };
}

function exhaustChange(cardId: InstanceId, exhausted: boolean): ExhaustChanged {
  return { type: 'ExhaustChanged', cardId, exhausted };
}
