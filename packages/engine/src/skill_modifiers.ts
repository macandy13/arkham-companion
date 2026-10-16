import { withRunningTotals } from '@arkham/util';
import type { EngineContext } from './cards';
import { isInPlay } from './doom';
import type { InstanceId, InvestigatorId } from './ids';
import { CommandRejected } from './rejection';
import { referenceSide, type SymbolToken } from './scenario';
import type {
  CardInstance,
  ChaosToken,
  Decision,
  GameState,
  ModifierSource,
  ModifierStep,
  ModifierTarget,
  SkillModifier,
  SkillName,
  SkillTestAction,
  SkillTestFilter,
  SkillTestSuggestion,
} from './state';

/**
 * What a modifier source sees of a skill test: who takes it, which skill
 * against which printed difficulty, the action it belongs to, what it is
 * about and where it happens. Derived from a `skillTestResult` decision by
 * `skillTestContext`; the keys match `SkillTestFilter`, which lasting effects
 * use to pick their tests.
 */
export interface SkillTestContext {
  investigatorId: InvestigatorId;
  skill: SkillName;
  /** The printed difficulty (shroud, enemy value, card number), before modifiers. */
  difficulty: number;
  action?: SkillTestAction;
  /** `Decision.subject`: the location investigated, the enemy fought or evaded, the treachery. */
  subject?: InstanceId;
  /** The investigator's location when the test is taken; absent while they are on none. */
  locationId?: InstanceId;
}

/**
 * What the players enter while they resolve the test at the table: the
 * number of matching icons on the cards they committed, and the chaos tokens
 * they revealed (several when an effect says "reveal another token").
 */
export interface SkillTestInput {
  committedIcons?: number;
  tokens?: readonly ChaosToken[];
}

/**
 * A card's contribution to skill tests while it is in play (a location,
 * an enemy, a treachery in a threat area, an attachment), registered as
 * `CardEffect.skillModifiers` under the card's code. Returns the modifiers it
 * applies to `test`, or none; a location that modifies tests taken at it
 * compares `test.locationId` with `card.id`. Must be pure.
 */
export type CardModifierHook = (
  ctx: EngineContext,
  state: GameState,
  test: SkillTestContext,
  card: CardInstance,
) => readonly SkillModifier[];

/** A modifier with the i18n key or plain text that names its source in the trace. */
export interface LabelledModifier extends SkillModifier {
  label: string;
}

/**
 * A scenario rule that changes skill tests (e.g. "while there is doom on the
 * agenda, …"); see `SkillModifierRegistry.sources`. Must be pure.
 */
export type ScenarioModifierSource = (
  ctx: EngineContext,
  state: GameState,
  test: SkillTestContext,
) => readonly LabelledModifier[];

/**
 * The modifier of a symbol token whose value depends on the state, like
 * The Gathering's skull ("-X, where X is the number of Ghoul enemies at your
 * location"). Must be pure.
 */
export type TokenValue = (ctx: EngineContext, state: GameState, test: SkillTestContext) => number;

/**
 * The scenario's code-side contributions to skill tests
 * (`ScenarioDefinition.modifiers`, passed to the engine as
 * `EngineContext.modifiers`), so a scenario changes tests without engine
 * changes. Cards contribute through `CardEffect.skillModifiers` instead.
 */
export interface SkillModifierRegistry {
  /** Scenario-wide rules, applied to every test in this order. */
  sources?: readonly ScenarioModifierSource[];
  /**
   * Symbol token values computed from the state, for the reference card
   * effects without a printed `modifier` (a "-X"). A printed modifier wins,
   * so a token whose "-X" is on one side only (The Gathering's skull is -X
   * on Easy/Standard, -2 on Hard/Expert) needs no check of the difficulty.
   */
  tokenValues?: Partial<Record<SymbolToken, TokenValue>>;
}

/** One change before its running total is known. */
type Change = Omit<ModifierStep, 'total'>;

const SYMBOL_TOKENS: readonly ChaosToken[] = ['skull', 'cultist', 'tablet', 'elderThing'];

/**
 * The modifiers of the tokens whose value is the same in every scenario.
 * Bless (+2), curse (-2) and frost (-1) also make the players reveal another
 * token, which they enter as one more token.
 */
const FIXED_TOKEN_VALUES: Partial<Record<ChaosToken, number>> = {
  '+1': 1,
  '0': 0,
  '-1': -1,
  '-2': -2,
  '-3': -3,
  '-4': -4,
  '-5': -5,
  '-6': -6,
  '-7': -7,
  '-8': -8,
  bless: 2,
  curse: -2,
  frost: -1,
};

/**
 * The skill test behind a `skillTestResult` decision, as modifier sources
 * see it; `undefined` for any other decision and for a test decided by the
 * lead or the group, since then nobody's skill is known.
 */
export function skillTestContext(
  state: GameState,
  decision: Decision,
): SkillTestContext | undefined {
  const test = decision.skillTest;
  if (decision.kind !== 'skillTestResult' || !test || decision.decider.kind !== 'investigator')
    return undefined;
  const { investigatorId } = decision.decider;
  const locationId = state.investigators.find((inv) => inv.id === investigatorId)?.locationId;
  return {
    investigatorId,
    skill: test.skill,
    difficulty: test.difficulty,
    ...(test.action ? { action: test.action } : {}),
    ...(decision.subject === undefined ? {} : { subject: decision.subject }),
    ...(locationId === undefined ? {} : { locationId }),
  };
}

/**
 * The suggestion for a pending `skillTestResult` decision with what the
 * players entered so far; `undefined` where `skillTestContext` has no test.
 * The UI calls this as the players commit cards and reveal tokens.
 */
export function suggestSkillTest(
  ctx: EngineContext,
  state: GameState,
  decision: Decision,
  input: SkillTestInput = {},
): SkillTestSuggestion | undefined {
  const test = skillTestContext(state, decision);
  return test && skillTestSuggestion(ctx, state, test, input);
}

/**
 * `decision` with the suggestion it is raised with (`Decision.suggestion`):
 * the modified values before any icons or tokens. Unchanged where
 * `skillTestContext` has no test.
 */
export function withSuggestion(ctx: EngineContext, state: GameState, decision: Decision): Decision {
  const suggestion = suggestSkillTest(ctx, state, decision);
  return suggestion ? { ...decision, suggestion } : decision;
}

/**
 * The modifier pipeline: the investigator's printed skill and the test's
 * printed difficulty, changed in this order by the committed icons, the
 * revealed chaos tokens (fixed values, the reference card side for the
 * difficulty, then the scenario's `tokenValues`), the lasting effects whose filter
 * matches, the cards in play with a `skillModifiers` hook, and the
 * scenario's `sources` (Rules Reference, "Skill Tests", ST.5). Neither value
 * goes below 0 (Rules Reference, "Modifiers": a modified quantity cannot be
 * reduced below zero), and the auto-fail token makes the skill value 0 (ST.6). Rejects a
 * modifier or icon count that is not a whole number (`invalidModifierAmount`),
 * so a broken hook or input shows up instead of skewing the numbers.
 */
export function skillTestSuggestion(
  ctx: EngineContext,
  state: GameState,
  test: SkillTestContext,
  input: SkillTestInput = {},
): SkillTestSuggestion {
  const investigator = state.investigators.find((inv) => inv.id === test.investigatorId);
  if (!investigator)
    throw new CommandRejected({ code: 'unknownInvestigator', investigatorId: test.investigatorId });
  const tokens = input.tokens ?? [];
  const tokenChanges = tokens.map((token) => ({
    token,
    change: tokenChange(ctx, state, test, token),
  }));
  const changes = [
    ...iconChanges(input.committedIcons ?? 0),
    ...tokenChanges.flatMap(({ change }) => change ?? []),
    ...lastingEffectChanges(state, test),
    ...cardChanges(ctx, state, test),
    ...scenarioChanges(ctx, state, test),
  ];
  for (const change of changes) assertWhole(change.change);
  const autoFail = tokens.includes('autoFail');
  const skill = targetTrace('skill', investigator.skills[test.skill], changes, autoFail);
  const difficulty = targetTrace('difficulty', test.difficulty, changes, false);
  return {
    skill: skill.total,
    difficulty: difficulty.total,
    outcome: !autoFail && skill.total >= difficulty.total ? 'pass' : 'fail',
    unknownTokens: tokenChanges
      .filter(({ token, change }) => token !== 'autoFail' && change === undefined)
      .map(({ token }) => token),
    trace: [...skill.steps, ...difficulty.steps],
  };
}

/**
 * The steps of one target: its base value, its changes, and the rules that
 * cap the result (nothing below 0; auto-fail sets the skill value to 0), each
 * as a step of its own so the trace explains the final number.
 */
function targetTrace(
  target: ModifierTarget,
  base: number,
  changes: readonly Change[],
  autoFail: boolean,
): { steps: ModifierStep[]; total: number } {
  const own = changes.filter((change) => change.target === target);
  const sum = own.reduce((total, change) => total + change.change, base);
  const floored = Math.max(sum, 0);
  const caps: Change[] = [
    ...(sum < 0 ? [{ target, source: { kind: 'minimumZero' } as const, change: -sum }] : []),
    ...(autoFail && floored > 0
      ? [{ target, source: { kind: 'autoFail' } as const, change: -floored }]
      : []),
  ];
  const baseStep: Change = {
    target,
    source: { kind: target === 'skill' ? 'baseSkill' : 'baseDifficulty' },
    change: base,
  };
  return {
    steps: withRunningTotals([baseStep, ...own, ...caps], (step) => step.change),
    total: autoFail ? 0 : floored,
  };
}

function iconChanges(committedIcons: number): Change[] {
  if (!Number.isInteger(committedIcons) || committedIcons < 0)
    throw new CommandRejected({ code: 'invalidModifierAmount', amount: committedIcons });
  if (committedIcons === 0) return [];
  return [{ target: 'skill', source: { kind: 'committedIcons' }, change: committedIcons }];
}

/**
 * The skill change of one revealed token, or `undefined` when the engine
 * cannot tell it (the elder sign, a symbol without a number) and for
 * auto-fail, which is not a modifier.
 */
function tokenChange(
  ctx: EngineContext,
  state: GameState,
  test: SkillTestContext,
  token: ChaosToken,
): Change | undefined {
  const fixed = FIXED_TOKEN_VALUES[token];
  if (fixed !== undefined)
    return { target: 'skill', source: { kind: 'chaosToken', token }, change: fixed };
  if (!isSymbolToken(token)) return undefined;
  const effect = ctx.reference?.[referenceSide(state.meta.difficulty)][token];
  const value = ctx.modifiers?.tokenValues?.[token];
  const amount = effect?.modifier ?? value?.(ctx, state, test);
  if (amount === undefined) return undefined;
  const source: ModifierSource = {
    kind: 'chaosToken',
    token,
    ...(effect ? { effectKey: effect.effectKey } : {}),
  };
  return { target: 'skill', source, change: amount };
}

function isSymbolToken(token: ChaosToken): token is SymbolToken {
  return SYMBOL_TOKENS.includes(token);
}

function lastingEffectChanges(state: GameState, test: SkillTestContext): Change[] {
  return state.lastingEffects
    .filter((effect) => matchesFilter(effect.appliesTo, test))
    .map((effect) => ({
      target: effect.modifier.target,
      source: { kind: 'lastingEffect', effectId: effect.id, label: effect.label },
      change: effect.modifier.amount,
    }));
}

/** Whether every condition of `filter` holds for `test`; an empty filter matches every test. */
function matchesFilter(filter: SkillTestFilter, test: SkillTestContext): boolean {
  return (Object.keys(filter) as (keyof SkillTestFilter)[]).every(
    (key) => filter[key] === undefined || filter[key] === test[key],
  );
}

function cardChanges(ctx: EngineContext, state: GameState, test: SkillTestContext): Change[] {
  return Object.values(state.cards).flatMap((card) => {
    const hook = ctx.effects?.[card.code]?.skillModifiers;
    if (!hook || !isInPlay(state, card)) return [];
    return hook(ctx, state, test, card).map((modifier) => ({
      target: modifier.target,
      source: { kind: 'card', cardId: card.id } as const,
      change: modifier.amount,
    }));
  });
}

function scenarioChanges(ctx: EngineContext, state: GameState, test: SkillTestContext): Change[] {
  return (ctx.modifiers?.sources ?? []).flatMap((source) =>
    source(ctx, state, test).map((modifier) => ({
      target: modifier.target,
      source: { kind: 'scenario', label: modifier.label } as const,
      change: modifier.amount,
    })),
  );
}

function assertWhole(amount: number): void {
  if (!Number.isInteger(amount))
    throw new CommandRejected({ code: 'invalidModifierAmount', amount });
}
