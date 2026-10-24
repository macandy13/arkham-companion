import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardView,
  ChaosToken,
  InvestigatorView,
  ModifierStep,
  SkillName,
} from '@arkham/engine';
import { unique } from '@arkham/util';

/** The difficulty a test starts at: the most common printed one ("Test [willpower] (3)"). */
const DEFAULT_DIFFICULTY = 3;

/**
 * A skill test the players take at the table outside any decision, such as one a player card
 * asks for, against the investigator's `skill`: they set the difficulty and their modifier
 * (committed icons, cards in play), then pick the chaos token they drew or let the app draw one
 * from the bag. The dialog shows the calculation (`BoardView.skillTest`) and whether the test
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
  const [token, setToken] = useState<ChaosToken>();
  const bag = board.chaosBag;
  const result =
    token === undefined
      ? undefined
      : board.skillTest(investigator.id, { skill, difficulty }, { modifier, tokens: [token] });

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
      <section aria-label={t('skillTest.token')}>
        <p>{t('skillTest.token')}</p>
        <ul>
          {unique(bag).map((each) => (
            <li key={each}>
              <button
                type="button"
                aria-pressed={each === token}
                data-token={each}
                onClick={() => setToken(each)}
              >
                {t(`chaosToken.${each}`)}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={bag.length === 0}
          // The engine draws nothing itself, so the draw happens here, at the edge.
          onClick={() => setToken(bag[Math.floor(Math.random() * bag.length)])}
        >
          {t('skillTest.draw')}
        </button>
      </section>
      {result && (
        <section aria-label={t('skillTest.result')}>
          <ol>
            {result.trace.map((step, index) => (
              <li key={index}>{stepLine(step, skill, t)}</li>
            ))}
          </ol>
          {result.unknownTokens.map((unknown) => (
            <p key={unknown}>
              {t('skillTest.unknownToken', { token: t(`chaosToken.${unknown}`) })}
            </p>
          ))}
          <output data-outcome={result.outcome}>
            {t(`skillTest.${result.outcome}`, {
              skill: result.skill,
              difficulty: result.difficulty,
              margin: result.margin,
            })}
          </output>
        </section>
      )}
      <footer>
        <button type="button" onClick={onClose}>
          {t('skillTest.close')}
        </button>
      </footer>
    </dialog>
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
    default:
      return t(`skillTest.step.${source.kind}`, values);
  }
}

/** A modifier with its sign, as the players say it: +1, 0, −2. */
function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${-value}` : '0';
}
