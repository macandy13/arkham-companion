import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assertNever } from '@arkham/util';
import type {
  CampaignCommand,
  GameState,
  InvestigatorCode,
  ProposedChange,
  StoryValue,
} from '@arkham/engine';
import { campaignCatalog, findScenario, scenarioCardName } from '../scenarios/scenarioCatalog';
import './resolution.css';

/** Where a change goes on the log page, which is how the dialog groups the list. */
type ChangeGroup = 'notes' | 'investigators' | 'chaosBag' | 'atTheTable';

const GROUPS: readonly ChangeGroup[] = ['notes', 'investigators', 'chaosBag', 'atTheTable'];

/**
 * "Into the campaign log" (MC1.6c, design: docs/product.md "Campaign screen"): what the ended
 * `game`'s resolution writes into its campaign log (`PendingResolution.changes`), grouped like the
 * log page, with the steps the players do at the table. A defeat by damage and horror at once, or
 * a story card one of several investigators earns, asks the players to pick; the first option is
 * picked until they do. The app shows no guide text, so the dialog names the part to read aloud.
 * Submitting hands the confirmed commands to `onWrite`; "Not yet" leaves the game as it is.
 * `failed` says the last write was refused, so the log is unchanged.
 */
export function ResolutionDialog({
  game,
  changes,
  busy,
  failed,
  onWrite,
  onLater,
}: {
  readonly game: GameState;
  readonly changes: readonly ProposedChange[];
  readonly busy: boolean;
  readonly failed: boolean;
  readonly onWrite: (confirmed: readonly CampaignCommand[]) => void;
  readonly onLater: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  // The option each choice has picked, by the choice's place in `changes`.
  const [picks, setPicks] = useState<ReadonlyMap<number, number>>(new Map());
  const describe = useDescribeCommand(game);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const confirmed = changes.flatMap((change, index): CampaignCommand[] => {
    if (change.kind === 'command') return [change.command];
    if (change.kind !== 'choice') return [];
    const picked = picks.get(index) ?? 0;
    return change.options.slice(picked, picked + 1);
  });
  const scenario = findScenario(game.meta.scenarioId);
  const resolutionNumber = game.meta.resolution && numberOf(game.meta.resolution);
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
        <p>
          {scenario && `${t(scenario.nameKey)} · `}
          {resolutionNumber === undefined
            ? t('resolution.none')
            : t('resolution.numbered', { n: resolutionNumber })}
        </p>
        <h2 id="resolution-title">{t('resolution.title')}</h2>
      </hgroup>
      <p>
        {resolutionNumber === undefined
          ? t('resolution.readNone')
          : t('resolution.read', { n: resolutionNumber })}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onWrite(confirmed);
        }}
      >
        {GROUPS.map((group) => {
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
          <button type="button" onClick={onLater}>
            {t('resolution.later')}
          </button>
          <button type="submit" disabled={busy}>
            {t('resolution.write')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

/** The number a resolution id carries ("R2" → "2"), which the guide titles it with. */
function numberOf(resolution: string): string {
  return /\d+$/.exec(resolution)?.[0] ?? resolution;
}

function groupOf(change: ProposedChange): ChangeGroup {
  if (change.kind === 'byHand') return 'atTheTable';
  if (change.kind === 'choice') return 'investigators';
  switch (change.command.type) {
    case 'RecordStory':
    case 'EndCampaign':
      return 'notes';
    case 'AddChaosToken':
    case 'RemoveChaosToken':
      return 'chaosBag';
    default:
      return 'investigators';
  }
}

/**
 * A resolution's campaign command in the players' words, with the names the game's copy of the
 * campaign log gives its investigators and the story words of the campaign that plays the game's
 * scenario (`CampaignEntry.storyKey`).
 */
function useDescribeCommand(game: GameState): (command: CampaignCommand) => string {
  const { t, i18n } = useTranslation();
  const storyKey = campaignCatalog.find((entry) =>
    entry.definition.scenarios.includes(game.meta.scenarioId),
  )?.storyKey;
  const nameOf = (code: InvestigatorCode): string =>
    game.campaign?.investigators.find((member) => member.code === code)?.name ?? code;

  const story = (key: string, value: StoryValue): string => {
    const record = `${storyKey}.${key}`;
    switch (value.kind) {
      case 'flag': {
        const words = `${record}.${value.value ? 'yes' : 'no'}`;
        return i18n.exists(words) ? t(words) : t('resolution.record', { record: key });
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
      default:
        // A resolution proposes none of the other commands (start, spending XP, corrections).
        return command.type;
    }
  };
}
