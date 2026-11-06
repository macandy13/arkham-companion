import { assertNever } from '@arkham/util';
import type { InterludeId, ScenarioId } from '../ids';
import type { CampaignEvent } from './campaign_events';
import { sameOutcome, type ScenarioOutcome } from './campaign_log';

/**
 * Why a campaign log entry was written (M1C.2), the campaign's counterpart of the game's
 * `ChangeCause`: the players by hand (an adjustment, a replacement, ending a campaign with nobody
 * left), the resolution of a scenario (`applyResolution`), with the defeats' trauma that comes
 * with it, or an interlude (`applyInterlude`). `executeCommand` returns one per event, beside the
 * events.
 */
export type CampaignChangeCause =
  | { readonly kind: 'player' }
  | {
      readonly kind: 'resolution';
      readonly scenarioId: ScenarioId;
      readonly outcome: ScenarioOutcome;
    }
  | { readonly kind: 'interlude'; readonly interludeId: InterludeId };

/** The cause of what the players write into the log themselves. */
export const CAMPAIGN_PLAYER_CAUSE: CampaignChangeCause = { kind: 'player' };

/**
 * What part of the campaign log a notice is about, so the screens can filter or group them:
 * the chaos bag, experience, trauma, an investigator's fate (killed, insane), the story the log
 * records, cards earned, the team, and the scenario order.
 */
export type CampaignNoticeKind =
  'chaosBag' | 'xp' | 'trauma' | 'fate' | 'story' | 'cards' | 'team' | 'scenario';

/**
 * Entries the app wrote into the campaign log by itself (M1C.2): consecutive events of one kind
 * with the same cause, never the players' own. The game's counterpart is `ChangeNotice`.
 */
export interface CampaignNotice {
  readonly kind: CampaignNoticeKind;
  readonly cause: Exclude<CampaignChangeCause, { kind: 'player' }>;
  readonly events: readonly CampaignEvent[];
}

/** Campaign events and why each was written, at the same index (`CampaignExecuteResult`). */
export interface CausedCampaignEvents {
  readonly events: readonly CampaignEvent[];
  readonly causes: readonly CampaignChangeCause[];
}

/**
 * The entries among `events` the players didn't write themselves, as notices: grouped while kind
 * and cause stay the same. One resolution's or interlude's causes are all alike, so its entries
 * group by kind.
 */
export function campaignNotices({ events, causes }: CausedCampaignEvents): CampaignNotice[] {
  const notices: CampaignNotice[] = [];
  events.forEach((event, index) => {
    const cause = causes[index];
    const kind = campaignNoticeKindOf(event);
    if (cause === undefined || cause.kind === 'player' || kind === undefined) return;
    const last = notices.at(-1);
    if (last && last.kind === kind && sameCause(last.cause, cause)) {
      notices[notices.length - 1] = { ...last, events: [...last.events, event] };
    } else {
      notices.push({ kind, cause, events: [event] });
    }
  });
  return notices;
}

function sameCause(a: CampaignNotice['cause'], b: CampaignNotice['cause']): boolean {
  switch (a.kind) {
    case 'interlude':
      return b.kind === 'interlude' && a.interludeId === b.interludeId;
    case 'resolution':
      return (
        b.kind === 'resolution' &&
        a.scenarioId === b.scenarioId &&
        sameOutcome(a.outcome, b.outcome)
      );
    default:
      return assertNever(a);
  }
}

/**
 * The kind of notice `event` belongs to, or `undefined` for the start of a campaign, which
 * replaces the whole log and is no change to tell.
 */
export function campaignNoticeKindOf(event: CampaignEvent): CampaignNoticeKind | undefined {
  switch (event.type) {
    case 'ChaosTokenAdded':
    case 'ChaosTokenRemoved':
      return 'chaosBag';
    case 'XpChanged':
      return 'xp';
    case 'TraumaChanged':
      return 'trauma';
    case 'InvestigatorFateChanged':
      return 'fate';
    case 'StoryRecorded':
    case 'StoryRecordRemoved':
      return 'story';
    case 'CardEarned':
      return 'cards';
    case 'InvestigatorReplaced':
      return 'team';
    case 'ScenarioPlayed':
    case 'ScenarioPositionChanged':
    case 'InterludePlayed':
    case 'CampaignEnded':
      return 'scenario';
    case 'CampaignStarted':
      return undefined;
    default:
      return assertNever(event);
  }
}
