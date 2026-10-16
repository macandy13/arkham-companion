import type { Difficulty } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { campaignCatalog, scenarioCatalog } from '../scenarios/scenarioCatalog';
import { DIFFICULTIES, type WizardChoices } from './wizardState';

interface SetupStepProps {
  readonly choices: WizardChoices;
  readonly onChange: (changes: Partial<WizardChoices>) => void;
}

/** First wizard step: which campaign (or, in a quick game, which scenario) and the difficulty. */
export function SetupStep({ choices, onChange }: SetupStepProps) {
  const { t } = useTranslation();
  const isCampaign = choices.mode === 'campaign';
  const targets = isCampaign ? campaignCatalog : scenarioCatalog;

  return (
    <>
      <fieldset>
        <legend>{t(isCampaign ? 'wizard.campaign' : 'wizard.scenario')}</legend>
        {targets.map((target) => (
          <label key={target.id}>
            <input
              type="radio"
              name="target"
              checked={choices.targetId === target.id}
              onChange={() => onChange({ targetId: target.id })}
            />
            {t(target.nameKey)}
          </label>
        ))}
      </fieldset>
      <fieldset>
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
    </>
  );
}
