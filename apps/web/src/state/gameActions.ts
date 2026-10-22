import {
  CommandRejected,
  type DecisionId,
  type GameState,
  type InstanceId,
  type InvestigatorId,
  type InvestigatorStat,
  type PlayTable,
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
  resign(): Promise<void>;
  /** Changes the actions left this turn. */
  adjustActions(delta: number): Promise<void>;
  /** A move action to a connected location. */
  moveTo(location: InstanceId): Promise<void>;
  /** An investigate action; its test stays open as a decision. */
  investigate(): Promise<void>;
  /** A fight action; its test stays open as a decision. */
  fight(enemy: InstanceId): Promise<void>;
  /** An evade action; its test stays open as a decision. */
  evade(enemy: InstanceId): Promise<void>;
  /** An engage action. */
  engage(enemy: InstanceId): Promise<void>;
  /**
   * Moves `enemy` to `location` as a card instruction says, connected or not. The players follow
   * the instruction whatever the engagement, so an engaged enemy disengages and moves too.
   */
  moveEnemy(enemy: InstanceId, location: InstanceId): Promise<void>;
  /** Picks `option` of the first open decision, as the decision dialog lists them. */
  answer(option: string, counts?: DecisionAmounts): Promise<void>;
  /** Enemy step 3.3: each listed enemy attack at its printed damage and horror. */
  resolveEnemyAttacks(): Promise<void>;
  /** The investigators spend the clues listed with them to advance the act. */
  advanceAct(spend: readonly ClueSpend[]): Promise<void>;
  /** One tap on an investigator's stepper: `delta` more (or, negative, fewer) of `stat`. */
  adjust(investigator: InvestigatorId, stat: SteppedStat, delta: number): Promise<void>;
  /** Doom on the current agenda. */
  placeDoom(amount: number): Promise<void>;
  /** Doom taken off the current agenda by hand (a card effect, a miscount). */
  removeDoom(amount: number): Promise<void>;
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
    resign: () => onTurn((table, investigator) => table.resign(investigator)),
    adjustActions: (delta) =>
      onTurn((table, investigator) => table.adjustActions(investigator, delta)),
    moveTo: (location) => onTurn((table, investigator) => table.moveTo(investigator, location)),
    investigate: () =>
      onTurn((table, investigator) => table.investigate(investigator, { result: 'open' })),
    fight: (enemy) =>
      onTurn((table, investigator) => table.fight(investigator, enemy, { result: 'open' })),
    evade: (enemy) =>
      onTurn((table, investigator) => table.evade(investigator, enemy, { result: 'open' })),
    engage: (enemy) => onTurn((table, investigator) => table.engage(investigator, enemy)),
    moveEnemy: (enemy, location) =>
      play((table) => table.moveEnemy(enemy, location, { forced: true })),
    answer: (option, counts = {}) =>
      play((table) =>
        table.play({
          type: 'ResolveDecision',
          decisionId: firstDecision(table.state),
          optionId: option,
          ...counts,
        }),
      ),
    resolveEnemyAttacks: () => play((table) => table.resolveEnemyAttacks()),
    advanceAct: (spend) =>
      play((table) =>
        table.spendCluesToAdvanceAct(spend.map(({ investigator, clues }) => [investigator, clues])),
      ),
    adjust: (investigator, stat, delta) =>
      play((table) => adjustStat(table, investigator, stat, delta)),
    placeDoom: (amount) => play((table) => table.placeDoom(amount)),
    removeDoom: (amount) => play((table) => table.removeDoom(amount)),
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

/** Clues one investigator pays towards the act (`GameActions.advanceAct`). */
export interface ClueSpend {
  investigator: InvestigatorId;
  clues: number;
}

/**
 * The clues to pay for an act that needs `needed`, taken from the investigators in seat order
 * until enough are in. The header's one-tap advance uses it until the players can split the
 * payment themselves; any split is legal, as the group pools its clues.
 */
export function cluesInSeatOrder(
  investigators: readonly { id: InvestigatorId; clues: number }[],
  needed: number,
): ClueSpend[] {
  const spend: ClueSpend[] = [];
  let missing = needed;
  for (const { id, clues } of investigators) {
    const paid = Math.min(clues, missing);
    if (paid > 0) spend.push({ investigator: id, clues: paid });
    missing -= paid;
  }
  return spend;
}
