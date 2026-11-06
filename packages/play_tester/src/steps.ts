import { assertNever } from '@arkham/util';
import { byId, byName, type CardName, type InstanceId, type PlayTable } from '@arkham/engine';

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
  | { readonly verb: 'answer'; readonly about?: InstanceId; readonly option: string };

/** Plays `step` on `table`; a refusal or misuse throws as the `PlayTable` call does. */
export function playStep(table: PlayTable, step: Step): void {
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
