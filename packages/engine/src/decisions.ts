import type { EngineContext } from './cards';
import type { Command, RequestDecision, ResolveDecision } from './commands';
import type { DecisionRequested, DecisionResolved, SkillTestResolved } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import { isActiveInvestigator } from './investigators';
import { CommandRejected } from './rejection';
import { withSuggestion } from './skill_modifiers';
import { NAMED_AMOUNTS } from './state';
import type {
  AmountRange,
  Decider,
  Decision,
  DecisionOption,
  GameState,
  NamedAmount,
  PerPointFailed,
  SkillTest,
  SkillTestOutcome,
} from './state';

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

/**
 * `ResolveDecision`: the decision is cleared, with the test's outcome
 * (`SkillTestResolved`) when it was a skill test; the option's commands
 * follow via `answerCommands`.
 */
export function handleResolveDecision(
  state: GameState,
  command: ResolveDecision,
): (DecisionResolved | SkillTestResolved)[] {
  optionCommands(state, command);
  checkMargin(state, command);
  const resolved: DecisionResolved = {
    type: 'DecisionResolved',
    decisionId: command.decisionId,
    optionId: command.optionId,
  };
  const decision = state.pending.find((pending) => pending.id === command.decisionId);
  return decision?.skillTest
    ? [resolved, skillTestResolved(decision, decision.skillTest, command)]
    : [resolved];
}

/** The outcome the answer `optionId` gives a `skillTestResult` decision (`skillTestDecision`). */
function skillTestResolved(
  decision: Decision,
  skillTest: SkillTest,
  command: ResolveDecision,
): SkillTestResolved {
  const margin = command.margin ?? perPointMargin(decision, command);
  return {
    type: 'SkillTestResolved',
    decisionId: decision.id,
    ...(decision.decider.kind === 'investigator'
      ? { investigatorId: decision.decider.investigatorId }
      : {}),
    ...(decision.subject ? { subject: decision.subject } : {}),
    skillTest,
    outcome: answerOutcome(command),
    ...(margin === undefined ? {} : { margin }),
  };
}

/**
 * Rejects a `margin` on an answer to anything but a skill test
 * (`marginNotApplicable`), and one that is not a whole number of 0 or more
 * (`invalidMargin`).
 */
function checkMargin(state: GameState, command: ResolveDecision): void {
  if (command.margin === undefined) return;
  const decision = state.pending.find((pending) => pending.id === command.decisionId);
  if (!decision?.skillTest)
    throw new CommandRejected({ code: 'marginNotApplicable', decisionId: command.decisionId });
  if (!Number.isInteger(command.margin) || command.margin < 0)
    throw new CommandRejected({
      code: 'invalidMargin',
      decisionId: command.decisionId,
      margin: command.margin,
    });
}

/** The outcome an answer to a `skillTestResult` decision reports: anything but `pass` is a fail. */
export function answerOutcome(command: ResolveDecision): SkillTestOutcome {
  return command.optionId === 'pass' ? 'pass' : 'fail';
}

/**
 * The commands the answer in `command` triggers, if it is a `ResolveDecision`.
 * Looked up in the state before the answer, because that is where the
 * decision is still pending.
 */
export function answerCommands(state: GameState, command: Command): readonly Command[] {
  if (command.type !== 'ResolveDecision') return [];
  return [...perPointCommands(state, command), ...optionCommands(state, command)];
}

/**
 * What a per-point fail deals (`Decision.perPointFailed`): the margin the
 * answer confirms, as damage or horror on the tested investigator.
 */
function perPointCommands(state: GameState, command: ResolveDecision): Command[] {
  const decision = state.pending.find((pending) => pending.id === command.decisionId);
  const margin = decision && perPointMargin(decision, command);
  if (!decision?.perPointFailed || !margin || decision.decider.kind !== 'investigator') return [];
  const { investigatorId } = decision.decider;
  return [
    { type: 'AdjustInvestigator', investigatorId, stat: decision.perPointFailed, delta: margin },
  ];
}

/**
 * How much a per-point fail failed by (`Decision.perPointFailed`): the
 * answer's `margin`, or 1 when it gives none. None for a pass or any other
 * decision. A fail by 0 (an auto-fail against difficulty 0) deals nothing.
 */
function perPointMargin(decision: Decision, command: ResolveDecision): number | undefined {
  if (!decision.perPointFailed || command.optionId !== 'fail') return undefined;
  return command.margin ?? 1;
}

/**
 * The chosen option's commands. The counts the answer confirms (`amount`,
 * `amounts`) are only checked here against the option's ranges: the
 * decision's resolver reads them (`testedActionCommands`, `forcedAttackCommands`).
 */
function optionCommands(state: GameState, command: ResolveDecision): readonly Command[] {
  const option = chosenOption(state, command);
  if (command.amount !== undefined) checkAmount(command, option.amount, command.amount);
  for (const name of NAMED_AMOUNTS) {
    const amount = command.amounts?.[name];
    if (amount !== undefined) checkAmount(command, option.amounts?.[name], amount, name);
  }
  return option.commands;
}

/**
 * Rejects `amount` unless the option has a `range` for it that holds it;
 * `name` is set for a named amount and absent for the plain `amount`.
 */
function checkAmount(
  command: ResolveDecision,
  range: AmountRange | undefined,
  amount: number,
  name?: NamedAmount,
): void {
  const where = {
    decisionId: command.decisionId,
    optionId: command.optionId,
    ...(name === undefined ? {} : { name }),
  };
  if (!range) throw new CommandRejected({ code: 'amountNotAdjustable', ...where });
  if (!inRange(amount, range))
    throw new CommandRejected({
      code: 'amountOutOfRange',
      ...where,
      amount,
      min: range.min,
      ...(range.max === undefined ? {} : { max: range.max }),
    });
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
  if (command.answeredBy !== undefined && !mayAnswer(state, decision.decider, command.answeredBy))
    throw new CommandRejected({
      code: 'notTheDecider',
      decisionId: decision.id,
      answeredBy: command.answeredBy,
      decider: decision.decider,
    });
  const option = decision.options.find((candidate) => candidate.id === command.optionId);
  if (!option)
    throw new CommandRejected({
      code: 'unknownOption',
      decisionId: command.decisionId,
      optionId: command.optionId,
    });
  return option;
}

/**
 * Whether `investigatorId` may answer for `decider`: the named investigator,
 * the current lead, or for the group any investigator still in the scenario.
 */
function mayAnswer(state: GameState, decider: Decider, investigatorId: InvestigatorId): boolean {
  switch (decider.kind) {
    case 'investigator':
      return decider.investigatorId === investigatorId;
    case 'lead':
      return state.meta.leadInvestigator === investigatorId;
    case 'group':
      return isActiveInvestigator(state, investigatorId);
  }
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
   * "For each point you fail by": the tester takes 1 damage or horror per
   * point of the fail answer's `margin` (1 when it gives none), and
   * `SkillTestResolved.margin` records it.
   */
  perPointFailed?: PerPointFailed;
}

/**
 * A `skillTestResult` decision: the players resolve `test` at the table and
 * answer with `pass` or `fail`, and how much by (`ResolveDecision.margin`);
 * the matching commands are the consequence. Used by the investigate, fight and evade actions, by
 * revelation tests and by card abilities (`TestSkill`).
 */
export function skillTestDecision(
  decision: Pick<Decision, 'id' | 'prompt' | 'subject'> & { decider: Decider; test: SkillTest },
  outcomes: SkillTestOutcomes,
): Decision {
  const { test, ...rest } = decision;
  return {
    ...rest,
    kind: 'skillTestResult',
    skillTest: test,
    options: [
      { id: 'pass', label: 'decision.pass', commands: outcomes.onPass },
      { id: 'fail', label: 'decision.fail', commands: outcomes.onFail },
    ],
    ...(outcomes.perPointFailed ? { perPointFailed: outcomes.perPointFailed } : {}),
  };
}
