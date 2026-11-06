import { z } from 'zod';
import { opt } from './raw_schema';

/**
 * Reads the chaos bags and setup steps of the ArkhamCards campaign guides, beside the layouts of
 * `campaign_guides.ts`, under the same rule: read at build time from the gitignored cache, never
 * committed, copied into the hand-entered `ScenarioDefinition` by its author (M4.1b).
 */

/** The difficulties a campaign guide offers a bag for; some campaigns offer only two. */
export type GuideDifficulty = 'easy' | 'standard' | 'hard' | 'expert';

const DIFFICULTIES: readonly GuideDifficulty[] = ['easy', 'standard', 'hard', 'expert'];

/**
 * A chaos token as the engine names it (`ChaosToken`): ArkhamCards writes the symbol tokens in
 * snake case (`elder_sign`), the engine in camel case (`elderSign`); numbers stay as they are.
 */
export type GuideChaosToken = string;

/** A campaign's starting chaos bag per difficulty, from its difficulty choice (`campaignChaosBags`). */
export type CampaignChaosBags = Partial<Record<GuideDifficulty, readonly GuideChaosToken[]>>;

/** Encounter sets one setup step gathers (`gather_encounter_sets`), by ArkhamDB encounter code. */
export interface GatheredSets {
  readonly stepId: string;
  readonly codes: readonly string[];
  /** Set aside instead of shuffled into the encounter deck, e.g. Night of the Zealot's Cultist deck. */
  readonly aside: boolean;
  /** The guide's text when it says more than the list ("Randomly choose one of …"), as HTML. */
  readonly text?: string;
}

/** Chaos tokens one setup step adds to or removes from the bag, whatever the log says. */
export interface ChaosBagChange {
  readonly stepId: string;
  readonly add: readonly GuideChaosToken[];
  readonly remove: readonly GuideChaosToken[];
}

/**
 * Why the import cannot read a setup step, so the author enters it by hand: its effect is only
 * written as text (most set-aside cards), it depends on the log or the players (`branch`), or
 * the players choose (`input`).
 */
export type ByHandReason = 'text' | 'branch' | 'input';

/** A setup step the import leaves to the author (`ByHandReason`). */
export interface ByHandStep {
  readonly stepId: string;
  readonly reason: ByHandReason;
}

/** What a scenario's setup steps give, in setup order (`scenarioSetup`). */
export interface ScenarioSetup {
  /** ArkhamCards' scenario id, as in `ScenarioLayouts.id`. */
  readonly id: string;
  readonly name: string;
  readonly encounterSets: readonly GatheredSets[];
  readonly chaosBagChanges: readonly ChaosBagChange[];
  readonly byHand: readonly ByHandStep[];
}

const RawTokensEffectSchema = z.object({
  type: z.enum(['add_chaos_token', 'remove_chaos_token']),
  tokens: z.array(z.string()),
});

const RawStepSchema = z
  .object({
    id: z.string(),
    type: opt(z.string()),
    text: opt(z.string()),
    encounter_sets: opt(z.array(z.string())),
    aside: opt(z.boolean()),
    effects: opt(z.array(z.object({ type: z.string() }).loose())),
  })
  .loose();

const RawScenarioSchema = z.object({
  id: z.string(),
  scenario_name: opt(z.string()),
  setup: opt(z.array(z.string())),
  steps: z.array(RawStepSchema),
});

const RawDifficultyChoiceSchema = z.object({
  id: z.literal('difficulty_choice'),
  input: z.object({
    choices: z.array(z.object({ id: z.string(), tokens: opt(z.array(z.string())) })),
  }),
});

const RawCampaignSchema = z.object({ steps: opt(z.array(z.object({ id: z.string() }).loose())) });

/** ArkhamCards' names of the tokens whose engine name differs. */
const TOKEN_NAMES: Readonly<Record<string, GuideChaosToken>> = {
  auto_fail: 'autoFail',
  elder_sign: 'elderSign',
  elder_thing: 'elderThing',
};

function isDifficulty(id: string): id is GuideDifficulty {
  return (DIFFICULTIES as readonly string[]).includes(id);
}

function tokenName(token: string): GuideChaosToken {
  return TOKEN_NAMES[token] ?? token;
}

/**
 * The starting chaos bags of a campaign (its `campaign.json`), per difficulty its guide offers.
 * Empty for a campaign without a difficulty choice, such as a Return to box, which plays with
 * its original campaign's bags.
 */
export function campaignChaosBags(rawCampaign: unknown): CampaignChaosBags {
  const step = RawCampaignSchema.parse(rawCampaign).steps?.find(
    (s) => s.id === 'difficulty_choice',
  );
  if (!step) return {};
  const choices = RawDifficultyChoiceSchema.parse(step).input.choices;
  return Object.fromEntries(
    choices.flatMap(({ id, tokens }) =>
      isDifficulty(id) && tokens ? [[id, tokens.map(tokenName)]] : [],
    ),
  );
}

/**
 * What the setup steps of one ArkhamCards scenario file give: the encounter sets, the chaos
 * tokens added or removed outright, and the steps left to do by hand. Steps the campaign
 * shares (`$check_tarot_reading`) are not the scenario's and are left out.
 */
export function scenarioSetup(rawScenario: unknown): ScenarioSetup {
  const scenario = RawScenarioSchema.parse(rawScenario);
  const steps = new Map(scenario.steps.map((step) => [step.id, step]));
  const setup = (scenario.setup ?? []).flatMap((id) => {
    // `$` marks a step the app shares between scenarios (`$play_scenario`), even where a file defines one.
    const step = id.startsWith('$') ? undefined : steps.get(id);
    return step ? [step] : [];
  });
  return {
    id: scenario.id,
    name: scenario.scenario_name ?? scenario.id,
    encounterSets: setup.flatMap(gatheredSets),
    chaosBagChanges: setup.flatMap(chaosBagChange),
    byHand: setup.flatMap(byHandStep),
  };
}

type RawStep = z.infer<typeof RawStepSchema>;

function gatheredSets(step: RawStep): GatheredSets[] {
  if (step.type !== 'encounter_sets' || !step.encounter_sets) return [];
  return [
    {
      stepId: step.id,
      codes: step.encounter_sets,
      aside: step.aside ?? false,
      ...(step.text === undefined ? {} : { text: step.text }),
    },
  ];
}

function chaosBagChange(step: RawStep): ChaosBagChange[] {
  const effects = (step.effects ?? []).flatMap((effect) => {
    const parsed = RawTokensEffectSchema.safeParse(effect);
    return parsed.success ? [parsed.data] : [];
  });
  if (effects.length === 0) return [];
  const tokensOf = (type: 'add_chaos_token' | 'remove_chaos_token') =>
    effects
      .filter((effect) => effect.type === type)
      .flatMap((effect) => effect.tokens.map(tokenName));
  return [
    { stepId: step.id, add: tokensOf('add_chaos_token'), remove: tokensOf('remove_chaos_token') },
  ];
}

function byHandStep(step: RawStep): ByHandStep[] {
  if (step.type === 'branch') return [{ stepId: step.id, reason: 'branch' }];
  if (step.type === 'input') return [{ stepId: step.id, reason: 'input' }];
  // A step without a type and without effects is a paragraph of the guide's setup text.
  if (step.type === undefined && !step.effects?.length)
    return [{ stepId: step.id, reason: 'text' }];
  return [];
}

/**
 * The setup lines of the import report: the campaign's bags, then per scenario its encounter
 * sets, chaos token changes and the steps to enter by hand.
 */
export function setupReport(
  bags: CampaignChaosBags,
  scenarios: readonly ScenarioSetup[],
): string[] {
  const bagLines = Object.entries(bags).map(
    ([difficulty, tokens]) => `  ${difficulty}: ${tokens.join(' ')}`,
  );
  return [
    ...(bagLines.length
      ? ['Chaos bags', ...bagLines]
      : ['No chaos bags: the guide has no difficulty choice']),
    ...scenarios.flatMap(scenarioLines),
  ];
}

function scenarioLines(scenario: ScenarioSetup): string[] {
  const byHand = (reason: ByHandReason) =>
    scenario.byHand.filter((step) => step.reason === reason).map((step) => step.stepId);
  return [
    `${scenario.name} (${scenario.id}) setup`,
    ...scenario.encounterSets.map(
      (sets) =>
        `  ${sets.aside ? 'set aside' : 'encounter sets'}: ${sets.codes.join(', ')}${sets.text ? ' (see text)' : ''}`,
    ),
    ...scenario.chaosBagChanges.map(
      (change) =>
        `  chaos bag (${change.stepId}):${change.add.length ? ` add ${change.add.join(' ')}` : ''}${change.remove.length ? ` remove ${change.remove.join(' ')}` : ''}`,
    ),
    ...(byHand('text').length ? [`  by hand, text only: ${byHand('text').join(', ')}`] : []),
    ...(byHand('branch').length
      ? [`  by hand, depends on the log or players: ${byHand('branch').join(', ')}`]
      : []),
    ...(byHand('input').length
      ? [`  by hand, the players choose: ${byHand('input').join(', ')}`]
      : []),
  ];
}
