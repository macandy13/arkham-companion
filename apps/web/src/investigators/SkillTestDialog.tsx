import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type BoardView,
  type ChaosToken,
  type InvestigatorView,
  type SkillName,
} from '@arkham/engine';
import { drawTokens, testFinished } from './drawTokens';
import { DrawnTokens, signed, SkillToggles, Stepper, TestResult } from './TestCalculation';

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
      <SkillToggles
        investigator={investigator}
        chosen={added === undefined ? [tested] : [tested, added]}
        onPick={(each) => setSkills(pickSkill(skills, each))}
      />
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
