import { RELIANCES, type Difficulty } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { TargetCovers } from './TargetCovers';
import { DIFFICULTIES, type WizardChoices } from './wizardState';

interface SetupStepProps {
  readonly choices: WizardChoices;
  /** The packs the players own, to offer only their campaigns and scenarios. */
  readonly ownedPacks?: ReadonlySet<string>;
  readonly onChange: (changes: Partial<WizardChoices>) => void;
}

/**
 * First wizard step: which campaign (or, in a quick game, which scenario) as covers with art
 * (`TargetCovers`), the difficulty and how much the players rely on the helpers.
 */
export function SetupStep({ choices, ownedPacks, onChange }: SetupStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <TargetCovers choices={choices} ownedPacks={ownedPacks} onChange={onChange} />
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
      <fieldset>
        <legend>{t('reliance.title')}</legend>
        {RELIANCES.map((reliance) => (
          <label key={reliance}>
            <input
              type="radio"
              name="reliance"
              checked={choices.reliance === reliance}
              onChange={() => onChange({ reliance })}
            />
            {t(`reliance.levels.${reliance}`)}
          </label>
        ))}
      </fieldset>
    </>
  );
}
