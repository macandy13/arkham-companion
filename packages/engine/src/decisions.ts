import { assertNever, duplicates, numberedDuplicates, range } from '@arkham/util';
import type { EngineContext } from './cards';
import { isEnemyOnTable, locationOf } from './enemies';
import type { Command, MarginTier, RequestDecision, ResolveDecision } from './commands';
import type { DecisionRequested, DecisionResolved, SkillTestResolved } from './events';
import type { DecisionId, InstanceId, InvestigatorId } from './ids';
import { isActiveInvestigator } from './investigators';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import { withSuggestion } from './skill_modifiers';
import { NAMED_AMOUNTS } from './state';
import type {
  AmountRange,
  AnswerableCommand,
  AnsweredAmount,
  Decider,
  Decision,
  DecisionOption,
  GameState,
  NamedAmount,
  SkillTest,
  SkillTestOutcome,
} from './state';

/** The pending decision with `id`, if it is still open (`GameState.pending`). */
export function pendingDecision(state: GameState, id: DecisionId): Decision | undefined {
  return state.pending.find((pending) => pending.id === id);
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
 * The labels of options that each pick one of `cardIds`, in that order: the
 * card's printed name, followed by the name of its location when another of
 * the cards has the same name ("Ghoul Minion (Cellar)"), and numbered when
 * that still leaves two alike (two Ghoul Minions in one cellar, two locations
 * named "Cellar"). Options are answered by readable name (`optionNamed`), so
 * two options with one name could not be answered at all. The number only
 * follows the order of `cardIds`: it tells the options apart, not the cards
 * on the map, which are alike anyway.
 */
export function cardOptionLabels(
  ctx: EngineContext,
  state: GameState,
  cardIds: readonly InstanceId[],
): string[] {
  const names = cardIds.map((cardId) => cardName(ctx, state, cardId));
  const shared = new Set(duplicates(names));
  const withLocations = cardIds.map((cardId, i) => {
    const name = names[i] ?? cardId;
    const card = requireCard(state.cards, cardId);
    if (!shared.has(name) || !isEnemyOnTable(card)) return name;
    return `${name} (${cardName(ctx, state, locationOf(state, card))})`;
  });
  return numberedDuplicates(withLocations);
}

/** The printed name of the card `cardId`, or its ID when the card data has no definition for it. */
function cardName(ctx: EngineContext, state: GameState, cardId: InstanceId): string {
  return ctx.cards.get(requireCard(state.cards, cardId).code)?.name ?? cardId;
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
  const decision = pendingDecision(state, command.decisionId);
  return decision?.skillTest
    ? [resolved, skillTestResolved(state, decision, decision.skillTest, command)]
    : [resolved];
}

/** The outcome the answer `optionId` gives a `skillTestResult` decision (`skillTestDecision`). */
function skillTestResolved(
  state: GameState,
  decision: Decision,
  skillTest: SkillTest,
  command: ResolveDecision,
): SkillTestResolved {
  const margin = answeredMargin(state, command);
  return {
    type: 'SkillTestResolved',
    decisionId: decision.id,
    ...(decision.decider.kind === 'investigator'
      ? { investigatorId: decision.decider.investigatorId }
      : {}),
    ...(decision.subject ? { subject: decision.subject } : {}),
    skillTest,
    ...(decision.testKind ? { action: decision.testKind.kind } : {}),
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
  const decision = pendingDecision(state, command.decisionId);
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
  const chosen = optionCommands(state, command);
  const margin = answeredMargin(state, command);
  return margin === undefined ? chosen : chosen.flatMap((entry) => withMargin(entry, margin));
}

/**
 * Whether what an option does depends on how much its test passed or failed by: it holds a
 * `ForEachPoint` or `ByMargin`, so the answer says the margin (`DecisionView.asksMargin`).
 */
export function dependsOnMargin(option: DecisionOption): boolean {
  return option.commands.some(
    (entry) => entry.type === 'ForEachPoint' || entry.type === 'ByMargin',
  );
}

/**
 * How much the answered test passed or failed by: the answer's `margin`, or, for an option that
 * depends on it (`dependsOnMargin`) but was answered without one, the least the outcome means
 * (a fail by 1, a pass by 0). None for any other answer.
 */
function answeredMargin(state: GameState, command: ResolveDecision): number | undefined {
  if (command.margin !== undefined) return command.margin;
  const option = pendingDecision(state, command.decisionId)?.options.find(
    (candidate) => candidate.id === command.optionId,
  );
  if (option === undefined || !dependsOnMargin(option)) return undefined;
  return answerOutcome(command) === 'fail' ? 1 : 0;
}

/**
 * An outcome entry with its margin applied: a `ForEachPoint` becomes its commands for each point,
 * a `ByMargin` the commands of the highest tier `margin` reaches (none when it reaches none), and
 * any other command stays as it is. Rules Reference, "For each": an effect that can be worked out
 * at once is one effect, so "take 1 damage for each point" is one "take 3 damage" (`timesMargin`);
 * any other (a choice per point) resolves once for each point.
 */
function withMargin(entry: Command, margin: number): Command[] {
  switch (entry.type) {
    case 'ForEachPoint':
      // A fail by 0 (an auto-fail against difficulty 0) costs nothing, not an effect of 0.
      if (margin === 0) return [];
      return entry.commands.flatMap(
        (perPoint) =>
          timesMargin(perPoint, margin) ??
          range(margin).flatMap(() => withMargin(perPoint, margin)),
      );
    case 'ByMargin': {
      const reached = entry.tiers.filter((tier) => margin >= tier.atLeast);
      const tier = reached.reduce<MarginTier | undefined>(
        (best, candidate) =>
          best === undefined || candidate.atLeast > best.atLeast ? candidate : best,
        undefined,
      );
      return (tier?.commands ?? []).flatMap((inner) => withMargin(inner, margin));
    }
    default:
      return [entry];
  }
}

/**
 * `command` with its amount multiplied by `margin`, for an effect that is an amount (damage,
 * horror, clues, doom, encounter cards discarded), also when deferred as a card's effect (`ResolveEffect`); undefined for
 * any other.
 */
function timesMargin(command: Command, margin: number): Command | undefined {
  if (command.type === 'ResolveEffect') {
    const effect = timesMargin(command.effect as Command, margin);
    // A scaled effect keeps its templated references: only the number changed.
    return effect && { ...command, effect: effect as typeof command.effect };
  }
  switch (command.type) {
    case 'AdjustInvestigator':
      return { ...command, delta: command.delta * margin };
    case 'TakeDamageAndHorror':
      return { ...command, damage: command.damage * margin, horror: command.horror * margin };
    case 'PlaceClues':
    case 'PlaceDoom':
      return { ...command, amount: command.amount * margin };
    case 'DiscardEncounterTop':
      return { ...command, count: command.count * margin };
    default:
      return undefined;
  }
}

/**
 * `ForEachPoint` and `ByMargin` on their own, outside a test's outcome: rejected
 * (`marginOutsideTest`), as only the answer to a test says a margin to apply them with.
 */
export function handleMarginEntry(): never {
  throw new CommandRejected({ code: 'marginOutsideTest' });
}

/**
 * The chosen option's commands, with the counts the answer confirms filled
 * in (`AnsweredAmount`). The plain `amount` is only checked here: the
 * decision's resolver reads it (`testedActionCommands`).
 */
function optionCommands(state: GameState, command: ResolveDecision): Command[] {
  const option = chosenOption(state, command);
  if (command.amount !== undefined) checkAmount(command, option.amount, command.amount);
  for (const name of NAMED_AMOUNTS) {
    const amount = command.amounts?.[name];
    if (amount !== undefined) checkAmount(command, option.amounts?.[name], amount, name);
  }
  return option.commands.map((cmd) => withAnsweredAmounts(cmd, option, command));
}

/**
 * `cmd` with each `AnsweredAmount` replaced by the answer's count of that
 * name, or the option's default for it.
 */
function withAnsweredAmounts(
  cmd: AnswerableCommand,
  option: DecisionOption,
  command: ResolveDecision,
): Command {
  const filled = Object.fromEntries(
    Object.entries(cmd).map(([field, value]) => [
      field,
      isAnsweredAmount(value) ? answeredAmount(value.answer, option, command) : value,
    ]),
  );
  // Only `AnsweredAmount` values were replaced, each by a number, so `filled` is the command without them.
  return filled as Command;
}

/**
 * The option's commands as they will run, when no count waits for the answer
 * (an ability's choice); undefined when one holds an `AnsweredAmount`.
 */
export function plainOptionCommands(option: DecisionOption): Command[] | undefined {
  const answered = option.commands.some((cmd) => Object.values(cmd).some(isAnsweredAmount));
  // Without an `AnsweredAmount` field, each command is a plain `Command`.
  return answered ? undefined : (option.commands as Command[]);
}

function isAnsweredAmount(value: unknown): value is AnsweredAmount {
  return typeof value === 'object' && value !== null && 'answer' in value;
}

/**
 * The count `name` the answer confirms, or the option's default for it. An
 * option that names a count without a range for it cannot be answered
 * (`amountNotAdjustable`).
 */
function answeredAmount(
  name: NamedAmount,
  option: DecisionOption,
  command: ResolveDecision,
): number {
  const amount = command.amounts?.[name] ?? option.amounts?.[name]?.default;
  if (amount === undefined)
    throw new CommandRejected({
      code: 'amountNotAdjustable',
      decisionId: command.decisionId,
      optionId: option.id,
      name,
    });
  return amount;
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
  const decision = pendingDecision(state, command.decisionId);
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

/** Whether two deciders are the same players: the same kind, and for one investigator the same one. */
export function sameDecider(one: Decider, other: Decider): boolean {
  switch (one.kind) {
    case 'investigator':
      return other.kind === 'investigator' && other.investigatorId === one.investigatorId;
    case 'lead':
    case 'group':
      return other.kind === one.kind;
    default:
      return assertNever(one);
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
  };
}
