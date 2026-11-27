import {
  byId,
  ATTACK_SKIP_OPTION,
  CANCEL_REVELATION_OPTION,
  isEnemyAttackDecision,
  isRevelationDecision,
  optionName,
  type BoardView,
  type Decision,
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
 * board or undoes, and never cancels a revelation or an enemy attack, which takes a card it
 * doesn't hold (Ward of Protection, Dodge; the deck bot plays those itself).
 */
export function goalWeights(table: PlayTable, offered: readonly Step[]): number[] {
  const { board } = table;
  const turn = board.turn;
  const engaged = turn === undefined ? [] : board.enemiesEngagedWith(turn).map(({ id }) => id);
  const at = turn === undefined ? undefined : board.locationOf(turn);
  const cluesHere = at !== undefined && board.location(byId(at)).clues > 0;
  const towardClues =
    at === undefined || cluesHere ? [] : (nearestClues(board, at)?.firstSteps ?? []);
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
    isRare(step) || cancelsWithoutCard(table, step) ? 0 : movesOn(step) ? GOAL_WEIGHT : 1,
  );
}

/** The id of the option of `decision` that a card in hand stands for, if it has one. */
function cancelOptionOf(decision: Decision): string | undefined {
  if (isRevelationDecision(decision)) return CANCEL_REVELATION_OPTION;
  if (isEnemyAttackDecision(decision)) return ATTACK_SKIP_OPTION;
  return undefined;
}

/**
 * Whether `step` answers a question with the option a card in hand stands for: a drawn
 * treachery's revelation cancelled, or an enemy attack (one due, or an attack of opportunity)
 * that does not happen.
 */
function cancelsWithoutCard(table: PlayTable, step: Step): boolean {
  if (step.verb !== 'answer') return false;
  return table.state.pending.some((decision) => {
    if (decision.subject !== step.about) return false;
    const cancel = decision.options.find(({ id }) => id === cancelOptionOf(decision));
    return cancel !== undefined && optionName(cancel) === step.option;
  });
}

/**
 * The way to the nearest location with clues on it or still unrevealed (revealing puts its clues
 * there), from `from`: how many moves it takes (0 at such a location) and the locations next to
 * `from` that start a shortest way there. None when there is no such location left, or no way to
 * one. The lookahead bot scores how close the investigators are by `moves`.
 */
export function nearestClues(
  board: BoardView,
  from: InstanceId,
): { readonly moves: number; readonly firstSteps: readonly InstanceId[] } | undefined {
  const wanted = (id: InstanceId) => {
    const location = board.location(byId(id));
    return !location.revealed || location.clues > 0;
  };
  if (wanted(from)) return { moves: 0, firstSteps: [] };
  const firstStep = new Map<InstanceId, InstanceId>();
  let frontier: InstanceId[] = [];
  for (const next of board.connectedTo(from)) {
    firstStep.set(next, next);
    frontier.push(next);
  }
  const seen = new Set([from, ...frontier]);
  for (let moves = 1; frontier.length > 0; moves++) {
    const found = frontier.filter(wanted);
    if (found.length > 0) return { moves, firstSteps: found.map((id) => firstStep.get(id)!) };
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
  return undefined;
}
