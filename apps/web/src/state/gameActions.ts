import type {
  DecisionId,
  InstanceId,
  InvestigatorId,
  InvestigatorStat,
  PlayTable,
  SkillTestResult,
} from '@arkham/engine';
import { assertNever } from '@arkham/util';

/** The investigator counters the screen's +/− steppers change. */
export type SteppedStat = Extract<InvestigatorStat, 'resources' | 'damage' | 'horror'>;

/** Counts the players confirm when they answer a decision (clues found, damage soaked). */
export interface DecisionAmounts {
  /** For an option with one `amount` range. */
  amount?: number;
  /** For an option with named ranges, such as an attack's `damage` and `horror`. */
  amounts?: Readonly<Record<string, number>>;
}

/**
 * What the play screen can do to the open game, in the players' words and with the ids the
 * screen holds. It mirrors `PlayTable`'s verbs, but with the screen's defaults: a skill test is
 * never assumed passed (the chaos bag is on the table), so an action leaves it open and the players
 * report it with `resolveTest`. Each call is one step: stored before it shows, one undo group,
 * and a refusal ends up in `OpenGame.rejection`.
 */
export interface GameActions {
  /** The phase assistant's "Next". */
  nextPhase(): Promise<void>;
  startTurn(investigator: InvestigatorId): Promise<void>;
  endTurn(investigator: InvestigatorId): Promise<void>;
  resign(investigator: InvestigatorId): Promise<void>;
  /** Changes the actions the investigator has left this round. */
  adjustActions(investigator: InvestigatorId, delta: number): Promise<void>;
  /** A move action to a connected location. */
  moveTo(investigator: InvestigatorId, location: InstanceId): Promise<void>;
  /** An investigate action; its test stays open for `resolveTest`. */
  investigate(investigator: InvestigatorId): Promise<void>;
  /** A fight action; its test stays open for `resolveTest`. */
  fight(investigator: InvestigatorId, enemy: InstanceId): Promise<void>;
  /** An evade action; its test stays open for `resolveTest`. */
  evade(investigator: InvestigatorId, enemy: InstanceId): Promise<void>;
  /** An engage action. */
  engage(investigator: InvestigatorId, enemy: InstanceId): Promise<void>;
  /** Reports the open skill test of `investigator`; `amount` is the count a pass confirms. */
  resolveTest(
    investigator: InvestigatorId,
    result: SkillTestResult,
    amount?: number,
  ): Promise<void>;
  /** Picks `option` of the open `decision`, as the decision dialog lists them. */
  answer(decision: DecisionId, option: string, counts?: DecisionAmounts): Promise<void>;
  /** Enemy step 3.3: each listed enemy attack at its printed damage and horror. */
  resolveEnemyAttacks(): Promise<void>;
  /** The investigators spend the clues listed with them to advance the act. */
  advanceAct(spend: readonly { investigator: InvestigatorId; clues: number }[]): Promise<void>;
  /** One tap on a stepper: `delta` more (or, negative, fewer) of `stat`. */
  adjust(investigator: InvestigatorId, stat: SteppedStat, delta: number): Promise<void>;
  /** Doom on the current agenda. */
  placeDoom(amount: number): Promise<void>;
  /** Takes back the last step; never the scenario start. */
  undo(): Promise<void>;
}

/**
 * The play screen's actions over a `PlayTable` that `play` runs one step at a time and stores, and
 * the `undo` that takes a step back. The table stays behind this facade, so its test defaults and
 * its matchers never reach a component.
 */
export function gameActions(
  play: (step: (table: PlayTable) => void) => Promise<void>,
  undo: () => Promise<void>,
): GameActions {
  return {
    nextPhase: () => play((table) => void table.nextPhase()),
    startTurn: (investigator) => play((table) => table.startTurn(investigator)),
    endTurn: (investigator) => play((table) => table.endTurn(investigator)),
    resign: (investigator) => play((table) => table.resign(investigator)),
    adjustActions: (investigator, delta) =>
      play((table) => table.adjustActions(investigator, delta)),
    moveTo: (investigator, location) => play((table) => table.moveTo(investigator, location)),
    investigate: (investigator) =>
      play((table) => table.investigate(investigator, { result: 'open' })),
    fight: (investigator, enemy) =>
      play((table) => table.fight(investigator, enemy, { result: 'open' })),
    evade: (investigator, enemy) =>
      play((table) => table.evade(investigator, enemy, { result: 'open' })),
    engage: (investigator, enemy) => play((table) => table.engage(investigator, enemy)),
    resolveTest: (investigator, result, amount) =>
      play((table) => table.resolveTest(result, { for: investigator, amount })),
    answer: (decision, option, counts = {}) =>
      play((table) =>
        table.play({ type: 'ResolveDecision', decisionId: decision, optionId: option, ...counts }),
      ),
    resolveEnemyAttacks: () => play((table) => table.resolveEnemyAttacks()),
    advanceAct: (spend) =>
      play((table) =>
        table.spendCluesToAdvanceAct(spend.map(({ investigator, clues }) => [investigator, clues])),
      ),
    adjust: (investigator, stat, delta) =>
      play((table) => adjustStat(table, investigator, stat, delta)),
    placeDoom: (amount) => play((table) => table.placeDoom(amount)),
    undo,
  };
}

/** The `PlayTable` verb behind a stepper; a negative `delta` takes the counter down. */
function adjustStat(
  table: PlayTable,
  investigator: InvestigatorId,
  stat: SteppedStat,
  delta: number,
): void {
  switch (stat) {
    case 'resources':
      return table.gainResources(investigator, delta);
    case 'damage':
      return table.takeDamage(investigator, delta);
    case 'horror':
      return table.takeHorror(investigator, delta);
    default:
      return assertNever(stat);
  }
}
