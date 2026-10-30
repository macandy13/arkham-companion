import { useTranslation } from 'react-i18next';
import type { CampaignLog, LogSheet, StoryValue } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { CampaignEntry } from '../scenarios/scenarioCatalog';

/**
 * The campaign notes and the campaign's own sheets, in the order its `CampaignLogLayout` lists
 * them. Every campaign gets the same sheets for the same kinds; only the records and their words
 * (`CampaignEntry.storyKey`) differ.
 */
export function CampaignSheets({
  log,
  entry,
}: {
  readonly log: CampaignLog;
  readonly entry: CampaignEntry;
}) {
  const { notes, sheets } = entry.definition.log;
  return (
    <>
      <CampaignNotes log={log} records={notes} storyKey={entry.storyKey} />
      {sheets.map((sheet) => (
        <Sheet key={sheet.record} sheet={sheet} log={log} storyKey={entry.storyKey} />
      ))}
    </>
  );
}

/** The notes the log holds in `records`, each in the players' words. */
function CampaignNotes({
  log,
  records,
  storyKey,
}: {
  readonly log: CampaignLog;
  readonly records: readonly string[];
  readonly storyKey: string;
}) {
  const { t, i18n } = useTranslation();
  const lines = records.flatMap((record) => {
    const value = log.story[record];
    if (value?.kind !== 'flag') return [];
    // A flag has words for one side only when the guide records just that sentence.
    const key = `${storyKey}.${record}.${value.value ? 'yes' : 'no'}`;
    return i18n.exists(key) ? [{ record, text: t(key) }] : [];
  });
  return (
    <section id="campaign-notes" aria-labelledby="campaign-notes-title">
      <h2 id="campaign-notes-title">{t('campaignLog.notes')}</h2>
      <ul>
        {lines.map(({ record, text }) => (
          <li key={record}>{text}</li>
        ))}
      </ul>
    </section>
  );
}

/** One of the campaign's own sheets, drawn by its kind. */
function Sheet({
  sheet,
  log,
  storyKey,
}: {
  readonly sheet: LogSheet;
  readonly log: CampaignLog;
  readonly storyKey: string;
}) {
  const { t } = useTranslation();
  const titleId = `campaign-sheet-${sheet.record}`;
  switch (sheet.kind) {
    case 'nameList':
      return (
        <section data-sheet={sheet.kind} aria-labelledby={titleId}>
          <h2 id={titleId}>{t(`${storyKey}.${sheet.record}`)}</h2>
          <ul>
            {listedNames(log.story[sheet.record]).map(({ name, crossedOut }) => (
              <li key={name}>{crossedOut ? <del>{name}</del> : name}</li>
            ))}
          </ul>
        </section>
      );
    default:
      return assertNever(sheet.kind);
  }
}

/** The names a list record holds, none for a record not written yet. */
function listedNames(value: StoryValue | undefined): { name: string; crossedOut: boolean }[] {
  if (value?.kind === 'list') return value.entries.map((name) => ({ name, crossedOut: false }));
  if (value?.kind === 'crossableList') return [...value.entries];
  return [];
}
