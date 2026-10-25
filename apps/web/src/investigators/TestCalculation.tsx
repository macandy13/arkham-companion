import { useTranslation } from 'react-i18next';
import {
  SKILL_NAMES,
  type ChaosToken,
  type InvestigatorView,
  type ModifierStep,
  type SkillName,
  type SkillTestSuggestion,
} from '@arkham/engine';
import { assertNever } from '@arkham/util';
import './test_calculation.css';

/**
 * The investigator's four skills as toggles, each with its value, the `chosen` ones pressed;
 * `onPick` gets the one tapped, and the dialog decides what that changes.
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
    <section aria-label={t('investigators.skills')}>
      <ul>
        {SKILL_NAMES.map((each) => (
          <li key={each}>
            <button
              type="button"
              aria-pressed={chosen.includes(each)}
              aria-label={t('investigators.skillValue', {
                skill: t(`skill.${each}`),
                value: investigator.skills[each],
              })}
              data-skill={each}
              onClick={() => onPick(each)}
            >
              <data value={investigator.skills[each]}>{investigator.skills[each]}</data>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The tokens drawn so far, in the order they came out of the bag, each as its name: the styles
 * draw a symbol token as the game's symbol and keep its name for screen readers only.
 */
export function DrawnTokens({ tokens }: { tokens: readonly ChaosToken[] }) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t('skillTest.drawn')}>
      {tokens.map((token, index) => (
        <li key={index} data-token={token}>
          {t(`chaosToken.${token}`)}
        </li>
      ))}
    </ol>
  );
}

/**
 * The calculation step by step (`skill` names the tested one), the tokens whose effect the app does not know, and the outcome
 * once the test is `finished`; until then (the bag ran out after a token that reveals another),
 * a reminder to reveal another token.
 */
export function TestResult({
  result,
  skill,
  finished,
}: {
  result: SkillTestSuggestion;
  skill: SkillName;
  finished: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('skillTest.result')}>
      <ol>
        {result.trace.map((step, index) => (
          <li key={index}>{stepLine(step, skill, t)}</li>
        ))}
      </ol>
      {result.unknownTokens.map((unknown) => (
        <p key={unknown}>{t('skillTest.unknownToken', { token: t(`chaosToken.${unknown}`) })}</p>
      ))}
      {finished ? (
        <output data-outcome={result.outcome}>
          {t(`skillTest.${result.outcome}`, {
            skill: result.skill,
            difficulty: result.difficulty,
            margin: result.margin,
          })}
        </output>
      ) : (
        <output>{t('skillTest.revealAnother')}</output>
      )}
    </section>
  );
}

/** One number of the test with − and + buttons, the − off at `min` when it has one. */
export function Stepper({
  label,
  value,
  shown,
  min,
  onChange,
}: {
  label: string;
  value: number;
  shown: string;
  min?: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={label}>
      <p>{label}</p>
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
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </section>
  );
}

/** One line of the calculation: what changed the skill or the difficulty, and the total after it. */
function stepLine(
  step: ModifierStep,
  skill: SkillName,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const { source, change, total } = step;
  const values = { change: signed(change), total };
  switch (source.kind) {
    case 'baseSkill':
      return t('skillTest.step.baseSkill', { skill: t(`skill.${skill}`), total });
    case 'addedSkill':
      return t('skillTest.step.addedSkill', { ...values, skill: t(`skill.${source.skill}`) });
    case 'chaosToken':
      return t('skillTest.step.chaosToken', {
        ...values,
        token: t(`chaosToken.${source.token}`),
      });
    case 'baseDifficulty':
    case 'playerModifier':
    case 'autoFail':
    case 'minimumZero':
      return t(`skillTest.step.${source.kind}`, values);
    default:
      return assertNever(source);
  }
}

/** A modifier with its sign, as the players say it: +1, 0, −2. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${-value}` : '0';
}
