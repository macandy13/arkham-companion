import { duplicates } from '@arkham/util';
import type { CardDb } from '../cards';
import type {
  AdvanceScenario,
  CampaignCommand,
  RecordStory,
  RemoveChaosToken,
  StartCampaign,
} from './campaign_commands';
import type { CampaignEvent } from './campaign_events';
import { MAX_TEAM_SIZE, isValidStoryValue } from './campaign_invariants';
import { findCurrentScenarioId, isStarted, type CampaignLog } from './campaign_log';
import { replayEvents } from './campaign_reducer';
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
  readonly cards: CardDb;
}

/**
 * Validates a campaign command against the log and returns the resulting
 * events; the campaign counterpart of the game's `handle`. Throws
 * `CampaignCommandRejected` for an invalid command. Pure: the same context, log
 * and command always yield the same events. Campaign commands trigger no
 * follow-ups, so unlike a game command one command is exactly its own events.
 */
export function handleCommand(
  ctx: CampaignContext,
  log: CampaignLog,
  command: CampaignCommand,
): CampaignEvent[] {
  if (command.type === 'StartCampaign') return handleStartCampaign(ctx, log, command);
  if (!isStarted(log)) throw new CampaignCommandRejected({ code: 'campaignNotStarted' });
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
      return handleAdvanceScenario(log, command);
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
 * Runs a campaign command end to end (`handleCommand`, then the reducer),
 * like the game's `execute`. Throws `CampaignCommandRejected`.
 */
export function executeCommand(
  ctx: CampaignContext,
  log: CampaignLog,
  command: CampaignCommand,
): CampaignExecuteResult {
  const events = handleCommand(ctx, log, command);
  return { log: replayEvents(events, log), events };
}

function handleStartCampaign(
  ctx: CampaignContext,
  log: CampaignLog,
  command: StartCampaign,
): CampaignEvent[] {
  if (isStarted(log)) throw new CampaignCommandRejected({ code: 'campaignAlreadyStarted' });
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
      investigators: command.investigators.map((code) => newCampaignInvestigator(ctx.cards, code)),
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
  if (!isValidStoryValue(value))
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

function handleAdvanceScenario(log: CampaignLog, command: AdvanceScenario): CampaignEvent[] {
  const scenarioId = findCurrentScenarioId(log);
  if (scenarioId === undefined) throw new CampaignCommandRejected({ code: 'campaignComplete' });
  return [
    { type: 'ScenarioPlayed', scenarioId, outcome: command.outcome },
    { type: 'ScenarioPositionChanged', position: log.position + 1 },
  ];
}
