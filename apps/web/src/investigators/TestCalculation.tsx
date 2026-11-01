import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SKILL_NAMES,
  type BoardView,
  type ChaosToken,
  type InvestigatorId,
  type InvestigatorView,
  type ModifierSource,
  type ModifierStep,
  type SkillName,
  type SkillTest,
  type SkillTestSuggestion,
} from '@arkham/engine';
import { assertNever, sum } from '@arkham/util';
import { drawTokens, testFinished } from './drawTokens';
import './test_calculation.css';

/** The skills a test adds up: the tested one first, then the one a card adds to it. */
export type TestedSkills = readonly [SkillName, SkillName?];

/**
 * A skill test as the players run it at the table (MD.2b): the skills tested, their modifier and
 * the tokens drawn so far, and what the engine makes of them (`BoardView.skillTest`), the skill
 * value alone before a token is out. Kept by the dialog that shows the test (`useSkillTest`), so
 * its answer can use the result.
 */
export interface SkillTestRun {
  skills: TestedSkills;
  pick: (skill: SkillName) => void;
  modifier: number;
  setModifier: (modifier: number) => void;
  revealed: readonly ChaosToken[];
  draw: () => void;
  /** The calculation with the tokens drawn so far; its outcome counts only once `finished`. */
  result: SkillTestSuggestion;
  /** Whether the tokens drawn settle the test: false before the first and while one asks for another. */
  finished: boolean;
}

/**
 * The run of `investigator`'s `test`, or nothing when there is no test or no one takes it (a
 * decision that is no skill test): hooks cannot be called conditionally, so the decision dialog
 * calls it either way. The players keep the test's skill or switch to another (a card can test a
 * different one), add a second one a card adds to it (`pickSkill`), set their modifier and let
 * the app draw: the engine draws nothing itself, so the draw happens here, at the edge.
 */
export function useSkillTest(
  board: BoardView,
  investigator: InvestigatorId | undefined,
  test: SkillTest | undefined,
): SkillTestRun | undefined {
  const [picked, setSkills] = useState<TestedSkills>();
  const [modifier, setModifier] = useState(0);
  const [revealed, setRevealed] = useState<readonly ChaosToken[]>([]);
  if (investigator === undefined || test === undefined) return undefined;
  const skills = picked ?? [test.skill];
  const [tested, added] = skills;
  const result = board.skillTest(
    investigator,
    { skill: tested, difficulty: test.difficulty },
    { modifier, tokens: revealed, ...(added === undefined ? {} : { addedSkill: added }) },
  );
  return {
    skills,
    pick: (each) => setSkills(pickSkill(skills, each)),
    modifier,
    setModifier,
    revealed,
    draw: () => setRevealed(drawTokens(board.chaosBag, revealed, Math.random)),
    result,
    finished: testFinished(revealed),
  };
}

/**
 * The skills tested after tapping `skill`. Tapping another skill adds it as the second (or
 * replaces the second); tapping a chosen one drops it, unless it is the only one, since a test
 * always has a skill.
 */
export function pickSkill(skills: TestedSkills, skill: SkillName): TestedSkills {
  const [tested, added] = skills;
  if (skill === tested) return added === undefined ? skills : [added];
  if (skill === added) return [tested];
  return [tested, skill];
}

/**
 * The test block of every skill test dialog (MD.2b): the investigator's four skills as toggles,
 * the difficulty when the players set it (`onDifficulty`, the panel's own test; a decision's comes
 * from the card), their modifier and the result strip, which holds the draw button.
 */
export function SkillTestBlock({
  board,
  investigator,
  run,
  difficulty,
  onDifficulty,
}: {
  board: BoardView;
  investigator: InvestigatorView;
  run: SkillTestRun;
  difficulty?: number;
  onDifficulty?: (difficulty: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SkillToggles investigator={investigator} chosen={run.skills} onPick={run.pick} />
      {difficulty !== undefined && onDifficulty && (
        <Stepper
          label={t('skillTest.difficulty')}
          value={difficulty}
          shown={String(difficulty)}
          min={0}
          onChange={onDifficulty}
        />
      )}
      <Stepper
        label={t('skillTest.modifier')}
        hint={t('skillTest.modifierHint')}
        value={run.modifier}
        shown={signed(run.modifier)}
        onChange={run.setModifier}
      />
      <ResultStrip
        result={run.result}
        revealed={run.revealed}
        skill={run.skills[0]}
        finished={run.finished}
        {...(board.chaosBag.length > 0 ? { onDraw: run.draw } : {})}
      />
    </>
  );
}

/**
 * The investigator's four skills as toggles, each its glyph from the investigator card and its
 * value, the `chosen` ones pressed; `onPick` gets the one tapped.
 */
export function SkillToggles({
  investigator,
  chosen,
  onPick,
}: {
  investigator: InvestigatorView;
  chosen: readonly (SkillName | undefined)[];
  onPick: (skill: SkillName) => void;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('investigators.skills')} data-part="skills">
      <ul>
        {SKILL_NAMES.map((each) => (
          <li key={each}>
            <button
              type="button"
              aria-pressed={chosen.includes(each)}
              aria-label={t('investigators.skillValue', {
                skill: t(`skill.${each}`),
                value: investigator.boostedSkills[each],
              })}
              data-skill={each}
              onClick={() => onPick(each)}
            >
              <data value={investigator.boostedSkills[each]}>
                {investigator.boostedSkills[each]}
              </data>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The result of a test in three columns (MD.2b), read left to right like the sum at the table:
 * the skill value and what was added to it, the tokens drawn in the order they came out (a
 * symbol token with its effect under it, and their sum when there are several), then the outcome
 * with the total against the difficulty and the margin. Before a token is out the draw button
 * (`onDraw`, left out when the bag is empty) stands where the tokens go and nothing stands in the
 * outcome's place; the draw takes every token the test reveals, so it is not offered again. A
 * token whose effect the app does not know shows a "?" and a reminder under the strip to add
 * it by hand.
 */
export function ResultStrip({
  result,
  revealed,
  skill,
  finished,
  onDraw,
}: {
  result: SkillTestSuggestion;
  revealed: readonly ChaosToken[];
  skill: SkillName;
  finished: boolean;
  onDraw?: () => void;
}) {
  const { t } = useTranslation();
  const terms = result.trace.filter(isSkillTerm);
  const effects = tokenEffects(result.trace, revealed);
  const known = effects.flatMap((effect) => effect ?? []);
  return (
    <section aria-label={t('skillTest.result')} data-part="strip">
      <ol aria-label={t('skillTest.calculation')}>
        {terms.map((step, index) => (
          <li key={index}>
            {termName(step, skill, t)}{' '}
            <data value={step.change}>{index === 0 ? step.change : signed(step.change)}</data>
          </li>
        ))}
        <li>
          <data value={sum(terms.map((step) => step.change))}>
            {sum(terms.map((step) => step.change))}
          </data>
        </li>
      </ol>
      <figure>
        {revealed.length > 0 && (
          <ol aria-label={t('skillTest.drawn')}>
            {revealed.map((token, index) => (
              <li key={index}>
                <span data-token={token}>{t(`chaosToken.${token}`)}</span>
                {hasSymbol(token) && token !== 'autoFail' && (
                  <>
                    {' '}
                    <data value={effects[index] ?? ''}>{signedOrUnknown(effects[index])}</data>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        {revealed.length === 0 && onDraw && (
          <button type="button" onClick={onDraw}>
            {t('skillTest.draw')}
          </button>
        )}
        {revealed.length > 1 && (
          <figcaption>
            {t('skillTest.tokenSum', {
              tokens: effects.map(signedOrUnknown).join(' '),
              total: signed(sum(known)),
            })}
          </figcaption>
        )}
      </figure>
      {revealed.length > 0 &&
        (finished ? (
          <output data-outcome={result.outcome}>
            <span>{t(`skillTest.outcome.${result.outcome}`)}</span>{' '}
            <span>
              {t(`skillTest.against.${result.outcome}`, {
                skill: result.skill,
                difficulty: result.difficulty,
              })}
            </span>{' '}
            <span>{t('skillTest.margin', { margin: result.margin })}</span>
          </output>
        ) : (
          <output>{t('skillTest.revealAnother')}</output>
        ))}
      {result.unknownTokens.map((unknown) => (
        <p key={unknown}>{t('skillTest.unknownToken', { token: t(`chaosToken.${unknown}`) })}</p>
      ))}
    </section>
  );
}

/** One number with − and + buttons, the − off at `min` and the + at `max` when it has them. */
export function Stepper({
  label,
  hint,
  value,
  shown,
  min,
  max,
  onChange,
}: {
  label: string;
  /** What the number stands for, under the label (the modifier's committed cards). */
  hint?: string;
  value: number;
  shown: string;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={label} data-part="stepper">
      <p>
        {label}
        {hint !== undefined && <span>{hint}</span>}
      </p>
      <button
        type="button"
        aria-label={t('skillTest.lower', { what: label })}
        disabled={min !== undefined && value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <data value={value}>{shown}</data>
      <button
        type="button"
        aria-label={t('skillTest.raise', { what: label })}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </section>
  );
}

/**
 * The steps that make the skill value before any token: the printed skill, a skill a card adds,
 * a lasting boost and the players' modifier. Tokens and the caps (auto-fail, nothing below 0)
 * show in the strip's other columns.
 */
function isSkillTerm(step: ModifierStep): step is SkillTerm {
  if (step.target !== 'skill') return false;
  switch (step.source.kind) {
    case 'baseSkill':
    case 'addedSkill':
    case 'skillBoost':
    case 'playerModifier':
      return true;
    case 'baseDifficulty':
    case 'chaosToken':
    case 'autoFail':
    case 'minimumZero':
      return false;
    default:
      return assertNever(step.source);
  }
}

/** A step that makes the skill value before any token (`isSkillTerm`). */
type SkillTerm = ModifierStep & {
  source: Extract<
    ModifierSource,
    { kind: 'baseSkill' | 'addedSkill' | 'skillBoost' | 'playerModifier' }
  >;
};

/** The name of one term of the skill value, as the players say it. */
function termName(
  step: SkillTerm,
  skill: SkillName,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const { source } = step;
  switch (source.kind) {
    case 'baseSkill':
      return t(`skill.${skill}`);
    case 'addedSkill':
      return t(`skill.${source.skill}`);
    case 'skillBoost':
      return t('skillTest.boost', { skill: t(`skill.${source.skill}`) });
    case 'playerModifier':
      return t('skillTest.modifier');
    default:
      return assertNever(source);
  }
}

/**
 * The effect of each token drawn, in the order drawn, read from the trace's token steps (which
 * keep that order); `undefined` for a token the engine cannot tell (the elder sign, a symbol
 * without a number) and for auto-fail, which is no modifier.
 */
function tokenEffects(
  trace: readonly ModifierStep[],
  revealed: readonly ChaosToken[],
): (number | undefined)[] {
  const steps = trace.filter((step) => step.source.kind === 'chaosToken');
  let next = 0;
  return revealed.map((token) => {
    const step = steps[next];
    if (step?.source.kind !== 'chaosToken' || step.source.token !== token) return undefined;
    next += 1;
    return step.change;
  });
}

/**
 * Whether the token shows a symbol rather than its number, so the strip spells out its effect:
 * the scenario's symbols, the elder sign, auto-fail and the tokens a campaign adds (bless, curse,
 * frost, blood).
 */
function hasSymbol(token: ChaosToken): boolean {
  return Number.isNaN(Number(token));
}

/** A token's effect with its sign, or "?" when the app cannot tell it (`tokenEffects`). */
function signedOrUnknown(effect: number | undefined): string {
  return effect === undefined ? '?' : signed(effect);
}

/** A modifier with its sign, as the players say it: +1, 0, −2. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${-value}` : '0';
}
