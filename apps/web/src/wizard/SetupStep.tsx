import type { Difficulty } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { DIFFICULTIES, type WizardChoices } from './wizardState';

interface SetupStepProps {
  readonly choices: WizardChoices;
  readonly onChange: (changes: Partial<WizardChoices>) => void;
}

/**
 * Second wizard step, after the scenario or campaign (`TargetCovers`): the difficulty. How much
 * the players rely on the helpers is a setting (`Settings.reliance`), not part of the setup.
 */
export function SetupStep({ choices, onChange }: SetupStepProps) {
  const { t } = useTranslation();

  return (
    <fieldset data-segmented>
      <legend>{t('wizard.difficulty')}</legend>
      {DIFFICULTIES.map((difficulty: Difficulty) => (
        <label key={difficulty}>
          <input
            type="radio"
            name="difficulty"
            checked={choices.difficulty === difficulty}
            onChange={() => onChange({ difficulty })}
          />
          {t(`wizard.difficulties.${difficulty}`)}
        </label>
      ))}
    </fieldset>
  );
}
