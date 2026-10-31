import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, InvestigatorView, SkillName } from '@arkham/engine';
import { CardDialog } from '../screens/CardDialog';
import { SkillTestBlock, useSkillTest } from './TestCalculation';

/** The difficulty a test starts at: the most common printed one ("Test [willpower] (3)"). */
const DEFAULT_DIFFICULTY = 3;

/**
 * A skill test the players take at the table outside any decision, such as one a player card
 * asks for, on the card dialog shell with the investigator's round portrait over the page
 * (MD.2b). The test block (`SkillTestBlock`) lets them pick the skill tested (the one tapped to
 * open it, or another) and a second one a card adds, set the difficulty and their modifier, then
 * let the app draw; the result strip shows the calculation (`BoardView.skillTest`) and whether the
 * test passes. It is a calculator: nothing is played, so the game does not change and it has no
 * footer. Escape and the × close it.
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
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const run = useSkillTest(board, investigator.id, { skill, difficulty });

  return (
    <CardDialog
      name="skill-test"
      actor={investigator}
      kicker={investigator.name}
      title={t('skillTest.title')}
      onCancel={onClose}
      onClose={onClose}
    >
      {run && (
        <SkillTestBlock
          board={board}
          investigator={investigator}
          run={run}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
        />
      )}
    </CardDialog>
  );
}
