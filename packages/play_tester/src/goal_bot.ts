import {
  byId,
  isRevelationDecision,
  optionName,
  type BoardView,
  type CardName,
  type InstanceId,
  type PlayTable,
} from '@arkham/engine';
import { isRare } from './random_bot';
import type { Step } from './steps';

/**
 * How many times the goal bot rather takes a step that moves the game on than any other step;
 * the others stay possible, so its games still wander now and then.
 */
const GOAL_WEIGHT = 50;

/**
 * The _goal_ bot's weights (product.md "Continuous play tester") for the `offered` steps: it goes
 * for clues (investigates where there are some, else moves towards the nearest location with
 * clues or still unrevealed), advances the act, fights what is engaged with it, resolves the
 * attacks due and moves the round on once there is nothing left to do. It never corrects the
 * board or undoes, and never cancels a revelation, which takes a card it doesn't hold.
 */
export function goalWeights(table: PlayTable, offered: readonly Step[]): number[] {
  const { board } = table;
  const turn = board.turn;
  const engaged = turn === undefined ? [] : board.enemiesEngagedWith(turn).map(({ id }) => id);
  const at = turn === undefined ? undefined : board.locationOf(turn);
  const cluesHere = at !== undefined && board.location(byId(at)).clues > 0;
  const towardClues = at === undefined || cluesHere ? [] : firstStepsToClues(board, at);
  const actionsLeft = turn === undefined ? 0 : board.investigator(turn).actions;
  const turnsToStart = offered.some(({ verb }) => verb === 'startTurn');
  const movesOn = (step: Step): boolean => {
    switch (step.verb) {
      case 'spendCluesToAdvanceAct':
      case 'resolveEnemyAttacks':
      case 'startTurn':
        return true;
      case 'fight':
        return engaged.includes(step.enemy);
      case 'investigate':
        return cluesHere;
      case 'moveTo':
        return towardClues.includes(step.location);
      case 'endTurn':
        return actionsLeft === 0;
      case 'nextPhase':
        return turn === undefined && !turnsToStart;
      default:
        return false;
    }
  };
  return offered.map((step) =>
    isRare(step) || cancelsRevelation(table, step) ? 0 : movesOn(step) ? GOAL_WEIGHT : 1,
  );
}

/** Whether `step` answers a drawn treachery's question by cancelling its revelation. */
function cancelsRevelation(table: PlayTable, step: Step): boolean {
  if (step.verb !== 'answer') return false;
  const asked = table.state.pending.find(
    (decision) => isRevelationDecision(decision) && decision.subject === step.about,
  );
  const cancel = asked?.options.find(({ id }) => id === 'cancel');
  return cancel !== undefined && optionName(cancel) === step.option;
}

/**
 * The names of the locations next to `from` that start a shortest way to the nearest location
 * with clues on it or still unrevealed (revealing puts its clues there); none when there is no
 * such location left.
 */
function firstStepsToClues(board: BoardView, from: InstanceId): CardName[] {
  const wanted = (id: InstanceId) => {
    const location = board.location(byId(id));
    return !location.revealed || location.clues > 0;
  };
  const firstStep = new Map<InstanceId, InstanceId>();
  let frontier: InstanceId[] = [];
  for (const next of board.connectedTo(from)) {
    firstStep.set(next, next);
    frontier.push(next);
  }
  const seen = new Set([from, ...frontier]);
  while (frontier.length > 0) {
    const found = frontier.filter(wanted);
    if (found.length > 0) return found.map((id) => board.location(byId(firstStep.get(id)!)).name);
    const further: InstanceId[] = [];
    for (const id of frontier)
      for (const next of board.connectedTo(id)) {
        if (seen.has(next)) continue;
        seen.add(next);
        firstStep.set(next, firstStep.get(id)!);
        further.push(next);
      }
    frontier = further;
  }
  return [];
}
