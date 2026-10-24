import { withRunningTotals } from '@arkham/util';
import type { EngineContext } from './cards';
import type { InstanceId, InvestigatorId } from './ids';
import { findInvestigator, requireInvestigator } from './investigators';
import { CommandRejected } from './rejection';
import { pickReferenceSide, type SymbolToken } from './scenario';
import type {
  ChaosToken,
  Decision,
  GameState,
  ModifierSource,
  ModifierStep,
  ModifierTarget,
  SkillName,
  SkillValues,
  SkillTestSuggestion,
} from './state';

/**
 * What a token value sees of a skill test: who takes it, which skill
 * against which printed difficulty, and where it happens. Derived from a
 * `skillTestResult` decision by `skillTestContext`.
 */
export interface SkillTestContext {
  investigatorId: InvestigatorId;
  skill: SkillName;
  /** The printed difficulty (shroud, enemy value, card number), before modifiers. */
  difficulty: number;
  /** The investigator's location when the test is taken; absent while they are on none. */
  locationId?: InstanceId;
}

/**
 * What the players enter while they resolve the test at the table, following
 * the skill test timing (Rules Reference, "Skill Test Timing"):
 *
 * - `modifier`: one whole number, positive or negative, for everything the
 *   engine does not track – committed icons, cards in play, lasting effects,
 *   "while investigating" rules. The players enter it before drawing the
 *   token: the player windows after ST.1 (test begins) and ST.2 (commit
 *   cards) are where cards are committed and fast effects add to the test.
 * - `tokens`: the chaos tokens revealed in ST.3 (several when an effect says
 *   "reveal another token").
 * - `addedSkill`: a second skill whose printed value a card adds to the
 *   tested one ("test [willpower] + [intellect]").
 *
 * There is no player window after ST.2, but abilities that trigger on the
 * reveal (ST.3/ST.4, e.g. "after you reveal a chaos token") or on the
 * result ("when you would fail", ST.6) can still raise or lower the value,
 * so the players may change `modifier` up or down until they answer pass or
 * fail; the suggestion is recomputed from whatever they entered last.
 * Modelling each card's effect instead is deliberately out of scope: the
 * players play their own cards (§1), and one number is enough for the
 * suggestion.
 */
export interface SkillTestInput {
  modifier?: number;
  tokens?: readonly ChaosToken[];
  addedSkill?: SkillName;
}

/**
 * The modifier of a symbol token whose value depends on the state, like
 * The Gathering's skull ("-X, where X is the number of Ghoul enemies at your
 * location"). Must be pure.
 */
export type TokenValue = (ctx: EngineContext, state: GameState, test: SkillTestContext) => number;

/**
 * The scenario's code-side contributions to skill tests
 * (`ScenarioDefinition.modifiers`, read from `EngineContext.scenario`), so a
 * scenario values its tokens without engine changes.
 */
export interface SkillModifierRegistry {
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
 * Bless (+2), curse (-2), frost (-1) and blood (-1) also make the players
 * reveal another token, which they enter as one more token. Blood also seals
 * the first box on the investigator card; the players do that on the table.
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
  blood: -1,
};

/** The tokens that make the tester reveal another token, whose modifier also applies. */
const REVEALS_ANOTHER: ReadonlySet<ChaosToken> = new Set(['bless', 'curse', 'frost', 'blood']);

/**
 * Whether revealing `token` makes the tester reveal another one (bless, curse, frost, blood), so
 * a test that has revealed it is not finished yet.
 */
export function revealsAnotherToken(token: ChaosToken): boolean {
  return REVEALS_ANOTHER.has(token);
}

/**
 * The skill test behind a `skillTestResult` decision, as token values
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
  const locationId = findInvestigator(state, investigatorId)?.locationId;
  return {
    investigatorId,
    skill: test.skill,
    difficulty: test.difficulty,
    ...(locationId === undefined ? {} : { locationId }),
  };
}

/**
 * The suggestion for a pending `skillTestResult` decision with what the
 * players entered so far; `undefined` where `skillTestContext` has no test.
 * The UI calls this whenever the players change their modifier or reveal
 * a token (see `SkillTestInput` for when that happens).
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
 * the modified values before the players' modifier or any token. Unchanged where
 * `skillTestContext` has no test.
 */
export function withSuggestion(ctx: EngineContext, state: GameState, decision: Decision): Decision {
  const suggestion = suggestSkillTest(ctx, state, decision);
  return suggestion ? { ...decision, suggestion } : decision;
}

/**
 * The modifier pipeline: the investigator's printed skill, changed by the
 * players' modifier and then by the revealed chaos tokens (fixed values, the
 * reference card side for the difficulty, then the scenario's
 * `tokenValues`), against the test's printed difficulty (Rules Reference,
 * "Skill Tests", ST.5). Neither value goes below 0 (Rules Reference,
 * "Modifiers": a modified quantity cannot be reduced below zero), and the
 * auto-fail token makes the skill value 0 (ST.6). Rejects a modifier that is
 * not a whole number (`invalidModifierAmount`), so a broken input or token
 * value shows up instead of skewing the numbers.
 */
export function skillTestSuggestion(
  ctx: EngineContext,
  state: GameState,
  test: SkillTestContext,
  input: SkillTestInput = {},
): SkillTestSuggestion {
  const investigator = requireInvestigator(state, test.investigatorId);
  const tokens = input.tokens ?? [];
  const tokenChanges = tokens.map((token) => ({
    token,
    change: tokenChange(ctx, state, test, token),
  }));
  const changes = [
    ...addedSkillChanges(investigator.skills, input.addedSkill),
    ...playerChanges(input.modifier ?? 0),
    ...tokenChanges.flatMap(({ change }) => change ?? []),
  ];
  for (const change of changes) assertWhole(change.change);
  const autoFail = tokens.includes('autoFail');
  const skill = targetTrace('skill', investigator.skills[test.skill], changes, autoFail);
  const difficulty = targetTrace('difficulty', test.difficulty, changes, false);
  const passes = !autoFail && skill.total >= difficulty.total;
  return {
    skill: skill.total,
    difficulty: difficulty.total,
    outcome: passes ? 'pass' : 'fail',
    margin: Math.abs(skill.total - difficulty.total),
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

function addedSkillChanges(skills: SkillValues, added: SkillName | undefined): Change[] {
  if (added === undefined) return [];
  return [{ target: 'skill', source: { kind: 'addedSkill', skill: added }, change: skills[added] }];
}

function playerChanges(modifier: number): Change[] {
  if (modifier === 0) return [];
  return [{ target: 'skill', source: { kind: 'playerModifier' }, change: modifier }];
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
  const effect = ctx.scenario?.reference[pickReferenceSide(state.meta.difficulty)][token];
  const value = ctx.scenario?.modifiers?.tokenValues?.[token];
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

function assertWhole(amount: number): void {
  if (!Number.isInteger(amount))
    throw new CommandRejected({ code: 'invalidModifierAmount', amount });
}
