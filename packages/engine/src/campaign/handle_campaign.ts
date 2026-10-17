import { duplicates } from '@arkham/util';
import type { InvestigatorDb } from '../investigator_cards';
import type {
  CampaignCommand,
  RecordStory,
  RemoveChaosToken,
  StartCampaign,
} from './campaign_commands';
import type { CampaignEvent } from './campaign_events';
import { MAX_TEAM_SIZE, storyValueIsValid } from './campaign_invariants';
import { isCampaignStarted, type CampaignLog } from './campaign_log';
import { replayCampaign } from './campaign_reducer';
import { CampaignCommandRejected } from './campaign_rejection';
import {
  handleAddTrauma,
  handleAwardXp,
  handleMarkFate,
  handleReplaceInvestigator,
  handleSpendXp,
  newCampaignInvestigator,
} from './handle_campaign_investigator';
import { handleAdjustCampaign } from './handle_campaign_adjustment';

/**
 * The static data campaign commands are handled against, the campaign
 * counterpart of the game's `EngineContext`: commands name investigators by
 * code, and the handlers look up their printed stats here.
 */
export interface CampaignContext {
  readonly investigators: InvestigatorDb;
}

/**
 * Validates a campaign command against the log and returns the resulting
 * events; the campaign counterpart of the game's `handle`. Throws
 * `CampaignCommandRejected` for an invalid command. Pure: the same context, log
 * and command always yield the same events. Campaign commands trigger no
 * follow-ups, so unlike a game command one command is exactly its own events.
 */
export function handleCampaign(
  ctx: CampaignContext,
  log: CampaignLog,
  command: CampaignCommand,
): CampaignEvent[] {
  if (command.type === 'StartCampaign') return handleStartCampaign(ctx, log, command);
  if (!isCampaignStarted(log)) throw new CampaignCommandRejected({ code: 'campaignNotStarted' });
  switch (command.type) {
    case 'RecordStory':
      return handleRecordStory(log, command);
    case 'AddChaosToken':
      return [{ type: 'ChaosTokenAdded', token: command.token }];
    case 'RemoveChaosToken':
      return handleRemoveChaosToken(log, command);
    case 'AwardXp':
      return handleAwardXp(log, command);
    case 'SpendXp':
      return handleSpendXp(log, command);
    case 'AddTrauma':
      return handleAddTrauma(log, command);
    case 'MarkKilled':
      return handleMarkFate(log, command.code, 'killed');
    case 'MarkInsane':
      return handleMarkFate(log, command.code, 'insane');
    case 'ReplaceInvestigator':
      return handleReplaceInvestigator(ctx, log, command);
    case 'AdvanceScenario':
      return handleAdvanceScenario(log);
    case 'AdjustCampaign':
      return handleAdjustCampaign(log, command);
  }
}

/** Outcome of one campaign command: the events to persist and the log after them. */
export interface CampaignExecuteResult {
  log: CampaignLog;
  events: CampaignEvent[];
}

/**
 * Runs a campaign command end to end (`handleCampaign`, then the reducer),
 * like the game's `execute`. Throws `CampaignCommandRejected`.
 */
export function executeCampaign(
  ctx: CampaignContext,
  log: CampaignLog,
  command: CampaignCommand,
): CampaignExecuteResult {
  const events = handleCampaign(ctx, log, command);
  return { log: replayCampaign(events, log), events };
}

function handleStartCampaign(
  ctx: CampaignContext,
  log: CampaignLog,
  command: StartCampaign,
): CampaignEvent[] {
  if (isCampaignStarted(log)) throw new CampaignCommandRejected({ code: 'campaignAlreadyStarted' });
  const count = command.investigators.length;
  if (count < 1 || count > MAX_TEAM_SIZE)
    throw new CampaignCommandRejected({ code: 'invalidTeamSize', count });
  const [repeated] = duplicates(command.investigators);
  if (repeated !== undefined)
    throw new CampaignCommandRejected({
      code: 'duplicateInvestigator',
      investigatorCode: repeated,
    });
  if (command.scenarioIds.length === 0) throw new CampaignCommandRejected({ code: 'noScenarios' });
  return [
    {
      type: 'CampaignStarted',
      campaignId: command.campaignId,
      definitionId: command.definitionId,
      difficulty: command.difficulty,
      investigators: command.investigators.map((code) =>
        newCampaignInvestigator(ctx.investigators, code),
      ),
      chaosBag: command.chaosBag,
      scenarioIds: command.scenarioIds,
    },
  ];
}

function handleRecordStory(log: CampaignLog, command: RecordStory): CampaignEvent[] {
  const { key, value } = command;
  // A key with spaces around it would be a second record next to the trimmed one.
  if (key.trim() === '' || key !== key.trim())
    throw new CampaignCommandRejected({ code: 'invalidStoryKey', key });
  if (!storyValueIsValid(value))
    throw new CampaignCommandRejected({ code: 'invalidStoryValue', key });
  const recorded = log.story[key];
  if (recorded && recorded.kind !== value.kind)
    throw new CampaignCommandRejected({
      code: 'storyKindMismatch',
      key,
      recorded: recorded.kind,
      given: value.kind,
    });
  return [{ type: 'StoryRecorded', key, value }];
}

function handleRemoveChaosToken(log: CampaignLog, command: RemoveChaosToken): CampaignEvent[] {
  if (!log.chaosBag.includes(command.token))
    throw new CampaignCommandRejected({ code: 'chaosTokenNotInBag', token: command.token });
  return [{ type: 'ChaosTokenRemoved', token: command.token }];
}

function handleAdvanceScenario(log: CampaignLog): CampaignEvent[] {
  if (log.position >= log.scenarioIds.length)
    throw new CampaignCommandRejected({ code: 'campaignComplete' });
  return [{ type: 'ScenarioPositionChanged', position: log.position + 1 }];
}
