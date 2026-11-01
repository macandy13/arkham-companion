import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assertNever } from '@arkham/util';
import {
  campaign,
  type CampaignCommand,
  type GameState,
  type InvestigatorCode,
  type ProposedChange,
  type ScenarioOutcome,
  type StoryValue,
} from '@arkham/engine';
import type { PendingResolution } from '../state/appStore';
import {
  findCampaignOfScenario,
  findScenario,
  resolutionNumber,
  scenarioCardName,
} from '../scenarios/scenarioCatalog';
import { flagNoteKey } from './CampaignSheets';
import './resolution.css';

/** Where a change goes on the log page, which is how the dialog groups the list. */
type ChangeGroup = 'notes' | 'investigators' | 'chaosBag' | 'atTheTable';

const GROUPS: readonly ChangeGroup[] = ['notes', 'investigators', 'chaosBag', 'atTheTable'];

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
  const describe = useDescribeCommand(game);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const changes =
    resolution.options.find((option) => sameOutcome(option.outcome, outcome))?.changes ?? [];
  const confirmed = changes.flatMap((change, index): CampaignCommand[] => {
    if (change.kind === 'command') return [change.command];
    if (change.kind !== 'choice') return [];
    const picked = picks.get(index) ?? 0;
    return change.options.slice(picked, picked + 1);
  });
  const scenario = findScenario(game.meta.scenarioId);
  const kicker = [
    ...(scenario ? [t(scenario.nameKey)] : []),
    ...(step === 'pick' ? [] : [outcomeName(t, outcome)]),
  ].join(' · ');
  const inCampaign = resolution.campaignId !== undefined;
  const indexed = changes.map((change, index) => ({ change, index }));

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
                  checked={sameOutcome(option.outcome, outcome)}
                  onChange={() => {
                    setOutcome(option.outcome);
                    setPicks(new Map());
                  }}
                />
                {outcomeName(t, option.outcome)}
                {sameOutcome(option.outcome, resolution.reached) && (
                  <>
                    {' '}
                    <em>{t('resolution.fromTheGame')}</em>
                  </>
                )}
              </label>
            ))}
          </fieldset>
        )}
        {step === 'changes' &&
          GROUPS.map((group) => {
            const inGroup = indexed.filter(({ change }) => groupOf(change) === group);
            if (group !== 'chaosBag' && inGroup.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`resolution-${group}`}>
                <h3 id={`resolution-${group}`}>{t(`resolution.groups.${group}`)}</h3>
                <ul>
                  {inGroup.length === 0 && <li>{t('resolution.noChange')}</li>}
                  {inGroup.map(({ change, index }) => (
                    <li key={index}>
                      {change.kind === 'byHand' && t(change.textKey)}
                      {change.kind === 'command' && describe(change.command)}
                      {change.kind === 'choice' && (
                        <fieldset>
                          <legend>{t('resolution.pickOne')}</legend>
                          {change.options.map((option, optionIndex) => (
                            <label key={optionIndex}>
                              <input
                                type="radio"
                                name={`resolution-choice-${index}`}
                                checked={(picks.get(index) ?? 0) === optionIndex}
                                onChange={() => setPicks(new Map(picks).set(index, optionIndex))}
                              />
                              {describe(option)}
                            </label>
                          ))}
                        </fieldset>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
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

function sameOutcome(a: ScenarioOutcome, b: ScenarioOutcome): boolean {
  return outcomeKey(a) === outcomeKey(b);
}

/** A key that tells outcomes apart: the resolution id, or `none`. */
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

function groupOf(change: ProposedChange): ChangeGroup {
  switch (change.kind) {
    case 'byHand':
      return 'atTheTable';
    case 'choice':
      return 'investigators';
    case 'command':
      return commandGroup(change.command);
    default:
      return assertNever(change);
  }
}

function commandGroup(command: CampaignCommand): ChangeGroup {
  switch (command.type) {
    case 'RecordStory':
    case 'EndCampaign':
    case 'StartCampaign':
    case 'AdvanceScenario':
    case 'AdjustCampaign':
      return 'notes';
    case 'AddChaosToken':
    case 'RemoveChaosToken':
      return 'chaosBag';
    case 'AwardXp':
    case 'SpendXp':
    case 'AddTrauma':
    case 'MarkKilled':
    case 'MarkInsane':
    case 'EarnCard':
    case 'ReplaceInvestigator':
      return 'investigators';
    default:
      return assertNever(command);
  }
}

/**
 * A resolution's campaign command in the players' words, with the names the game's copy of the
 * campaign log gives its investigators and the story words of the campaign that plays the game's
 * scenario (`CampaignEntry.storyKey`).
 */
function useDescribeCommand(game: GameState): (command: CampaignCommand) => string {
  const { t, i18n } = useTranslation();
  const storyKey = findCampaignOfScenario(game.meta.scenarioId)?.storyKey;
  const nameOf = (code: InvestigatorCode): string =>
    (game.campaign && campaign.findInvestigator(game.campaign, code)?.name) ?? code;

  const story = (key: string, value: StoryValue): string => {
    const record = `${storyKey}.${key}`;
    switch (value.kind) {
      case 'flag': {
        const words = flagNoteKey(`${storyKey}`, key, value.value);
        // The log page shows no note for this side of the flag, so neither does the dialog.
        return i18n.exists(words) ? t(words) : t('resolution.unwrittenRecord');
      }
      case 'list':
        return t('resolution.list', { heading: t(record), names: value.entries.join(', ') });
      case 'crossableList':
        return t('resolution.list', {
          heading: t(record),
          names: value.entries.map((entry) => entry.name).join(', '),
        });
      case 'count':
        return t('resolution.count', { heading: t(record), count: value.value });
      default:
        return assertNever(value);
    }
  };

  return (command) => {
    switch (command.type) {
      case 'RecordStory':
        return story(command.key, command.value);
      case 'AwardXp':
        return t('resolution.xp', { name: nameOf(command.code), count: command.amount });
      case 'AddTrauma':
        return t(`resolution.trauma.${command.kind}`, {
          name: nameOf(command.code),
          count: command.amount,
        });
      case 'MarkKilled':
        return t('resolution.killed', { name: nameOf(command.code) });
      case 'MarkInsane':
        return t('resolution.insane', { name: nameOf(command.code) });
      case 'EarnCard':
        return t('resolution.earnCard', {
          name: nameOf(command.code),
          card: scenarioCardName(command.card),
        });
      case 'AddChaosToken':
        return t('resolution.addToken', { token: t(`chaosToken.${command.token}`) });
      case 'RemoveChaosToken':
        return t('resolution.removeToken', { token: t(`chaosToken.${command.token}`) });
      case 'EndCampaign':
        return t(`resolution.campaignEnds.${command.result}`);
      case 'StartCampaign':
      case 'SpendXp':
      case 'ReplaceInvestigator':
      case 'AdvanceScenario':
      case 'AdjustCampaign':
        // A resolution proposes none of these; `applyResolution` adds `AdvanceScenario` itself.
        return t('resolution.otherChange');
      default:
        return assertNever(command);
    }
  };
}
