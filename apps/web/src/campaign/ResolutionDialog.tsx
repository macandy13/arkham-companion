import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  campaign,
  type CampaignCommand,
  type GameState,
  type ScenarioOutcome,
} from '@arkham/engine';
import type { PendingResolution } from '../state/appStore';
import {
  findCampaignOfScenario,
  findScenario,
  resolutionNumber,
} from '../scenarios/scenarioCatalog';
import { ProposedChanges, confirmedCommands, useDescribeCommand } from './ProposedChanges';
import './campaign_dialogs.css';

/**
 * The end of a scenario in two steps (MC1.6c, design: docs/product.md "Campaign screen"). First
 * "The scenario is over": the scenario's resolutions, the one the game reached tagged "from the
 * game", for the players to confirm or to pick another if the table played the ending differently.
 * Then "Into the campaign log": what that resolution writes, grouped like the log page, with the
 * steps the players do at the table. A defeat by damage and horror at once, or a story card one of
 * several investigators earns, asks the players to pick; the first option is picked until they do.
 * The app shows no guide text, so both steps name the part to read aloud. Writing hands the
 * resolution and the confirmed commands to `onWrite`; "Not yet" leaves the game as it is. Without
 * a campaign (`PendingResolution.campaignId`) the second step only lists the steps and closes.
 * `failed` says the last write was refused, so the log is unchanged.
 */
export function ResolutionDialog({
  game,
  resolution,
  busy,
  failed,
  onWrite,
  onLater,
}: {
  readonly game: GameState;
  readonly resolution: PendingResolution;
  readonly busy: boolean;
  readonly failed: boolean;
  readonly onWrite: (outcome: ScenarioOutcome, confirmed: readonly CampaignCommand[]) => void;
  readonly onLater: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<'pick' | 'changes'>('pick');
  const [outcome, setOutcome] = useState(resolution.reached);
  // The option each choice has picked, by the choice's place in the chosen resolution's changes.
  const [picks, setPicks] = useState<ReadonlyMap<number, number>>(new Map());
  const describe = useDescribeCommand(
    game.campaign,
    findCampaignOfScenario(game.meta.scenarioId)?.storyKey,
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const changes =
    resolution.options.find((option) => campaign.sameOutcome(option.outcome, outcome))?.changes ??
    [];
  const confirmed = confirmedCommands(changes, picks);
  const scenario = findScenario(game.meta.scenarioId);
  const kicker = [
    ...(scenario ? [t(scenario.nameKey)] : []),
    ...(step === 'pick' ? [] : [outcomeName(t, outcome)]),
  ].join(' · ');
  const inCampaign = resolution.campaignId !== undefined;

  return (
    <dialog
      ref={dialog}
      id="resolution"
      aria-labelledby="resolution-title"
      onCancel={(event) => {
        // Escape is "Not yet", which the parent decides on, not the browser.
        event.preventDefault();
        onLater();
      }}
    >
      <hgroup>
        <p>{kicker}</p>
        <h2 id="resolution-title">
          {step === 'pick'
            ? t('resolution.over')
            : t(inCampaign ? 'resolution.title' : 'resolution.standaloneTitle')}
        </h2>
      </hgroup>
      <p>{readAloud(t, outcome)}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 'pick') setStep('changes');
          else if (inCampaign) onWrite(outcome, confirmed);
          else onLater();
        }}
      >
        {step === 'pick' && (
          <fieldset>
            <legend>{t('resolution.pickResolution')}</legend>
            {resolution.options.map((option) => (
              <label key={outcomeKey(option.outcome)}>
                <input
                  type="radio"
                  name="resolution-outcome"
                  checked={campaign.sameOutcome(option.outcome, outcome)}
                  onChange={() => {
                    setOutcome(option.outcome);
                    setPicks(new Map());
                  }}
                />
                {outcomeName(t, option.outcome)}
                {campaign.sameOutcome(option.outcome, resolution.reached) && (
                  <>
                    {/* A space, so the radio's name reads "No resolution from the game". */}{' '}
                    <em>{t('decision.fromTheGame')}</em>
                  </>
                )}
              </label>
            ))}
          </fieldset>
        )}
        {step === 'changes' && (
          <ProposedChanges
            changes={changes}
            picks={picks}
            onPick={(index, option) => setPicks(new Map(picks).set(index, option))}
            describe={describe}
            idPrefix="resolution"
          />
        )}
        {failed && <p role="alert">{t('resolution.failed')}</p>}
        <footer>
          {step === 'pick' ? (
            <button type="button" onClick={onLater}>
              {t('resolution.later')}
            </button>
          ) : (
            <button type="button" onClick={() => setStep('pick')}>
              {t('resolution.back')}
            </button>
          )}
          <button type="submit" disabled={busy}>
            {step === 'pick'
              ? t('resolution.next')
              : t(inCampaign ? 'resolution.write' : 'resolution.done')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** A key that tells outcomes apart in a list: the resolution id, or `none`. */
function outcomeKey(outcome: ScenarioOutcome): string {
  return outcome.kind === 'noResolution' ? 'none' : outcome.id;
}

/** "Resolution 2" or "No resolution", as the guide titles them. */
function outcomeName(t: Translate, outcome: ScenarioOutcome): string {
  return outcome.kind === 'noResolution'
    ? t('resolution.none')
    : t('resolution.numbered', { n: resolutionNumber(outcome.id) });
}

/** Which part of the campaign guide the players read aloud for `outcome`. */
function readAloud(t: Translate, outcome: ScenarioOutcome): string {
  return outcome.kind === 'noResolution'
    ? t('resolution.readNone')
    : t('resolution.read', { n: resolutionNumber(outcome.id) });
}
