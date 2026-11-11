import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolutionId } from '@arkham/engine';
import { resolutionNumber } from '../scenarios/scenarioCatalog';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Ends the scenario by hand (MC2.19), from the play screen's menu: the scenario's `resolutions`
 * (`BoardView.resolutions`) as radios, the first one picked, for an ending the engine leaves to
 * the players. `onEnd` plays the picked one (`GameActions.endScenario`); the resolution dialog
 * then opens over the ended game as after any other ending, where the players can still pick
 * "No resolution".
 */
export function EndScenarioDialog({
  resolutions,
  onEnd,
  onCancel,
}: {
  readonly resolutions: readonly ResolutionId[];
  readonly onEnd: (resolution: ResolutionId) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(resolutions[0]);
  return (
    <ConfirmDialog
      title={t('header.endScenarioTitle')}
      confirmLabel={t('header.endScenarioConfirm')}
      onConfirm={() => {
        if (picked !== undefined) onEnd(picked);
      }}
      onCancel={onCancel}
    >
      <p>{t('header.endScenarioText')}</p>
      <fieldset>
        <legend>{t('header.endScenarioPick')}</legend>
        {resolutions.map((resolution) => (
          <label key={resolution}>
            <input
              type="radio"
              name="end-scenario-resolution"
              checked={resolution === picked}
              onChange={() => setPicked(resolution)}
            />
            {t('resolution.numbered', { n: resolutionNumber(resolution) })}
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  );
}
