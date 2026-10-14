import type { Command, RequestDecision, ResolveDecision } from './commands';
import type { DecisionRequested, DecisionResolved } from './events';
import type { InstanceId } from './ids';
import { CommandRejected } from './rejection';
import type { Decider, Decision, DecisionOption, GameState, SkillTest } from './state';

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

/** `RequestDecision`: raises a scenario- or card-defined decision. */
export function handleRequestDecision(
  state: GameState,
  command: RequestDecision,
): DecisionRequested[] {
  const { decision } = command;
  if (state.pending.some((pending) => pending.id === decision.id))
    throw new CommandRejected({ code: 'duplicateDecision', decisionId: decision.id });
  const optionIds = new Set(decision.options.map((option) => option.id));
  if (decision.options.length === 0 || optionIds.size !== decision.options.length)
    throw new CommandRejected({ code: 'invalidDecisionOptions', decisionId: decision.id });
  return [{ type: 'DecisionRequested', decision }];
}

/** `ResolveDecision`: the decision is cleared; the option's commands follow via `answerCommands`. */
export function handleResolveDecision(
  state: GameState,
  command: ResolveDecision,
): DecisionResolved[] {
  chosenOption(state, command);
  return [{ type: 'DecisionResolved', decisionId: command.decisionId, optionId: command.optionId }];
}

/**
 * The commands the answer in `command` triggers, if it is a `ResolveDecision`.
 * Looked up in the state before the answer, because that is where the
 * decision is still pending.
 */
export function answerCommands(state: GameState, command: Command): readonly Command[] {
  if (command.type !== 'ResolveDecision') return [];
  return chosenOption(state, command).commands;
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
 * consequence. For use by the phase assistant (M1.10) and by scenario hooks
 * returning `RequestDecision`.
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
      { id: 'pass', label: 'decision.pass', commands: outcomes.onPass },
      { id: 'fail', label: 'decision.fail', commands: outcomes.onFail },
      ...margins,
    ],
  };
}
