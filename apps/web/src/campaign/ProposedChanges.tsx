import { useTranslation } from 'react-i18next';
import { assertNever } from '@arkham/util';
import {
  campaign,
  type CampaignCommand,
  type CampaignLog,
  type InvestigatorCode,
  type ProposedChange,
  type StoryValue,
} from '@arkham/engine';
import { scenarioCardName } from '../scenarios/scenarioCatalog';
import { flagNoteKey } from './CampaignSheets';

/** Where a change goes on the log page, which is how the list is grouped. */
type ChangeGroup = 'notes' | 'investigators' | 'chaosBag' | 'atTheTable';

const GROUPS: readonly ChangeGroup[] = ['notes', 'investigators', 'chaosBag', 'atTheTable'];

/**
 * What a resolution or an interlude would write into the campaign log, grouped like the log page,
 * with the steps the players do at the table. A `choice` (a defeat by damage and horror at once,
 * a story card one of several investigators earns) asks the players to pick: `picks` holds the
 * option picked for each, by the change's index, the first until they pick (`confirmedCommands`).
 * `idPrefix` keeps the ids and radio names of two lists apart.
 */
export function ProposedChanges({
  changes,
  picks,
  onPick,
  describe,
  idPrefix,
}: {
  readonly changes: readonly ProposedChange[];
  readonly picks: ReadonlyMap<number, number>;
  readonly onPick: (index: number, option: number) => void;
  readonly describe: (command: CampaignCommand) => string;
  readonly idPrefix: string;
}) {
  const { t } = useTranslation();
  const indexed = changes.map((change, index) => ({ change, index }));
  return GROUPS.map((group) => {
    const inGroup = indexed.filter(({ change }) => groupOf(change) === group);
    if (group !== 'chaosBag' && inGroup.length === 0) return null;
    return (
      <section key={group} aria-labelledby={`${idPrefix}-${group}`}>
        <h3 id={`${idPrefix}-${group}`}>{t(`resolution.groups.${group}`)}</h3>
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
                        name={`${idPrefix}-choice-${index}`}
                        checked={(picks.get(index) ?? 0) === optionIndex}
                        onChange={() => onPick(index, optionIndex)}
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
  });
}

/** The commands `changes` confirm with `picks`: each command, and the picked option of each choice. */
export function confirmedCommands(
  changes: readonly ProposedChange[],
  picks: ReadonlyMap<number, number>,
): CampaignCommand[] {
  return changes.flatMap((change, index): CampaignCommand[] => {
    if (change.kind === 'command') return [change.command];
    if (change.kind !== 'choice') return [];
    const picked = picks.get(index) ?? 0;
    return change.options.slice(picked, picked + 1);
  });
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
    case 'CompleteInterlude':
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
    case 'MarkDevoured':
    case 'EarnCard':
    case 'ReplaceInvestigator':
    case 'LeaveCampaign':
    case 'JoinCampaign':
      return 'investigators';
    default:
      return assertNever(command);
  }
}

/**
 * A proposed campaign command in the players' words, with the names `log` gives its
 * investigators and the story words of the campaign (`CampaignEntry.storyKey`). A resolution
 * passes its game's copy of the log, an interlude the campaign's own.
 */
export function useDescribeCommand(
  log: CampaignLog | undefined,
  storyKey: string | undefined,
): (command: CampaignCommand) => string {
  const { t, i18n } = useTranslation();
  const nameOf = (code: InvestigatorCode): string =>
    (log && campaign.findInvestigator(log, code)?.name) ?? code;

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
      case 'MarkDevoured':
        return t('resolution.devoured', { name: nameOf(command.code) });
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
      case 'LeaveCampaign':
      case 'JoinCampaign':
      case 'AdvanceScenario':
      case 'CompleteInterlude':
      case 'AdjustCampaign':
        // Nothing proposes these; `applyResolution` and `applyInterlude` add their last step themselves.
        return t('resolution.otherChange');
      default:
        return assertNever(command);
    }
  };
}
