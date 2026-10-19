import {
  CommandRejected,
  type DecisionId,
  type GameState,
  type InvestigatorId,
  type PlayTable,
} from '@arkham/engine';

/** Counts the players confirm when they answer a decision (clues found, damage soaked). */
export interface DecisionAmounts {
  /** For an option with one `amount` range. */
  amount?: number;
  /** For an option with named ranges, such as an attack's `damage` and `horror`. */
  amounts?: Readonly<Record<string, number>>;
}

/**
 * What the play screen can do to the open game, in the players' words. It mirrors `PlayTable`'s
 * verbs, but with the screen's defaults:
 * - An action is taken by the investigator whose turn it is, since the rules allow actions only
 *   during one's own turn; without a turn it is refused with `noTurnInProgress`.
 * - The decision dialog shows the first open decision, so an answer picks an option of that one;
 *   without one it is refused with `noPendingDecision`.
 * - A skill test is never assumed passed (the chaos bag is on the table): an action leaves it
 *   open, and the players report it like any decision, by answering `pass` or `fail`.
 *
 * Each call is one step: stored before it shows, one undo group, and a refusal ends up in
 * `OpenGame.rejection`.
 */
export interface GameActions {
  /** The phase assistant's "Next". */
  nextPhase(): Promise<void>;
  /** Begins the turn of `investigator`, whom the players picked. */
  startTurn(investigator: InvestigatorId): Promise<void>;
  endTurn(): Promise<void>;
  /** An investigate action; its test stays open as a decision. */
  investigate(): Promise<void>;
  /** Picks `option` of the first open decision, as the decision dialog lists them. */
  answer(option: string, counts?: DecisionAmounts): Promise<void>;
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
  const onTurn = (action: (table: PlayTable, investigator: InvestigatorId) => void) =>
    play((table) => action(table, turnInvestigator(table.state)));
  return {
    nextPhase: () => play((table) => void table.nextPhase()),
    startTurn: (investigator) => play((table) => table.startTurn(investigator)),
    endTurn: () => onTurn((table, investigator) => table.endTurn(investigator)),
    investigate: () =>
      onTurn((table, investigator) => table.investigate(investigator, { result: 'open' })),
    answer: (option, counts = {}) =>
      play((table) =>
        table.play({
          type: 'ResolveDecision',
          decisionId: firstDecision(table.state),
          optionId: option,
          ...counts,
        }),
      ),
    undo,
  };
}

/** Whose turn it is; refused like an engine command when no one's is. */
function turnInvestigator(state: GameState): InvestigatorId {
  const investigator = state.meta.turn?.investigatorId;
  if (investigator === undefined) throw new CommandRejected({ code: 'noTurnInProgress' });
  return investigator;
}

/** The decision the dialog shows; refused like an engine command when none is open. */
function firstDecision(state: GameState): DecisionId {
  const [decision] = state.pending;
  if (decision === undefined) throw new CommandRejected({ code: 'noPendingDecision' });
  return decision.id;
}
