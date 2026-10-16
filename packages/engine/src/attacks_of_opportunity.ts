import { cardStats, type EngineContext } from './cards';
import type { Command, DealEnemyAttack } from './commands';
import { requestDecision } from './decisions';
import { enemyAttackEvents, readyEngagedEnemies } from './enemies';
import type { DecisionRequested, Event } from './events';
import { enemyOf, isInPlay } from './handle_enemy';
import { decisionId, type InstanceId, type InvestigatorId } from './ids';
import { CommandRejected } from './rejection';
import type { Decision, GameState } from './state';

/** An action the engine sees, by the investigator taking it, and the enemy it targets if any. */
interface ProvokingAction {
  investigatorId: InvestigatorId;
  /** The enemy an engage action is about; it does not attack the action that engages it. */
  target?: InstanceId;
}

/**
 * Rules Reference, "Attack of Opportunity": an investigator engaged with
 * ready enemies who takes an action other than fight, evade, parley or
 * resign is attacked by each of them before the action resolves. For every
 * such enemy (a ready massive enemy at the location included) this raises a
 * `confirm` decision (`attackOfOpportunity:<enemy>`) for that investigator:
 * `attack` deals the enemy's printed damage and horror, which the players
 * may lower (assets soak part of it) through `ResolveDecision.amounts`;
 * `skip` is the way out for a card that "does not provoke attacks of
 * opportunity", which the engine cannot read. Nothing for any other command.
 *
 * `handle` calls this for player commands only: follow-ups of hooks and of
 * decision answers are rule consequences, not actions, so they never
 * provoke. The decisions come before the action's own events, so they head
 * `GameState.pending`, ahead of e.g. the investigate test, matching the rule
 * that the attacks come first.
 */
export function attackOfOpportunityDecisions(
  ctx: EngineContext,
  state: GameState,
  command: Command,
): DecisionRequested[] {
  const action = provokingAction(state, command);
  const investigator = state.investigators.find((inv) => inv.id === action?.investigatorId);
  if (!action || investigator?.status !== 'active') return [];
  return readyEngagedEnemies(ctx, state, investigator)
    .filter((enemyId) => enemyId !== action.target)
    .flatMap((enemyId) =>
      requestDecision(state, attackDecision(ctx, state, enemyId, investigator.id)),
    );
}

/**
 * The action `command` stands for, if it is one that provokes. The engine
 * does not count actions (the players do, see `Investigator.actionsRemaining`),
 * so it recognises only the action-like commands it sees, and only for the
 * investigator whose turn is in progress, because actions are taken in one's
 * own turn: the same command at another time (a treachery moving someone,
 * setup) is a card effect.
 * - `MoveInvestigator` is the move action, unless it ignores connections,
 *   which only card effects do.
 * - `Investigate` is the investigate action.
 * - `EngageEnemy` is the engage action; the other engaged enemies attack. An
 *   engagement by rule (entering a location with a ready enemy, which the
 *   script still issues by hand) is no action: the players `skip` it.
 * - `AdjustActions` does not provoke, even with a negative delta. The
 *   players count off the actions the engine saw as well (move, investigate),
 *   so treating every -1 as an action would ask twice for the same action.
 *   Actions the engine cannot see (resource, draw, play, activate) are
 *   therefore left to the players (M1.12 follow-up).
 * - `Fight` and `Evade` never provoke; the rules exempt them.
 */
function provokingAction(state: GameState, command: Command): ProvokingAction | undefined {
  const action = actionOf(command);
  if (action === undefined || state.meta.turn?.investigatorId !== action.investigatorId)
    return undefined;
  return action;
}

function actionOf(command: Command): ProvokingAction | undefined {
  switch (command.type) {
    case 'MoveInvestigator':
      return command.ignoreConnections ? undefined : { investigatorId: command.investigatorId };
    case 'Investigate':
      return { investigatorId: command.investigatorId };
    case 'EngageEnemy':
      return { investigatorId: command.investigatorId, target: command.enemyId };
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
  const dealt = enemyAttackEvents(investigator, cmd.damage, cmd.horror);
  return investigator.status === 'active' && isInPlay(enemy) ? dealt : [];
}
