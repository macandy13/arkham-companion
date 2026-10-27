import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardView,
  ChaosToken,
  DecisionCounts,
  DecisionView,
  InvestigatorId,
  SkillName,
  SkillTest,
  SkillTestSuggestion,
} from '@arkham/engine';
import { assertNever } from '@arkham/util';
import { ResolvingCard } from '../encounter/ResolvingCard';
import { drawTokens, testFinished } from '../investigators/drawTokens';
import {
  DrawnTokens,
  signed,
  SkillToggles,
  Stepper,
  TestResult,
} from '../investigators/TestCalculation';
import type { DecisionAmounts, GameActions } from '../state/gameActions';

/**
 * The first open decision (`BoardView.decisions[0]`) as a modal over the board: the encounter
 * card being resolved, if its revelation asked (`ResolvingCard`), the question in the players'
 * words with the card it is about, the investigator who answers it, the test of a skill test, and
 * one button per option, answered through `GameActions.answer` with the default
 * counts. A skill test one investigator takes also brings the chaos bag draw of the skill test
 * dialog: the players keep the test's skill or switch to another (a card can test a different
 * one), set their modifier and let the app draw, and the calculation
 * (`BoardView.skillTest`) marks the option it suggests, which then answers with its margin; the
 * other option overrides it without one. The screen mounts one dialog per decision, so a draw
 * never carries over to the next; adjusting the board, which unmounts it, starts the draw over.
 * The game cannot go on before it is answered, so Escape does not close it; Undo takes back
 * the step that raised it instead, and "Adjust board" lets the players correct the board first
 * (the dialog steps aside while they adjust, since the modal makes the board inert). The engine's labels are i18n keys or names already readable
 * (investigators, locations); a key the strings lack shows as the option's readable name.
 */
export function DecisionDialog({
  board,
  decision,
  actions,
  busy,
}: {
  board: BoardView;
  decision: DecisionView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const { test } = decision;
  const tested = decision.kind === 'skillTestResult' ? decision.for : undefined;
  const draw = useChaosDraw(board, tested, test);
  const suggested = draw.result && testFinished(draw.revealed) ? draw.result : undefined;
  const [counts, setCounts] = useState(() => defaultCounts(decision.counts));
  const answer = (option: string) =>
    void actions.answer(option, {
      ...countsOf(counts[option]),
      ...(option === suggested?.outcome ? { margin: suggested.margin } : {}),
    });

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => event.preventDefault()}
      data-dialog="decision"
    >
      {board.resolving && <ResolvingCard board={board} card={board.resolving} />}
      <h2 id={titleId}>
        {t(decision.prompt, { card: decision.about, defaultValue: decision.prompt })}
      </h2>
      {decision.for !== undefined && (
        <p>{t('decision.decides', { name: board.investigator(decision.for).name })}</p>
      )}
      {test && (
        <p>
          {t('decision.test', { skill: t(`skill.${test.skill}`), difficulty: test.difficulty })}
        </p>
      )}
      {draw.skill && tested !== undefined && (
        <TestDraw board={board} tested={tested} skill={draw.skill} draw={draw} />
      )}
      <ul>
        {/* Two options can share a name (two enemies of one card), so the position is the key. */}
        {decision.options.map((option, index) => (
          <li key={index}>
            <button
              type="button"
              disabled={busy}
              data-suggested={option === suggested?.outcome || undefined}
              onClick={() => answer(option)}
            >
              {t(decision.labels?.[option] ?? option, { defaultValue: option })}
            </button>
            <CountSteppers
              decision={decision}
              option={option}
              counts={counts}
              onChange={setCounts}
            />
          </li>
        ))}
      </ul>
      <footer>
        <button type="button" disabled={busy} onClick={() => void actions.startAdjusting()}>
          {t('header.adjust')}
        </button>
        <button type="button" disabled={busy} onClick={() => void actions.undo()}>
          {t('header.undo')}
        </button>
      </footer>
    </dialog>
  );
}

/**
 * The skill tested (the decision's own until the players switch), their modifier and the tokens
 * drawn for a decision's skill test, and what they make.
 */
interface ChaosDraw {
  /** None only for a decision that is not a skill test. */
  skill?: SkillName;
  setSkill: (skill: SkillName) => void;
  modifier: number;
  setModifier: (modifier: number) => void;
  revealed: readonly ChaosToken[];
  setRevealed: (revealed: readonly ChaosToken[]) => void;
  /** The calculation once a token is drawn (`BoardView.skillTest`); none for other decisions. */
  result?: SkillTestSuggestion;
}

/** The draw for the test `tested` takes, kept in the dialog so its answer can use the result. */
function useChaosDraw(
  board: BoardView,
  tested: InvestigatorId | undefined,
  test: SkillTest | undefined,
): ChaosDraw {
  const [switched, setSkill] = useState<SkillName>();
  const skill = switched ?? test?.skill;
  const [modifier, setModifier] = useState(0);
  const [revealed, setRevealed] = useState<readonly ChaosToken[]>([]);
  const result =
    test && skill && tested !== undefined && revealed.length > 0
      ? board.skillTest(tested, { ...test, skill }, { modifier, tokens: revealed })
      : undefined;
  return {
    ...(skill ? { skill } : {}),
    setSkill,
    modifier,
    setModifier,
    revealed,
    setRevealed,
    ...(result ? { result } : {}),
  };
}

/**
 * The skill toggles (`skill` pressed), the modifier, the draw button, the tokens drawn and the
 * calculation of the test `tested` takes for a decision.
 */
function TestDraw({
  board,
  tested,
  skill,
  draw,
}: {
  board: BoardView;
  tested: InvestigatorId;
  skill: SkillName;
  draw: ChaosDraw;
}) {
  const { t } = useTranslation();
  const { setSkill, modifier, setModifier, revealed, setRevealed, result } = draw;
  return (
    <>
      <SkillToggles investigator={board.investigator(tested)} chosen={[skill]} onPick={setSkill} />
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
      {result && <TestResult result={result} skill={skill} finished={testFinished(revealed)} />}
    </>
  );
}

/** The counts an option can carry, in the order the dialog shows their steppers. */
const COUNT_NAMES = ['amount', 'damage', 'horror'] as const;

/** One of `COUNT_NAMES`. */
type CountName = (typeof COUNT_NAMES)[number];

/** The counts the players set, by option name, each starting at the engine's default. */
type Counts = Record<string, Partial<Record<CountName, number>>>;

function defaultCounts(ranges: Record<string, DecisionCounts> = {}): Counts {
  return Object.fromEntries(
    Object.entries(ranges).map(([option, counts]) => [
      option,
      Object.fromEntries(
        COUNT_NAMES.flatMap((name) => {
          const range = counts[name];
          return range ? [[name, range.default]] : [];
        }),
      ),
    ]),
  );
}

/** An option's counts as the answer carries them: `amount`, and damage and horror as `amounts`. */
function countsOf(counts: Counts[string] = {}): DecisionAmounts {
  const { amount, damage, horror } = counts;
  const named = {
    ...(damage === undefined ? {} : { damage }),
    ...(horror === undefined ? {} : { horror }),
  };
  return {
    ...(amount === undefined ? {} : { amount }),
    ...(Object.keys(named).length > 0 ? { amounts: named } : {}),
  };
}

/** A stepper per count of `option`, within the count's limits, next to the option's button. */
function CountSteppers({
  decision,
  option,
  counts,
  onChange,
}: {
  decision: DecisionView;
  option: string;
  counts: Counts;
  onChange: (counts: Counts) => void;
}) {
  const { t } = useTranslation();
  const ranges = decision.counts?.[option] ?? {};
  return COUNT_NAMES.flatMap((name) => {
    const range = ranges[name];
    const value = counts[option]?.[name];
    if (!range || value === undefined) return [];
    return [
      <Stepper
        key={name}
        label={t(countLabel(name, decision.action))}
        value={value}
        shown={String(value)}
        min={range.min}
        {...(range.max === undefined ? {} : { max: range.max })}
        onChange={(changed) =>
          onChange({ ...counts, [option]: { ...counts[option], [name]: changed } })
        }
      />,
    ];
  });
}

/**
 * The i18n key naming a count: a skill test's `amount` by the action it belongs to (clues an
 * investigation discovers, damage a fight deals), a plain count otherwise.
 */
function countLabel(name: CountName, action: DecisionView['action']): string {
  if (name !== 'amount') return `decision.count.${name}`;
  switch (action) {
    case 'investigate':
      return 'decision.count.clues';
    case 'fight':
      return 'decision.count.dealt';
    case 'evade':
    case undefined:
      return 'decision.count.amount';
    default:
      return assertNever(action);
  }
}
