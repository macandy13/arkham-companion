import type { EngineContext } from './cards';
import type { AdjustActions, EndTurn, Resign, StartTurn } from './commands';
import { investigatorLeavesEvents } from './elimination';
import type { ActionsAdjusted, ActionsReset, Event, TurnEnded, TurnStarted } from './events';
import type { InvestigatorId } from './ids';
import { activeInvestigator, playerOrder } from './investigators';
import { CommandRejected } from './rejection';
import type { GameState, Phase } from './state';

/**
 * Actions every investigator may take in a turn (Rules Reference,
 * "Investigation Phase"); what the scenario start and upkeep step 4.2 set
 * `Investigator.actionsRemaining` to.
 */
export const BASE_ACTIONS_PER_TURN = 3;

/**
 * Upkeep step 4.2 ("reset actions"): one `ActionsReset` per active
 * investigator, back to `BASE_ACTIONS_PER_TURN`.
 */
export function actionsResetEvents(state: GameState): ActionsReset[] {
  return playerOrder(state).map((inv) => ({
    type: 'ActionsReset',
    investigatorId: inv.id,
    actions: BASE_ACTIONS_PER_TURN,
  }));
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

/**
 * `EndTurn`: ends the turn in progress, which must be the investigator's.
 * `TurnEnded` opens the `turnEnds` window for the cards in their threat
 * area (Frozen in Fear's test).
 */
export function handleEndTurn(state: GameState, cmd: EndTurn): TurnEnded[] {
  requirePhase(state, 'investigation');
  requireTurnOf(state, cmd.investigatorId);
  return [{ type: 'TurnEnded', investigatorId: cmd.investigatorId }];
}

/**
 * `Resign`: an action of the investigator's own turn, so the same phase and
 * turn rules as `EndTurn` apply; the investigator leaves the scenario and the
 * turn ends with them (see `investigatorLeavesEvents`).
 */
export function handleResign(ctx: EngineContext, state: GameState, cmd: Resign): Event[] {
  requirePhase(state, 'investigation');
  const investigator = activeInvestigator(state, cmd.investigatorId);
  requireTurnOf(state, investigator.id);
  return investigatorLeavesEvents(ctx, state, investigator, {
    type: 'InvestigatorResigned',
    investigatorId: investigator.id,
  });
}

/** Rejects (`turnNotInProgress`) unless it is `investigatorId`'s turn. */
export function requireTurnOf(state: GameState, investigatorId: InvestigatorId): void {
  const { turn } = state.meta;
  if (turn?.investigatorId !== investigatorId)
    throw new CommandRejected({
      code: 'turnNotInProgress',
      investigatorId,
      ...(turn ? { activeInvestigatorId: turn.investigatorId } : {}),
    });
}

/** `AdjustActions`: changes the investigator's remaining actions. */
export function handleAdjustActions(state: GameState, cmd: AdjustActions): ActionsAdjusted[] {
  const adjusted = actionsAdjusted(state, cmd.investigatorId, cmd.delta);
  return [cmd.for === undefined ? adjusted : { ...adjusted, for: cmd.for }];
}

/**
 * The `ActionsAdjusted` of `AdjustActions` and of a `ManualAdjust` of kind
 * `actions`: `delta` must be a non-zero integer and the active investigator's
 * remaining actions must not drop below zero. Allowed in any phase and turn:
 * encounter cards take actions away in the mythos phase, and the players
 * count down during the turn, which the engine does not police.
 */
export function actionsAdjusted(
  state: GameState,
  investigatorId: InvestigatorId,
  delta: number,
): ActionsAdjusted {
  const { actionsRemaining } = activeInvestigator(state, investigatorId);
  if (!Number.isInteger(delta) || delta === 0 || actionsRemaining + delta < 0)
    throw new CommandRejected({
      code: 'invalidActionAdjustment',
      investigatorId,
      delta,
      actionsRemaining,
    });
  return { type: 'ActionsAdjusted', investigatorId, delta };
}

/**
 * Rejects leaving the investigation phase (Rules Reference 2.2/2.3: turns
 * follow each other until each investigator has taken one, then the phase
 * ends) while a turn is in progress or an active investigator has not had
 * theirs. Rejecting is simpler than a confirmation and costs the group
 * little: a turn without actions is just `StartTurn` and `EndTurn`.
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

function requirePhase(state: GameState, expected: Phase): void {
  if (state.meta.phase !== expected)
    throw new CommandRejected({ code: 'wrongPhase', expected, actual: state.meta.phase });
}
