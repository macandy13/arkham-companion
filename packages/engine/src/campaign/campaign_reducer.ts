import { withoutFirst, withoutKey } from '@arkham/util';
import type { CampaignEvent, CampaignStarted, InvestigatorReplaced } from './campaign_events';
import {
  emptyCampaignLog,
  withTrauma,
  type CampaignInvestigator,
  type CampaignLog,
} from './campaign_log';

/** Pure reducer of the campaign aggregate: applies one event and returns the next log. Never mutates `log`. */
export function applyCampaign(log: CampaignLog, event: CampaignEvent): CampaignLog {
  switch (event.type) {
    case 'CampaignStarted':
      return applyCampaignStarted(event);
    case 'StoryRecorded':
      return { ...log, story: { ...log.story, [event.key]: event.value } };
    case 'StoryRecordRemoved':
      return { ...log, story: withoutKey(log.story, event.key) };
    case 'ChaosTokenAdded':
      return { ...log, chaosBag: [...log.chaosBag, event.token] };
    case 'ChaosTokenRemoved':
      return { ...log, chaosBag: withoutFirst(log.chaosBag, event.token) };
    case 'XpChanged':
      return updateInvestigator(log, event.code, (inv) =>
        event.account === 'earned'
          ? { ...inv, xpEarned: inv.xpEarned + event.delta }
          : { ...inv, xpSpent: inv.xpSpent + event.delta },
      );
    case 'TraumaChanged':
      return updateInvestigator(log, event.code, (inv) =>
        withTrauma(inv, event.kind, event.delta),
      );
    case 'InvestigatorFateChanged':
      return updateInvestigator(log, event.code, (inv) => ({ ...inv, fate: event.fate }));
    case 'InvestigatorReplaced':
      return applyInvestigatorReplaced(log, event);
    case 'ScenarioPositionChanged':
      return { ...log, position: event.position };
  }
}

/** Applies events in order, starting from `log` (default: the empty log). */
export function replayCampaign(
  events: readonly CampaignEvent[],
  log: CampaignLog = emptyCampaignLog(),
): CampaignLog {
  return events.reduce(applyCampaign, log);
}

function applyCampaignStarted(event: CampaignStarted): CampaignLog {
  return {
    ...emptyCampaignLog(),
    campaignId: event.campaignId,
    definitionId: event.definitionId,
    difficulty: event.difficulty,
    investigators: event.investigators,
    chaosBag: event.chaosBag,
    scenarioIds: event.scenarioIds,
  };
}

function applyInvestigatorReplaced(log: CampaignLog, event: InvestigatorReplaced): CampaignLog {
  const replaced = log.investigators.filter((inv) => inv.code === event.code);
  return {
    ...log,
    investigators: log.investigators.map((inv) => (inv.code === event.code ? event.by : inv)),
    formerInvestigators: [...log.formerInvestigators, ...replaced],
  };
}

function updateInvestigator(
  log: CampaignLog,
  code: string,
  update: (investigator: CampaignInvestigator) => CampaignInvestigator,
): CampaignLog {
  return {
    ...log,
    investigators: log.investigators.map((inv) => (inv.code === code ? update(inv) : inv)),
  };
}
