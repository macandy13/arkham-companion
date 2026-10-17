import { isNonNegativeInteger, isNonZeroInteger } from '@arkham/util';
import type { CampaignAdjustment, CampaignManualAdjust } from './campaign_commands';
import type { CampaignEvent } from './campaign_events';
import { checkCampaignInvariants } from './campaign_invariants';
import type { CampaignLog } from './campaign_log';
import { replayCampaign } from './campaign_reducer';
import { CampaignCommandRejected } from './campaign_rejection';
import { requireCampaignInvestigator } from './handle_campaign_investigator';

/**
 * `ManualAdjust`: turns a correction into the matching regular event, then
 * vets the result against `checkCampaignInvariants`. Checking the outcome
 * instead of listing every bad combination keeps corrections flexible
 * ("assistant, not referee") while the log can never become inconsistent.
 */
export function handleCampaignManualAdjust(
  log: CampaignLog,
  command: CampaignManualAdjust,
): CampaignEvent[] {
  const events = [adjustmentEvent(log, command.adjustment)];
  const violations = checkCampaignInvariants(replayCampaign(events, log));
  if (violations.length > 0)
    throw new CampaignCommandRejected({ code: 'inconsistentAdjustment', violations });
  return events;
}

function adjustmentEvent(log: CampaignLog, adjustment: CampaignAdjustment): CampaignEvent {
  switch (adjustment.kind) {
    case 'xp':
      requireDelta(adjustment.delta);
      requireCampaignInvestigator(log, adjustment.code);
      return {
        type: 'XpChanged',
        code: adjustment.code,
        account: adjustment.account,
        delta: adjustment.delta,
      };
    case 'trauma':
      requireDelta(adjustment.delta);
      requireCampaignInvestigator(log, adjustment.code);
      return {
        type: 'TraumaChanged',
        code: adjustment.code,
        kind: adjustment.trauma,
        delta: adjustment.delta,
      };
    case 'fate':
      return fateEvent(log, adjustment);
    case 'removeStory':
      if (!(adjustment.key in log.story))
        throw new CampaignCommandRejected({ code: 'unknownStoryRecord', key: adjustment.key });
      return { type: 'StoryRecordRemoved', key: adjustment.key };
    case 'position':
      return positionEvent(log, adjustment.position);
  }
}

function fateEvent(
  log: CampaignLog,
  adjustment: Extract<CampaignAdjustment, { kind: 'fate' }>,
): CampaignEvent {
  const { code, fate } = adjustment;
  if (requireCampaignInvestigator(log, code).fate === fate)
    throw new CampaignCommandRejected({ code: 'fateUnchanged', investigatorCode: code, fate });
  return { type: 'InvestigatorFateChanged', code, fate };
}

function positionEvent(log: CampaignLog, position: number): CampaignEvent {
  const max = log.scenarioIds.length;
  if (!isNonNegativeInteger(position) || position > max)
    throw new CampaignCommandRejected({ code: 'invalidPosition', position, max });
  return { type: 'ScenarioPositionChanged', position };
}

function requireDelta(delta: number): void {
  if (!isNonZeroInteger(delta)) throw new CampaignCommandRejected({ code: 'invalidDelta', delta });
}
