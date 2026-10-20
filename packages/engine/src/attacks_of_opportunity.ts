import type { EngineContext } from './cards';
import type { DealEnemyAttack } from './commands';
import { requestDecision } from './decisions';
import { enemyAttackEvents, readyEngagedEnemies } from './enemies';
import type { DecisionRequested, Event } from './events';
import { forcedAttackDecision } from './forced_attacks';
import { enemyOf, isInPlay } from './handle_enemy';
import { CommandRejected } from './rejection';
import type { GameState, HeldAction } from './state';

/**
 * Rules Reference, "Attack of Opportunity": an investigator engaged with
 * ready enemies who takes an action other than fight, evade, parley or
 * resign is attacked by each of them "after all costs of initiating the
 * action have been paid, but before the application of that action's
 * effect". For every such enemy (a ready massive enemy at the location
 * included) this raises a `forcedAttackDecision` (`attackOfOpportunity:<enemy>`)
 * for that investigator; its `skip` is the way out for a card that "does not
 * provoke attacks of opportunity", which the engine cannot read. Nothing for
 * any other command.
 *
 * `handle` calls this for player commands only: follow-ups of hooks and of
 * decision answers are rule consequences, not actions, so they never
 * provoke (`CommandSpec.provokes` tells which commands do). When it raises any decision, `handle` holds the action
 * (`StepsQueued`) and resolves it only after the last answer
 * (`resumeQueue`). The decisions may be answered in any order, because
 * the attacking enemies' controller (the players) picks it.
 */
export function attackOfOpportunityDecisions(
  ctx: EngineContext,
  state: GameState,
  action: HeldAction,
): DecisionRequested[] {
  const investigator = state.investigators.find((inv) => inv.id === action.investigatorId);
  if (investigator?.status !== 'active') return [];
  return readyEngagedEnemies(ctx, state, investigator).flatMap((enemyId) =>
    requestDecision(
      state,
      forcedAttackDecision(ctx, state, 'attackOfOpportunity', enemyId, investigator.id),
    ),
  );
}

/**
 * Whether `action` is taken by the investigator whose turn is in progress.
 * Actions are taken in one's own turn, so an `asAction` command at another
 * time does not provoke. Which commands are actions at all is up to
 * `CommandSpec.provokes`.
 */
export function isOwnTurnAction(state: GameState, action: HeldAction): boolean {
  return state.meta.turn?.investigatorId === action.investigatorId;
}

/**
 * `DealEnemyAttack`: the attack's damage and horror with one defeat check;
 * the enemy stays ready. Nothing when the investigator is no longer active
 * or the enemy has left play meanwhile (see the command).
 */
export function handleDealEnemyAttack(
  ctx: EngineContext,
  state: GameState,
  cmd: DealEnemyAttack,
): Event[] {
  const { enemy } = enemyOf(ctx, state, cmd.enemyId);
  const investigator = state.investigators.find((inv) => inv.id === cmd.investigatorId);
  if (!investigator)
    throw new CommandRejected({ code: 'unknownInvestigator', investigatorId: cmd.investigatorId });
  const dealt = enemyAttackEvents(ctx, state, investigator, cmd.damage, cmd.horror);
  return investigator.status === 'active' && isInPlay(enemy) ? dealt : [];
}
