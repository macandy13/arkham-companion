import type { InvestigatorCode } from '../ids';
import { withoutFirst, withoutKey } from '@arkham/util';
import type { CampaignEvent, CampaignStarted, InvestigatorReplaced } from './campaign_events';
import {
  createEmptyLog,
  addTrauma,
  type CampaignInvestigator,
  type CampaignLog,
} from './campaign_log';

/** Pure reducer of the campaign aggregate: applies one event and returns the next log. Never mutates `log`. */
export function applyEvent(log: CampaignLog, event: CampaignEvent): CampaignLog {
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
      return updateInvestigator(log, event.code, (investigator) =>
        event.account === 'earned'
          ? { ...investigator, xpEarned: investigator.xpEarned + event.delta }
          : { ...investigator, xpSpent: investigator.xpSpent + event.delta },
      );
    case 'TraumaChanged':
      return updateInvestigator(log, event.code, (investigator) =>
        addTrauma(investigator, event.kind, event.delta),
      );
    case 'InvestigatorFateChanged':
      return updateInvestigator(log, event.code, (investigator) => ({
        ...investigator,
        fate: event.fate,
      }));
    case 'InvestigatorReplaced':
      return applyInvestigatorReplaced(log, event);
    case 'ScenarioPositionChanged':
      return { ...log, position: event.position };
  }
}

/** Applies events in order, starting from `log` (default: the empty log). */
export function replayEvents(
  events: readonly CampaignEvent[],
  log: CampaignLog = createEmptyLog(),
): CampaignLog {
  return events.reduce(applyEvent, log);
}

function applyCampaignStarted(event: CampaignStarted): CampaignLog {
  return {
    ...createEmptyLog(),
    campaignId: event.campaignId,
    definitionId: event.definitionId,
    difficulty: event.difficulty,
    investigators: event.investigators,
    chaosBag: event.chaosBag,
    scenarioIds: event.scenarioIds,
  };
}

function applyInvestigatorReplaced(log: CampaignLog, event: InvestigatorReplaced): CampaignLog {
  const replaced = log.investigators.filter((investigator) => investigator.code === event.code);
  return {
    ...log,
    investigators: log.investigators.map((investigator) =>
      investigator.code === event.code ? event.by : investigator,
    ),
    formerInvestigators: [...log.formerInvestigators, ...replaced],
  };
}

function updateInvestigator(
  log: CampaignLog,
  code: InvestigatorCode,
  update: (investigator: CampaignInvestigator) => CampaignInvestigator,
): CampaignLog {
  return {
    ...log,
    investigators: log.investigators.map((investigator) =>
      investigator.code === code ? update(investigator) : investigator,
    ),
  };
}
