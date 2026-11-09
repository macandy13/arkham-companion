import type { ScenarioId } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import { useId } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { campaignKeyArt } from '../catalog/campaignKeyArt';
import { findCampaignOfScenario } from '../scenarios/scenarioCatalog';
import { CoverArt } from '../screens/CoverArt';
import { offeredTargets, type WizardChoices, type WizardTarget } from './wizardState';

interface TargetCoversProps {
  readonly choices: WizardChoices;
  /** The packs the players own (Settings); without any, every campaign and scenario is offered. */
  readonly ownedPacks?: ReadonlySet<string>;
  readonly onChange: (changes: Partial<WizardChoices>) => void;
}

/**
 * The campaigns, or in a quick game the scenarios, the players can start (MD.3f): one cover each
 * (`TargetCover`). Each cover is a radio of one group, so the choice reads and works like any other
 * on the step.
 */
export function TargetCovers({ choices, ownedPacks, onChange }: TargetCoversProps) {
  const { t } = useTranslation();
  const targets = offeredTargets(choices.mode, ownedPacks);
  return (
    <fieldset data-covers>
      <legend>{t(choices.mode === 'campaign' ? 'wizard.campaign' : 'wizard.scenario')}</legend>
      {/* The owned packs can leave nothing to offer; the collection is where to change that. */}
      {targets.length === 0 && (
        <p>
          <Trans
            i18nKey="wizard.noneOwned"
            components={{ collection: <Link to="/settings/collection" /> }}
          />
        </p>
      )}
      {targets.map((target) => (
        <TargetCover
          key={target.entry.id}
          target={target}
          checked={choices.targetId === target.entry.id}
          onCheck={() => onChange({ targetId: target.entry.id })}
        />
      ))}
    </fieldset>
  );
}

/**
 * One cover: the art of the home shelf (`CoverArt`: a campaign's box key art over its first
 * scenario's agenda, a scenario's first agenda), a kicker naming the scenario's campaign or the
 * campaign's length, and the name. The radio is named by the name alone and described by the
 * kicker, so it reads "The Gathering" first.
 */
function TargetCover({
  target,
  checked,
  onCheck,
}: {
  target: WizardTarget;
  checked: boolean;
  onCheck: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  let scenario: ScenarioId | undefined;
  let keyArt: string | undefined;
  let kicker: string;
  switch (target.kind) {
    case 'campaign': {
      const scenarios = target.entry.definition.scenarios;
      scenario = scenarios[0];
      keyArt = campaignKeyArt(target.entry.definition.id);
      kicker = t('wizard.scenarioCount', { count: scenarios.length });
      break;
    }
    case 'scenario': {
      scenario = target.entry.definition.id;
      const campaign = findCampaignOfScenario(scenario);
      kicker = campaign ? t(campaign.nameKey) : t('wizard.standalone');
      break;
    }
    default:
      assertNever(target);
  }
  return (
    <label>
      <input
        type="radio"
        name="target"
        checked={checked}
        onChange={onCheck}
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-kicker`}
      />
      <CoverArt scenarioId={scenario} keyArt={keyArt} />
      <small id={`${id}-kicker`}>{kicker}</small>
      <span id={`${id}-name`}>{t(target.entry.nameKey)}</span>
    </label>
  );
}
