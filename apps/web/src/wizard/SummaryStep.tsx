import type { InvestigatorCard } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { chosenScenario, type WizardChoices } from './wizardState';

interface SummaryStepProps {
  readonly choices: WizardChoices;
  /** The chosen investigator cards in seat order. */
  readonly investigators: readonly InvestigatorCard[];
}

/** Last wizard step: what will be started, so the players can check it before confirming. */
export function SummaryStep({ choices, investigators }: SummaryStepProps) {
  const { t } = useTranslation();
  const scenario = chosenScenario(choices);

  return (
    <dl aria-label={t('wizard.steps.summary')}>
      <dt>{t(choices.mode === 'campaign' ? 'wizard.campaign' : 'wizard.scenario')}</dt>
      <dd>{scenario && t(scenario.nameKey)}</dd>
      <dt>{t('wizard.difficulty')}</dt>
      <dd>{t(`wizard.difficulties.${choices.difficulty}`)}</dd>
      <dt>{t('investigators.title')}</dt>
      <dd>
        <ol>
          {investigators.map((investigator) => (
            <li key={investigator.code}>
              {t('wizard.investigatorLine', {
                name: investigator.name,
                health: investigator.health,
                sanity: investigator.sanity,
              })}
            </li>
          ))}
        </ol>
      </dd>
    </dl>
  );
}
