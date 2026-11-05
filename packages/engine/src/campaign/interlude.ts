import { assertNever } from '@arkham/util';
import type { CardCode, InterludeId, InvestigatorCode, ScenarioId } from '../ids';
import type { CampaignCommand } from './campaign_commands';
import type { CampaignDefinition } from './campaign_definition';
import { storyHolds, type CampaignLog, type StoryCondition, type TraumaKind } from './campaign_log';
import { CampaignCommandRejected } from './campaign_rejection';
import {
  executeCommands,
  type CampaignContext,
  type CampaignExecuteResult,
} from './handle_campaign';
import {
  withoutChangesForEliminated,
  type ProposedChange,
  type ResolutionStep,
} from './resolution';

/**
 * An interlude (MC1.6e): story the players read between two scenarios, which writes to the
 * campaign log. Its `steps` are data like a resolution's, but they read the log instead of an
 * ended game, and may ask the players to decide.
 */
export interface InterludeDefinition {
  /** Stored in `CampaignLog.playedInterludes` once played. */
  readonly id: InterludeId;
  /** `ScenarioDefinition.id` of the scenario the interlude follows. */
  readonly afterScenario: ScenarioId;
  /** What the interlude writes, in the order the campaign guide reads. */
  readonly steps: readonly InterludeStep[];
}

/**
 * Whose campaign log entry an interlude step changes. There is no game to read a lead
 * investigator or a resignation from, so a step names either the whole living team or one of
 * them the players pick ("choose an investigator to earn …").
 */
export type InterludeTarget = 'each' | 'chosen';

/**
 * One step of an interlude as the campaign guide prints it. The steps that need no ended game
 * are a resolution's own; the investigator steps name an `InterludeTarget`, `whenStory` asks the
 * log, and `decide` asks the players. Only keys are entered, never the guide's text.
 */
export type InterludeStep =
  | Extract<
      ResolutionStep,
      { kind: 'record' | 'addChaosToken' | 'removeChaosToken' | 'endCampaign' | 'byHand' }
    >
  | { readonly kind: 'awardXp'; readonly to: InterludeTarget; readonly amount: number }
  | {
      readonly kind: 'addTrauma';
      readonly to: InterludeTarget;
      readonly trauma: TraumaKind;
      readonly amount: number;
    }
  | { readonly kind: 'earnCard'; readonly to: InterludeTarget; readonly card: CardCode }
  /** `then` when the log answers `condition` with yes ("if the investigators rescued …"), else `otherwise`. */
  | {
      readonly kind: 'whenStory';
      readonly condition: StoryCondition;
      readonly then: readonly InterludeStep[];
      readonly otherwise?: readonly InterludeStep[];
    }
  /**
   * "The investigators must decide (choose one)": the steps of the option the players pick.
   * `questionKey` and each `labelKey` are translation keys naming the choice, not its text.
   */
  | {
      readonly kind: 'decide';
      readonly questionKey: string;
      readonly options: readonly {
        readonly labelKey: string;
        readonly steps: readonly InterludeStep[];
      }[];
    };

/** A `decide` step the players have not answered yet, as `proposeInterlude` asks it. */
export interface InterludeQuestion {
  readonly questionKey: string;
  /** The options' `labelKey`s; the answer is an index into them. */
  readonly options: readonly string[];
}

/**
 * What an interlude proposes for the answers given so far: the next question while a `decide`
 * step is unanswered, else the changes to confirm, like a resolution's (`ProposedChange`).
 */
export type InterludeProposal =
  | { readonly kind: 'question'; readonly question: InterludeQuestion }
  | { readonly kind: 'changes'; readonly changes: readonly ProposedChange[] };

/**
 * The interlude due before the campaign's next scenario: the one `definition` places after the
 * last played scenario, unless the log already lists it as played or the campaign is over.
 */
export function findDueInterlude(
  definition: CampaignDefinition,
  log: CampaignLog,
): InterludeDefinition | undefined {
  if (log.result !== undefined) return undefined;
  const last = log.playedScenarios.at(-1)?.scenarioId;
  return definition.interludes?.find(
    (interlude) => interlude.afterScenario === last && !log.playedInterludes.includes(interlude.id),
  );
}

/**
 * The campaign log changes of `interlude` read against `log`. `answers` are the players' picks
 * for its `decide` steps, in the order the guide asks them: a later question may depend on an
 * earlier answer, so the proposal stops at the first `decide` step without a valid answer and
 * asks it. Then, as for a resolution, the players confirm or edit the changes, picking an option
 * for each choice, and `applyInterlude` writes them. A change for an investigator after the one
 * that eliminates them is left out (`withoutChangesForEliminated`).
 */
export function proposeInterlude(
  log: CampaignLog,
  interlude: InterludeDefinition,
  answers: readonly number[],
): InterludeProposal {
  const changes: ProposedChange[] = [];
  let answered = 0;

  // Returns the question that stops the walk, if any.
  function walk(steps: readonly InterludeStep[]): InterludeQuestion | undefined {
    for (const step of steps) {
      if (step.kind === 'whenStory') {
        const holds = storyHolds(log.story, step.condition) === true;
        const question = walk(holds ? step.then : (step.otherwise ?? []));
        if (question) return question;
      } else if (step.kind === 'decide') {
        const option = step.options[answers[answered] ?? -1];
        if (option === undefined)
          return {
            questionKey: step.questionKey,
            options: step.options.map((each) => each.labelKey),
          };
        answered += 1;
        const question = walk(option.steps);
        if (question) return question;
      } else {
        changes.push(...proposeStep(log, step));
      }
    }
    return undefined;
  }

  const question = walk(interlude.steps);
  if (question) return { kind: 'question', question };
  return { kind: 'changes', changes: withoutChangesForEliminated(log, changes) };
}

/**
 * Writes a confirmed interlude to the campaign log in one step: the commands the players
 * confirmed (`proposeInterlude`, edited as they like), then `CompleteInterlude`. Either every
 * command applies or the first rejection is thrown. Rejects an interlude that does not follow the
 * last played scenario (`interludeNotDue`); every entry's cause is the interlude.
 */
export function applyInterlude(
  ctx: CampaignContext,
  log: CampaignLog,
  interlude: InterludeDefinition,
  confirmed: readonly CampaignCommand[],
): CampaignExecuteResult {
  if (log.playedScenarios.at(-1)?.scenarioId !== interlude.afterScenario)
    throw new CampaignCommandRejected({ code: 'interludeNotDue', interludeId: interlude.id });
  const complete: CampaignCommand = { type: 'CompleteInterlude', interludeId: interlude.id };
  const cause = { kind: 'interlude', interludeId: interlude.id } as const;
  return executeCommands(ctx, log, [...confirmed, complete], cause);
}

type InvestigatorStep = Extract<InterludeStep, { to: InterludeTarget }>;

function proposeStep(
  log: CampaignLog,
  step: Exclude<InterludeStep, { kind: 'whenStory' | 'decide' }>,
): ProposedChange[] {
  switch (step.kind) {
    case 'record':
      return [command({ type: 'RecordStory', key: step.key, value: step.value })];
    case 'addChaosToken':
      return [command({ type: 'AddChaosToken', token: step.token })];
    case 'removeChaosToken':
      return [command({ type: 'RemoveChaosToken', token: step.token })];
    case 'endCampaign':
      return [command({ type: 'EndCampaign', result: step.result })];
    case 'byHand':
      return [{ kind: 'byHand', textKey: step.textKey }];
    case 'awardXp':
    case 'addTrauma':
    case 'earnCard':
      return forTarget(log, step);
    default:
      return assertNever(step);
  }
}

/** The step's command for each living team member, or a choice of one with `chosen`. */
function forTarget(log: CampaignLog, step: InvestigatorStep): ProposedChange[] {
  const commands = log.investigators
    .filter((investigator) => investigator.fate === 'alive')
    .map((investigator) => investigatorCommand(step, investigator.code));
  if (step.to === 'each') return commands.map(command);
  return commands.length > 0 ? [{ kind: 'choice', options: commands }] : [];
}

function investigatorCommand(step: InvestigatorStep, code: InvestigatorCode): CampaignCommand {
  switch (step.kind) {
    case 'awardXp':
      return { type: 'AwardXp', code, amount: step.amount };
    case 'addTrauma':
      return { type: 'AddTrauma', code, kind: step.trauma, amount: step.amount };
    case 'earnCard':
      return { type: 'EarnCard', code, card: step.card };
    default:
      return assertNever(step);
  }
}

function command(campaignCommand: CampaignCommand): ProposedChange {
  return { kind: 'command', command: campaignCommand };
}
