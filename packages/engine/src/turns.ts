import type {
  AdjustActions,
  Command,
  EndTurn,
  StartTurn,
  TableAction,
  TakeAction,
} from './commands';
import type {
  ActionTaken,
  ActionsAdjusted,
  InvestigatorChanged,
  TurnEnded,
  TurnStarted,
} from './events';
import { activeInvestigator } from './handle_investigator';
import type { InvestigatorId } from './ids';
import { playerOrder } from './investigators';
import { CommandRejected } from './rejection';
import type { GameState, Phase, Turn } from './state';

/** Actions every investigator may take in a turn (Rules Reference, "Investigation Phase"). */
export const BASE_ACTIONS_PER_TURN = 3;

/**
 * The actions an investigator can take in their turn: the ones the engine
 * resolves (`MoveInvestigator`, `Investigate`, `Fight`, `Evade`,
 * `EngageEnemy`) and the ones the players resolve at the table
 * (`TakeAction`, see `TableAction`).
 */
export type ActionKind = 'move' | 'investigate' | 'fight' | 'evade' | 'engage' | TableAction;

/** An action a command stands for, and the investigator who takes it. */
export interface CommandAction {
  kind: ActionKind;
  investigatorId: InvestigatorId;
}

/**
 * The action `command` stands for, or `undefined` if it is none. Everything
 * else is free: decision answers, phase steps, corrections, adjustments,
 * advancing the act, and the action commands marked `free` (card effects).
 */
export function actionOf(command: Command): CommandAction | undefined {
  switch (command.type) {
    case 'MoveInvestigator':
      return command.free ? undefined : { kind: 'move', investigatorId: command.investigatorId };
    case 'Investigate':
      return command.free
        ? undefined
        : { kind: 'investigate', investigatorId: command.investigatorId };
    case 'Fight':
      return command.free ? undefined : { kind: 'fight', investigatorId: command.investigatorId };
    case 'Evade':
      return command.free ? undefined : { kind: 'evade', investigatorId: command.investigatorId };
    case 'EngageEnemy':
      return command.free ? undefined : { kind: 'engage', investigatorId: command.investigatorId };
    case 'TakeAction':
      return { kind: command.action, investigatorId: command.investigatorId };
    default:
      return undefined;
  }
}

/**
 * The `ActionTaken` that a command issued by the players costs, checked
 * against the turn: in the investigation phase an action belongs to the
 * investigator whose turn is in progress and must fit their allowance.
 * Outside the investigation phase nothing is counted: an action command
 * there can only be a card effect or a correction the players enter.
 */
export function actionEvents(state: GameState, command: Command): ActionTaken[] {
  const action = actionOf(command);
  if (!action || state.meta.phase !== 'investigation') return [];
  const turn = turnOf(state, action.investigatorId);
  const allowance = actionAllowance(state, turn);
  if (turn.actionsTaken >= allowance)
    throw new CommandRejected({
      code: 'noActionsLeft',
      investigatorId: action.investigatorId,
      allowance,
    });
  return [{ type: 'ActionTaken', investigatorId: action.investigatorId, action: action.kind }];
}

/**
 * How many actions the turn allows: the base 3, the investigator's
 * persistent `extraActions` and the turn's own adjustment.
 */
export function actionAllowance(state: GameState, turn: Turn): number {
  const extra =
    state.investigators.find((inv) => inv.id === turn.investigatorId)?.extraActions ?? 0;
  return BASE_ACTIONS_PER_TURN + extra + turn.actionAdjustment;
}

/** `StartTurn`: the group picks the next investigator whose turn begins. */
export function handleStartTurn(state: GameState, cmd: StartTurn): TurnStarted[] {
  requirePhase(state, 'investigation');
  const { turn } = state.meta;
  if (turn)
    throw new CommandRejected({ code: 'turnInProgress', investigatorId: turn.investigatorId });
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (state.meta.turnsTaken.includes(investigator.id))
    throw new CommandRejected({ code: 'turnAlreadyTaken', investigatorId: investigator.id });
  return [{ type: 'TurnStarted', investigatorId: investigator.id }];
}

/** `EndTurn`: ends the turn in progress, which must be the investigator's. */
export function handleEndTurn(state: GameState, cmd: EndTurn): TurnEnded[] {
  requirePhase(state, 'investigation');
  turnOf(state, cmd.investigatorId);
  return [{ type: 'TurnEnded', investigatorId: cmd.investigatorId }];
}

/** `AdjustActions`: changes this turn's allowance. */
export function handleAdjustActions(state: GameState, cmd: AdjustActions): ActionsAdjusted[] {
  return [actionsAdjusted(state, cmd.investigatorId, cmd.delta)];
}

/**
 * The `ActionsAdjusted` of `AdjustActions` and of a `ManualAdjust` of the
 * allowance: `delta` must be a non-zero integer, the turn the investigator's,
 * and the allowance must not drop below zero.
 */
export function actionsAdjusted(
  state: GameState,
  investigatorId: InvestigatorId,
  delta: number,
): ActionsAdjusted {
  const turn = turnOf(state, investigatorId);
  const allowance = actionAllowance(state, turn);
  if (!Number.isInteger(delta) || delta === 0 || allowance + delta < 0)
    throw new CommandRejected({
      code: 'invalidActionAdjustment',
      investigatorId,
      delta,
      allowance,
    });
  return { type: 'ActionsAdjusted', investigatorId, delta };
}

/**
 * `TakeAction`, own part (the action itself is counted by `actionEvents`):
 * the resource action gives 1 resource; the others are resolved at the table.
 */
export function handleTakeAction(state: GameState, cmd: TakeAction): InvestigatorChanged[] {
  requirePhase(state, 'investigation');
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (cmd.action !== 'resource') return [];
  return [
    { type: 'InvestigatorChanged', investigatorId: investigator.id, stat: 'resources', delta: 1 },
  ];
}

/**
 * Rejects leaving the investigation phase (Rules Reference 2.2/2.3: turns
 * follow each other until each investigator has taken one, then the phase ends) while a turn is in progress
 * or an active investigator has not had theirs. Rejecting is simpler than a
 * confirmation and costs the group little: a turn without actions is just
 * `StartTurn` and `EndTurn`.
 */
export function assertTurnsTaken(state: GameState): void {
  const { turn, turnsTaken } = state.meta;
  if (turn)
    throw new CommandRejected({ code: 'turnInProgress', investigatorId: turn.investigatorId });
  const untaken = playerOrder(state)
    .map((inv) => inv.id)
    .filter((id) => !turnsTaken.includes(id));
  if (untaken.length > 0)
    throw new CommandRejected({ code: 'turnsNotTaken', investigatorIds: untaken });
}

/** The turn in progress, which must be `investigatorId`'s. */
function turnOf(state: GameState, investigatorId: InvestigatorId): Turn {
  const { turn } = state.meta;
  if (!turn || turn.investigatorId !== investigatorId)
    throw new CommandRejected({
      code: 'notTheirTurn',
      investigatorId,
      ...(turn ? { activeInvestigatorId: turn.investigatorId } : {}),
    });
  return turn;
}

function requirePhase(state: GameState, expected: Phase): void {
  if (state.meta.phase !== expected)
    throw new CommandRejected({ code: 'wrongPhase', expected, actual: state.meta.phase });
}
