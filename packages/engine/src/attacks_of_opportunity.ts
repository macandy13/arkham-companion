import { cardStats, type EngineContext } from './cards';
import type { Command, DealEnemyAttack } from './commands';
import { requestDecision } from './decisions';
import { enemyAttackEvents, readyEngagedEnemies } from './enemies';
import type { DecisionRequested, Event } from './events';
import { enemyOf, isInPlay } from './handle_enemy';
import { decisionId, type InstanceId, type InvestigatorId } from './ids';
import { CommandRejected } from './rejection';
import type { Decision, GameState, HeldAction } from './state';

/**
 * Rules Reference, "Attack of Opportunity": an investigator engaged with
 * ready enemies who takes an action other than fight, evade, parley or
 * resign is attacked by each of them "after all costs of initiating the
 * action have been paid, but before the application of that action's
 * effect". For every such enemy (a ready massive enemy at the location
 * included) this raises a `confirm` decision (`attackOfOpportunity:<enemy>`)
 * for that investigator: `attack` deals the enemy's printed damage and
 * horror, which the players may lower (assets soak part of it) through
 * `ResolveDecision.amounts`; `skip` is the way out for a card that "does not
 * provoke attacks of opportunity", which the engine cannot read. Nothing for
 * any other command.
 *
 * `handle` calls this for player commands only: follow-ups of hooks and of
 * decision answers are rule consequences, not actions, so they never
 * provoke (`provokingAction` tells which commands do). When it raises any decision, `handle` holds the action
 * (`ActionHeld`) and resolves it only after the last answer
 * (`resumeHeldAction`). The decisions may be answered in any order, because
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
    requestDecision(state, attackDecision(ctx, state, enemyId, investigator.id)),
  );
}

/**
 * `command` as an action that provokes, if it is one. The engine does not
 * count actions (the players do, see `Investigator.actionsRemaining`), so it
 * recognises only the action-like commands it sees, and only for the
 * investigator whose turn is in progress, because actions are taken in one's
 * own turn: the same command at another time (a treachery moving someone,
 * setup) is a card effect.
 * - `MoveInvestigator` is the move action, unless it ignores connections,
 *   which only card effects do.
 * - `Investigate` is the investigate action.
 * - `EngageEnemy` is the engage action; the other engaged enemies attack (the
 *   enemy being engaged is not engaged yet, and a massive one cannot be
 *   engaged, `massiveNotEngageable`). An engagement by rule (entering a
 *   location with a ready enemy) is part of the move, not an `EngageEnemy`.
 * - `AdjustActions` does not provoke, even with a negative delta. The
 *   players count off the actions the engine saw as well (move, investigate),
 *   so treating every -1 as an action would ask twice for the same action.
 *   Actions the engine cannot see (resource, draw, play, activate) are
 *   therefore left to the players (M1.12 follow-up).
 * - `Fight` and `Evade` never provoke; the rules exempt them.
 */
export function provokingAction(state: GameState, command: Command): HeldAction | undefined {
  const action = actionOf(command);
  if (action === undefined || state.meta.turn?.investigatorId !== action.investigatorId)
    return undefined;
  return action;
}

function actionOf(command: Command): HeldAction | undefined {
  switch (command.type) {
    case 'MoveInvestigator':
      return command.ignoreConnections ? undefined : command;
    case 'Investigate':
    case 'EngageEnemy':
      return command;
    default:
      return undefined;
  }
}

/** The decision for one attack of opportunity, with the enemy's printed damage and horror as defaults. */
function attackDecision(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
  investigatorId: InvestigatorId,
): Decision {
  const { damage = 0, horror = 0 } = cardStats(ctx.cards, state.cards[enemyId]?.code ?? '');
  const attack: DealEnemyAttack = {
    type: 'DealEnemyAttack',
    enemyId,
    investigatorId,
    damage,
    horror,
  };
  return {
    id: decisionId(`attackOfOpportunity:${enemyId}`),
    kind: 'confirm',
    subject: enemyId,
    prompt: 'decision.attackOfOpportunity',
    decider: { kind: 'investigator', investigatorId },
    options: [
      {
        id: 'attack',
        label: 'decision.attack',
        commands: [attack],
        amounts: { damage: { default: damage, min: 0 }, horror: { default: horror, min: 0 } },
      },
      { id: 'skip', label: 'decision.doesNotProvoke', commands: [] },
    ],
  };
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
  const dealt = enemyAttackEvents(state, investigator, cmd.damage, cmd.horror);
  return investigator.status === 'active' && isInPlay(enemy) ? dealt : [];
}
