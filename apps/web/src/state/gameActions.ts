import type { DecisionId, InvestigatorId, PlayTable, SkillTestResult } from '@arkham/engine';

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
  /** An investigate action; its test stays open for `resolveTest`. */
  investigate(investigator: InvestigatorId): Promise<void>;
  /** Reports the open skill test of `investigator`; `amount` is the count a pass confirms. */
  resolveTest(
    investigator: InvestigatorId,
    result: SkillTestResult,
    amount?: number,
  ): Promise<void>;
  /** Picks `option` of the open `decision`, as the decision dialog lists them. */
  answer(decision: DecisionId, option: string, counts?: DecisionAmounts): Promise<void>;
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
    investigate: (investigator) =>
      play((table) => table.investigate(investigator, { result: 'open' })),
    resolveTest: (investigator, result, amount) =>
      play((table) => table.resolveTest(result, { for: investigator, amount })),
    answer: (decision, option, counts = {}) =>
      play((table) =>
        table.play({ type: 'ResolveDecision', decisionId: decision, optionId: option, ...counts }),
      ),
    undo,
  };
}
