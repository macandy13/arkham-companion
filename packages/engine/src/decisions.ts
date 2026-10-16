import type { EngineContext } from './cards';
import type { Command, RequestDecision, ResolveDecision } from './commands';
import type { DecisionRequested, DecisionResolved } from './events';
import type { InstanceId } from './ids';
import { CommandRejected } from './rejection';
import { withSuggestion } from './skill_modifiers';
import type { AmountRange, Decider, Decision, DecisionOption, GameState, SkillTest } from './state';

/** Commands that stay allowed while a decision is pending: corrections, and the answer itself. */
const ALLOWED_WHILE_PENDING: readonly Command['type'][] = ['ManualAdjust', 'ResolveDecision'];

/**
 * Rejects `command` while any decision is pending. The engine needs the
 * answer before it can continue, so other commands would act on a state the
 * pending decision is about to change. Only applies to commands from outside:
 * follow-ups of hooks and of an answer run inside the chain that is allowed.
 */
export function assertNoPendingDecision(state: GameState, command: Command): void {
  const [pending] = state.pending;
  if (pending === undefined || ALLOWED_WHILE_PENDING.includes(command.type)) return;
  throw new CommandRejected({ code: 'decisionPending', decisionId: pending.id });
}

/**
 * A `DecisionRequested` for `decision`, unless one with this id is already open.
 * For rule modules that re-check a condition after every change (agenda
 * threshold, engagement, hunter ties) and must not ask twice; the
 * `RequestDecision` command is stricter and rejects a duplicate.
 */
export function requestDecision(state: GameState, decision: Decision): DecisionRequested[] {
  if (state.pending.some((pending) => pending.id === decision.id)) return [];
  return [{ type: 'DecisionRequested', decision }];
}

/**
 * `RequestDecision`: raises a scenario- or card-defined decision. A card's
 * skill test (`skillTestDecision`) is built without the state, so its
 * suggestion is attached here, where the state is known.
 */
export function handleRequestDecision(
  ctx: EngineContext,
  state: GameState,
  command: RequestDecision,
): DecisionRequested[] {
  const { decision } = command;
  if (state.pending.some((pending) => pending.id === decision.id))
    throw new CommandRejected({ code: 'duplicateDecision', decisionId: decision.id });
  const optionIds = new Set(decision.options.map((option) => option.id));
  if (decision.options.length === 0 || optionIds.size !== decision.options.length)
    throw new CommandRejected({ code: 'invalidDecisionOptions', decisionId: decision.id });
  return [{ type: 'DecisionRequested', decision: withSuggestion(ctx, state, decision) }];
}

/** `ResolveDecision`: the decision is cleared; the option's commands follow via `answerCommands`. */
export function handleResolveDecision(
  state: GameState,
  command: ResolveDecision,
): DecisionResolved[] {
  optionCommands(state, command);
  return [{ type: 'DecisionResolved', decisionId: command.decisionId, optionId: command.optionId }];
}

/**
 * The commands the answer in `command` triggers, if it is a `ResolveDecision`.
 * Looked up in the state before the answer, because that is where the
 * decision is still pending.
 */
export function answerCommands(state: GameState, command: Command): readonly Command[] {
  if (command.type !== 'ResolveDecision') return [];
  return optionCommands(state, command);
}

/** The chosen option's commands, with the confirmed amount if the answer gives one. */
function optionCommands(state: GameState, command: ResolveDecision): readonly Command[] {
  const option = chosenOption(state, command);
  if (command.amount === undefined) return option.commands;
  if (!option.amount)
    throw new CommandRejected({
      code: 'amountNotAdjustable',
      decisionId: command.decisionId,
      optionId: option.id,
    });
  if (!inRange(command.amount, option.amount))
    throw new CommandRejected({
      code: 'amountOutOfRange',
      decisionId: command.decisionId,
      optionId: option.id,
      amount: command.amount,
      min: option.amount.min,
      ...(option.amount.max === undefined ? {} : { max: option.amount.max }),
    });
  const amount = command.amount;
  return option.commands.map((cmd) => ('amount' in cmd ? { ...cmd, amount } : cmd));
}

function inRange(amount: number, range: AmountRange): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= range.min &&
    (range.max === undefined || amount <= range.max)
  );
}

function chosenOption(state: GameState, command: ResolveDecision): DecisionOption {
  const decision = state.pending.find((pending) => pending.id === command.decisionId);
  if (!decision)
    throw new CommandRejected({ code: 'unknownDecision', decisionId: command.decisionId });
  const option = decision.options.find((candidate) => candidate.id === command.optionId);
  if (!option)
    throw new CommandRejected({
      code: 'unknownOption',
      decisionId: command.decisionId,
      optionId: command.optionId,
    });
  return option;
}

/** The yes/no options of a `confirm` decision: "yes" runs `onYes`, "no" does nothing. */
export function confirmOptions(onYes: Command[], target?: InstanceId): DecisionOption[] {
  return [
    { id: 'yes', label: 'decision.yes', ...(target ? { target } : {}), commands: onYes },
    { id: 'no', label: 'decision.no', commands: [] },
  ];
}

/** What follows each outcome of a skill test. */
export interface SkillTestOutcomes {
  onPass: Command[];
  /**
   * Makes the pass a count the players confirm (clues discovered, damage
   * dealt): `onPass` is written for its default (see `DecisionOption.amount`).
   */
  passAmount?: AmountRange;
  onFail: Command[];
  /**
   * Consequences that depend on how much the test failed by (`failedBy[2]`
   * for "failed by 2"). Commands are plain data, so each margin the card cares
   * about gets its own option next to the plain "fail" option.
   */
  failedBy?: Readonly<Record<number, Command[]>>;
}

/**
 * A `skillTestResult` decision: the players resolve `test` at the table and
 * answer with `pass`, `fail` or `failedBy:<n>`; the matching commands are the
 * consequence. Used by the investigate, fight and evade actions, by
 * revelation tests and by scenario hooks returning `RequestDecision`.
 */
export function skillTestDecision(
  decision: Pick<Decision, 'id' | 'prompt' | 'subject'> & { decider: Decider; test: SkillTest },
  outcomes: SkillTestOutcomes,
): Decision {
  const { test, ...rest } = decision;
  const margins = Object.entries(outcomes.failedBy ?? {}).map(([margin, commands]) => ({
    id: `failedBy:${margin}`,
    label: 'decision.failedBy',
    commands,
  }));
  return {
    ...rest,
    kind: 'skillTestResult',
    skillTest: test,
    options: [
      {
        id: 'pass',
        label: 'decision.pass',
        commands: outcomes.onPass,
        ...(outcomes.passAmount ? { amount: outcomes.passAmount } : {}),
      },
      { id: 'fail', label: 'decision.fail', commands: outcomes.onFail },
      ...margins,
    ],
  };
}
