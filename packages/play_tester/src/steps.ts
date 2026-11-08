import { assertNever } from '@arkham/util';
import {
  byId,
  byName,
  type CardName,
  type ChaosToken,
  type Command,
  type BasicAction,
  type InstanceId,
  type PlayTable,
  type SkillName,
  type SkillTestResult,
  type WoundKind,
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
   * are only for the reader, the table takes the result. A pass may confirm an `amount` (a
   * weapon's damage, a skill card's extra clue); `cards` names the player cards committed or used
   * for it, only for the reader.
   */
  | {
      readonly verb: 'resolveTest';
      readonly investigator: CardName;
      readonly tokens: readonly ChaosToken[];
      readonly result: SkillTestResult;
      readonly amount?: number;
      readonly cards?: readonly CardName[];
    }
  /**
   * The `effects` of the player card `card` the deck bot played or used. The engine holds no
   * player cards, so the step carries what the card did; `card` is for the reader
   * (player-card-analysis.md). A card played with an action comes after a `playCard` step, which
   * counts off the action and lets attacks of opportunity come first.
   */
  | {
      readonly verb: 'playerCard';
      readonly investigator: CardName;
      readonly card: CardName;
      readonly effects: readonly CardEffect[];
    };

/**
 * What a player card does on the table, in the commands the table already has
 * (player-card-analysis.md, "Effects in table terms"): for the investigator who plays it, at their
 * location; enemies by instance id like the other steps.
 */
export type CardEffect =
  | { readonly kind: 'damageEnemy'; readonly enemy: InstanceId; readonly amount: number }
  | { readonly kind: 'evadeEnemy'; readonly enemy: InstanceId }
  | { readonly kind: 'disengage'; readonly enemy: InstanceId }
  | { readonly kind: 'discoverClues'; readonly amount: number }
  | { readonly kind: 'heal'; readonly stat: WoundKind; readonly amount: number }
  | { readonly kind: 'hurt'; readonly damage: number; readonly horror: number }
  /** Resources gained, or spent when negative (a card's cost, a paid boost). */
  | { readonly kind: 'resources'; readonly delta: number }
  /** A skill raised while the card is in play, or lowered when it leaves. */
  | { readonly kind: 'skillBoost'; readonly skill: SkillName; readonly delta: number }
  | { readonly kind: 'actions'; readonly delta: number }
  | { readonly kind: 'doomOnPlayerCards'; readonly delta: number }
  | { readonly kind: 'drawEncounterCard' }
  | { readonly kind: 'moveTo'; readonly location: CardName };

/**
 * The basic action each action verb takes, which the players count off before they take it;
 * `undefined` for a verb that is no basic action. A full record, so a new verb has to say.
 */
const BASIC_ACTION_OF: Record<Step['verb'], BasicAction | undefined> = {
  nextPhase: undefined,
  resolveEnemyAttacks: undefined,
  spendCluesToAdvanceAct: undefined,
  undo: undefined,
  placeDoom: undefined,
  startTurn: undefined,
  endTurn: undefined,
  drawEncounterCard: undefined,
  spendAction: undefined,
  takeDamage: undefined,
  takeHorror: undefined,
  gainResources: undefined,
  useCardAction: undefined,
  answer: undefined,
  playerCard: undefined,
  resolveTest: undefined,
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
    return board.cardAction(id, step.card, step.action)?.free ? 0 : 1;
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
  if (step.verb === 'playerCard') table.step(() => playVerb(table, step));
  else if (step.verb === 'useCardAction' || BASIC_ACTION_OF[step.verb] !== undefined)
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
      table.resolveTest(step.result, {
        for: byName(step.investigator),
        ...(step.amount !== undefined && { amount: step.amount }),
      });
      return;
    case 'answer':
      if (step.about === undefined) table.answerOnly(step.option);
      else table.answer(byId(step.about), step.option);
      return;
    case 'playerCard':
      playPlayerCard(table, step);
      return;
    default:
      assertNever(step);
  }
}

/** Each effect of `step` as the command the table takes it with. */
function playPlayerCard(table: PlayTable, step: Extract<Step, { verb: 'playerCard' }>): void {
  for (const effect of step.effects)
    table.play(cardEffectCommand(table, step.investigator, effect));
}

/** The command `effect` is for `investigator`, at their location. */
function cardEffectCommand(table: PlayTable, investigator: CardName, effect: CardEffect): Command {
  const { board } = table;
  const { id: investigatorId, at } = board.investigator(byName(investigator));
  const here = () => {
    if (at === undefined) throw new Error(`${investigator} is at no location`);
    return board.location(byName(at)).id;
  };
  switch (effect.kind) {
    case 'damageEnemy':
      return { type: 'DamageEnemy', enemyId: effect.enemy, amount: effect.amount };
    case 'evadeEnemy':
      return { type: 'EvadeEnemy', enemyId: effect.enemy, investigatorId };
    case 'disengage':
      return { type: 'DisengageEnemy', enemyId: effect.enemy };
    case 'discoverClues':
      return { type: 'DiscoverClues', investigatorId, locationId: here(), amount: effect.amount };
    case 'heal':
      return { type: 'HealInvestigator', investigatorId, stat: effect.stat, amount: effect.amount };
    case 'hurt':
      return {
        type: 'TakeDamageAndHorror',
        investigatorId,
        damage: effect.damage,
        horror: effect.horror,
      };
    case 'resources':
      return { type: 'AdjustInvestigator', investigatorId, stat: 'resources', delta: effect.delta };
    case 'doomOnPlayerCards':
      return {
        type: 'AdjustInvestigator',
        investigatorId,
        stat: 'doomOnPlayerCards',
        delta: effect.delta,
      };
    case 'skillBoost':
      return {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'skillBoost',
          investigatorId,
          skill: effect.skill,
          delta: effect.delta,
        },
      };
    case 'actions':
      return {
        type: 'ManualAdjust',
        adjustment: { kind: 'actions', investigatorId, delta: effect.delta },
      };
    case 'drawEncounterCard':
      return { type: 'DrawEncounter', investigatorId };
    case 'moveTo':
      return {
        type: 'MoveInvestigator',
        investigatorId,
        to: board.location(byName(effect.location)).id,
      };
    default:
      return assertNever(effect);
  }
}

/** `step` as the call it plays, e.g. `moveTo('Daisy Walker', 'Attic')`, for reports. */
export function describeStep(step: Step): string {
  const { verb, ...args } = step;
  return `${verb}(${Object.values(args)
    .map((arg) => JSON.stringify(arg))
    .join(', ')})`;
}
