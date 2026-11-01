import { useTranslation } from 'react-i18next';
import {
  CHAOS_TOKENS,
  type CampaignLog,
  type CrossableEntry,
  type LogSheet,
  type StoryValue,
} from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { CampaignEntry } from '../scenarios/scenarioCatalog';

/**
 * The campaign notes, the campaign's own sheets in the order its `CampaignLogLayout` lists them,
 * then the killed and insane investigators and the chaos bag, which every campaign's log has. Every
 * campaign gets the same sheets for the same kinds; only the records and their words
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
      <FallenInvestigators log={log} />
      <ChaosBag log={log} />
    </>
  );
}

/**
 * The i18n key of the note a flag record writes when it is `value` (`CampaignEntry.storyKey`). A
 * flag has words for one side only when the guide records just that sentence, so the key may not
 * exist.
 */
export function flagNoteKey(storyKey: string, record: string, value: boolean): string {
  return `${storyKey}.${record}.${value ? 'yes' : 'no'}`;
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
    const key = flagNoteKey(storyKey, record, value.value);
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

/** The newspaper clipping: every investigator killed or driven insane, those replaced first. */
function FallenInvestigators({ log }: { readonly log: CampaignLog }) {
  const { t } = useTranslation();
  const fallen = [...log.formerInvestigators, ...log.investigators].filter(
    (member) => member.fate !== 'alive',
  );
  return (
    <section id="campaign-fallen" aria-labelledby="campaign-fallen-title">
      <h2 id="campaign-fallen-title">{t('campaignLog.fallen')}</h2>
      <ul>
        {fallen.map((member) => (
          <li key={member.code}>
            {t('campaignLog.fallenAs', {
              name: member.name,
              fate: t(`campaignLog.fate.${member.fate}`),
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The chaos bag's tokens as the players note them: each kind once, with how many it holds. */
function ChaosBag({ log }: { readonly log: CampaignLog }) {
  const { t } = useTranslation();
  const kinds = CHAOS_TOKENS.flatMap((token) => {
    const count = log.chaosBag.filter((inBag) => inBag === token).length;
    return count > 0 ? [{ token, count }] : [];
  });
  return (
    <section id="campaign-chaos-bag" aria-labelledby="campaign-chaos-bag-title">
      <h2 id="campaign-chaos-bag-title">{t('campaignLog.chaosBag')}</h2>
      <ul>
        {kinds.map(({ token, count }) => (
          <li key={token}>
            {t('campaignLog.tokenCount', { token: t(`chaosToken.${token}`), count })}
          </li>
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
function listedNames(value: StoryValue | undefined): readonly CrossableEntry[] {
  if (value?.kind === 'list') return value.entries.map((name) => ({ name, crossedOut: false }));
  if (value?.kind === 'crossableList') return value.entries;
  return [];
}
