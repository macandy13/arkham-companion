import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardView,
  ChaosToken,
  InvestigatorView,
  ModifierStep,
  SkillName,
  SkillTestSuggestion,
} from '@arkham/engine';
import { assertNever, unique } from '@arkham/util';
import { drawTokens, revealToken, testFinished } from './drawTokens';

/** The difficulty a test starts at: the most common printed one ("Test [willpower] (3)"). */
const DEFAULT_DIFFICULTY = 3;

/**
 * A skill test the players take at the table outside any decision, such as one a player card
 * asks for, against the investigator's `skill`: they set the difficulty and their modifier
 * (committed icons, cards in play), then pick the chaos tokens they drew or let the app draw
 * from the bag (`TokenPicker`). The dialog shows the calculation (`BoardView.skillTest`) and whether the test
 * passes. It is a calculator: nothing is played, so the game does not change. A native modal
 * `<dialog>` brings focus trapping and Escape.
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
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [modifier, setModifier] = useState(0);
  const [revealed, setRevealed] = useState<readonly ChaosToken[]>([]);
  const result =
    revealed.length === 0
      ? undefined
      : board.skillTest(investigator.id, { skill, difficulty }, { modifier, tokens: revealed });

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="skill-test">
      <h2 id={titleId}>
        {t('skillTest.title', { skill: t(`skill.${skill}`), name: investigator.name })}
      </h2>
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
      <TokenPicker
        bag={board.chaosBag}
        revealed={revealed}
        onReveal={(token) => setRevealed(revealToken(revealed, token))}
        // The engine draws nothing itself, so the draw happens here, at the edge.
        onDraw={() => setRevealed(drawTokens(board.chaosBag, revealed, Math.random))}
      />
      {result && <TestResult result={result} skill={skill} finished={testFinished(revealed)} />}
      <footer>
        <button type="button" onClick={onClose}>
          {t('skillTest.close')}
        </button>
      </footer>
    </dialog>
  );
}

/**
 * The bag's tokens, each kind once, to pick the one drawn at the table, pressed while revealed,
 * and "Draw a token" to let the app draw from the bag instead. A token that makes the tester
 * reveal another (`revealToken`) keeps the test open for the next pick or draw.
 */
function TokenPicker({
  bag,
  revealed,
  onReveal,
  onDraw,
}: {
  bag: readonly ChaosToken[];
  revealed: readonly ChaosToken[];
  onReveal: (token: ChaosToken) => void;
  onDraw: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('skillTest.token')}>
      <p>{t('skillTest.token')}</p>
      <ul>
        {unique(bag).map((token) => (
          <li key={token}>
            <button
              type="button"
              aria-pressed={revealed.includes(token)}
              data-token={token}
              onClick={() => onReveal(token)}
            >
              {t(`chaosToken.${token}`)}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={bag.length === 0} onClick={onDraw}>
        {t('skillTest.draw')}
      </button>
    </section>
  );
}

/**
 * The calculation step by step, the tokens whose effect the app does not know, and the outcome
 * once the test is `finished`; until then, a reminder to reveal another token.
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
