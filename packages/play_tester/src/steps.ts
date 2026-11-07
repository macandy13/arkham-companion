import { assertNever } from '@arkham/util';
import {
  byId,
  byName,
  type CardName,
  type ChaosToken,
  type BasicAction,
  type InstanceId,
  type PlayTable,
  type SkillTestResult,
} from '@arkham/engine';

/** The `PlayTable` verbs that take only the investigator who acts or is corrected. */
export const INVESTIGATOR_VERBS = [
  'startTurn',
  'endTurn',
  'investigate',
  'takeResource',
  'drawCard',
  'playCard',
  'drawEncounterCard',
  'spendAction',
  'takeDamage',
  'takeHorror',
  'gainResources',
] as const;

/** One of `INVESTIGATOR_VERBS`. */
export type InvestigatorVerb = (typeof INVESTIGATOR_VERBS)[number];

/** The `PlayTable` verbs a bot uses against an enemy. */
export type EnemyVerb = 'fight' | 'evade' | 'engage';

/**
 * One step a bot plays: a `PlayTable` call with its arguments, investigators and locations by
 * printed name, enemies and other cards by instance id (copies share a name; a run's ids are fixed
 * by its seed). A list of steps replays a game on a fresh table, and reads like a session report.
 * Tests are left open (`result: 'open'`) and answered by an `answer` step, so the bot decides them
 * like any other question; corrections and doom move one at a time.
 */
export type Step =
  | { readonly verb: 'nextPhase' | 'resolveEnemyAttacks' | 'spendCluesToAdvanceAct' | 'undo' }
  | { readonly verb: 'placeDoom' }
  | { readonly verb: InvestigatorVerb; readonly investigator: CardName }
  | { readonly verb: 'moveTo'; readonly investigator: CardName; readonly location: CardName }
  | { readonly verb: EnemyVerb; readonly investigator: CardName; readonly enemy: InstanceId }
  | {
      readonly verb: 'useCardAction';
      readonly investigator: CardName;
      readonly card: InstanceId;
      readonly action: number;
    }
  /** Answers the open decision about the card `about`, or the only one when it is about none. */
  | { readonly verb: 'answer'; readonly about?: InstanceId; readonly option: string }
  /**
   * Reports the investigator's open skill test with the `result` the drawn chaos `tokens` give
   * (more than one when a bless, curse, frost or blood token makes them draw another); the tokens
   * are only for the reader, the table takes the result.
   */
  | {
      readonly verb: 'resolveTest';
      readonly investigator: CardName;
      readonly tokens: readonly ChaosToken[];
      readonly result: SkillTestResult;
    };

/** The basic action each action verb takes, which the players count off before they take it. */
const BASIC_ACTION_OF: Partial<Record<Step['verb'], BasicAction>> = {
  investigate: 'investigate',
  moveTo: 'move',
  drawCard: 'draw',
  takeResource: 'resource',
  playCard: 'play',
  engage: 'engage',
  fight: 'fight',
  evade: 'evade',
};

/**
 * The actions `step` costs the investigator who takes it: what the board says its basic action
 * costs now (`BoardView.actionCost`, a card can raise it), one for a card action unless it is
 * free, none for a step that is no action.
 */
export function actionCostOf(table: PlayTable, step: Step): number {
  const { board } = table;
  if (step.verb === 'useCardAction') {
    const { id } = board.investigator(byName(step.investigator));
    const offered = board
      .cardActions(id)
      .find(({ cardId, action }) => cardId === step.card && action === step.action);
    return offered?.free ? 0 : 1;
  }
  const action = BASIC_ACTION_OF[step.verb];
  if (action === undefined || !('investigator' in step)) return 0;
  return board.actionCost(board.investigator(byName(step.investigator)).id, action);
}

/**
 * Plays `step` on `table`; a refusal or misuse throws as the `PlayTable` call does. An action
 * first counts off what it costs, as the app's action buttons do, since the engine leaves counting
 * actions to the players; both are one step, so a refused action leaves the actions as they were.
 */
export function playStep(table: PlayTable, step: Step): void {
  if (step.verb === 'useCardAction' || BASIC_ACTION_OF[step.verb] !== undefined)
    table.step(() => {
      countOffAction(table, step);
      playVerb(table, step);
    });
  else playVerb(table, step);
}

/** Counts off the action `step` takes, as the app does (`spendActionFor`, `spendAction`). */
function countOffAction(table: PlayTable, step: Step): void {
  if (step.verb === 'useCardAction') {
    if (actionCostOf(table, step) > 0) table.spendAction(byName(step.investigator));
    return;
  }
  const action = BASIC_ACTION_OF[step.verb];
  if (action !== undefined && 'investigator' in step)
    table.spendActionFor(byName(step.investigator), action);
}

/** Plays the `PlayTable` call `step` names. */
function playVerb(table: PlayTable, step: Step): void {
  switch (step.verb) {
    case 'nextPhase':
      table.nextPhase();
      return;
    case 'resolveEnemyAttacks':
    case 'spendCluesToAdvanceAct':
    case 'undo':
      table[step.verb]();
      return;
    case 'placeDoom':
      table.placeDoom(1);
      return;
    case 'investigate':
      table.investigate(byName(step.investigator), { result: 'open' });
      return;
    case 'takeDamage':
    case 'takeHorror':
    case 'gainResources':
      table[step.verb](byName(step.investigator), 1);
      return;
    case 'startTurn':
    case 'endTurn':
    case 'takeResource':
    case 'drawCard':
    case 'playCard':
    case 'drawEncounterCard':
    case 'spendAction':
      table[step.verb](byName(step.investigator));
      return;
    case 'moveTo':
      table.moveTo(byName(step.investigator), byName(step.location));
      return;
    case 'fight':
    case 'evade':
      table[step.verb](byName(step.investigator), byId(step.enemy), { result: 'open' });
      return;
    case 'engage':
      table.engage(byName(step.investigator), byId(step.enemy));
      return;
    case 'useCardAction':
      table.useCardAction(byName(step.investigator), byId(step.card), step.action);
      return;
    case 'resolveTest':
      table.resolveTest(step.result, { for: byName(step.investigator) });
      return;
    case 'answer':
      if (step.about === undefined) table.answerOnly(step.option);
      else table.answer(byId(step.about), step.option);
      return;
    default:
      assertNever(step);
  }
}

/** `step` as the call it plays, e.g. `moveTo('Daisy Walker', 'Attic')`, for reports. */
export function describeStep(step: Step): string {
  const { verb, ...args } = step;
  return `${verb}(${Object.values(args)
    .map((arg) => JSON.stringify(arg))
    .join(', ')})`;
}
