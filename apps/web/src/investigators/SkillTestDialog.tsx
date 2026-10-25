import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SKILL_NAMES,
  type BoardView,
  type ChaosToken,
  type InvestigatorView,
  type ModifierStep,
  type SkillName,
  type SkillTestSuggestion,
} from '@arkham/engine';
import { assertNever } from '@arkham/util';
import { drawTokens, testFinished } from './drawTokens';

/** The difficulty a test starts at: the most common printed one ("Test [willpower] (3)"). */
const DEFAULT_DIFFICULTY = 3;

/**
 * A skill test the players take at the table outside any decision, such as one a player card
 * asks for: they pick the skill tested (the one tapped to open it, or another) and, for a card
 * that tests two skills together, a second one (`pickSkill`), set the difficulty and their
 * modifier (committed icons, cards in play), then let the app draw from the bag. The dialog shows
 * the calculation (`BoardView.skillTest`) and whether the test passes. It is a calculator: nothing
 * is played, so the game does not change. A native modal `<dialog>` brings focus trapping and
 * Escape; the × in its corner closes it, like Escape.
 */
export function SkillTestDialog({
  board,
  investigator,
  skill,
  onClose,
}: {
  board: BoardView;
  investigator: InvestigatorView;
  skill: SkillName;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const [skills, setSkills] = useState<readonly [SkillName, SkillName?]>([skill]);
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [modifier, setModifier] = useState(0);
  const [revealed, setRevealed] = useState<readonly ChaosToken[]>([]);
  const [tested, added] = skills;
  const result =
    revealed.length === 0
      ? undefined
      : board.skillTest(
          investigator.id,
          { skill: tested, difficulty },
          { modifier, tokens: revealed, ...(added === undefined ? {} : { addedSkill: added }) },
        );

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="skill-test">
      <header>
        <h2 id={titleId}>{t('skillTest.title', { name: investigator.name })}</h2>
        <button
          type="button"
          data-icon="close"
          aria-label={t('skillTest.close')}
          title={t('skillTest.close')}
          onClick={onClose}
        />
      </header>
      <section aria-label={t('investigators.skills')}>
        <ul>
          {SKILL_NAMES.map((each) => (
            <li key={each}>
              <button
                type="button"
                aria-pressed={skills.includes(each)}
                aria-label={t('investigators.skillValue', {
                  skill: t(`skill.${each}`),
                  value: investigator.skills[each],
                })}
                data-skill={each}
                onClick={() => setSkills(pickSkill(skills, each))}
              >
                <data value={investigator.skills[each]}>{investigator.skills[each]}</data>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Stepper
        label={t('skillTest.difficulty')}
        value={difficulty}
        shown={String(difficulty)}
        min={0}
        onChange={setDifficulty}
      />
      <Stepper
        label={t('skillTest.modifier')}
        value={modifier}
        shown={signed(modifier)}
        onChange={setModifier}
      />
      <button
        type="button"
        disabled={board.chaosBag.length === 0}
        // The engine draws nothing itself, so the draw happens here, at the edge.
        onClick={() => setRevealed(drawTokens(board.chaosBag, revealed, Math.random))}
      >
        {t('skillTest.draw')}
      </button>
      {revealed.length > 0 && <DrawnTokens tokens={revealed} />}
      {result && <TestResult result={result} skill={tested} finished={testFinished(revealed)} />}
    </dialog>
  );
}

/**
 * The skills tested after tapping `skill`: the tested one first, then the one a card adds to it.
 * Tapping another skill adds it as the second (or replaces the second); tapping a chosen one
 * drops it, unless it is the only one, since a test always has a skill.
 */
function pickSkill(
  skills: readonly [SkillName, SkillName?],
  skill: SkillName,
): readonly [SkillName, SkillName?] {
  const [tested, added] = skills;
  if (skill === tested) return added === undefined ? skills : [added];
  if (skill === added) return [tested];
  return [tested, skill];
}

/**
 * The tokens drawn so far, in the order they came out of the bag, each as its name: the styles
 * draw a symbol token as the game's symbol and keep its name for screen readers only.
 */
function DrawnTokens({ tokens }: { tokens: readonly ChaosToken[] }) {
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
function TestResult({
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
function Stepper({
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
function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${-value}` : '0';
}
