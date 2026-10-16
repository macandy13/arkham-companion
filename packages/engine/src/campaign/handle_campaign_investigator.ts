import { isPositiveInteger } from '@arkham/util';
import type {
  AddTrauma,
  AwardXp,
  JoiningInvestigator,
  ReplaceInvestigator,
  SpendXp,
} from './campaign_commands';
import type { CampaignEvent } from './campaign_events';
import {
  availableXp,
  campaignInvestigator,
  traumaFate,
  withTrauma,
  type CampaignInvestigator,
  type CampaignLog,
  type InvestigatorFate,
} from './campaign_log';
import { CampaignCommandRejected } from './campaign_rejection';

/** `AwardXp`: more earned XP for a living team member. */
export function handleAwardXp(log: CampaignLog, command: AwardXp): CampaignEvent[] {
  requireAmount(command.amount);
  requireAlive(log, command.code);
  return [{ type: 'XpChanged', code: command.code, account: 'earned', delta: command.amount }];
}

/** `SpendXp`: records spent XP, at most what the investigator has available. */
export function handleSpendXp(log: CampaignLog, command: SpendXp): CampaignEvent[] {
  requireAmount(command.amount);
  const investigator = requireAlive(log, command.code);
  const available = availableXp(investigator);
  if (command.amount > available)
    throw new CampaignCommandRejected({
      code: 'notEnoughXp',
      investigatorCode: command.code,
      available,
      requested: command.amount,
    });
  return [{ type: 'XpChanged', code: command.code, account: 'spent', delta: command.amount }];
}

/** `AddTrauma`: trauma for a living team member, who is killed or driven insane at the limit. */
export function handleAddTrauma(log: CampaignLog, command: AddTrauma): CampaignEvent[] {
  requireAmount(command.amount);
  const investigator = requireAlive(log, command.code);
  const traumaChanged: CampaignEvent = {
    type: 'TraumaChanged',
    code: command.code,
    kind: command.kind,
    delta: command.amount,
  };
  const fate = traumaFate(withTrauma(investigator, command.kind, command.amount), command.kind);
  return fate
    ? [traumaChanged, { type: 'InvestigatorFateChanged', code: command.code, fate }]
    : [traumaChanged];
}

/** `MarkKilled`/`MarkInsane`: a living team member meets `fate`. */
export function handleMarkFate(
  log: CampaignLog,
  code: string,
  fate: Exclude<InvestigatorFate, 'alive'>,
): CampaignEvent[] {
  requireAlive(log, code);
  return [{ type: 'InvestigatorFateChanged', code, fate }];
}

/** `ReplaceInvestigator`: a newcomer takes the seat of a killed or insane team member. */
export function handleReplaceInvestigator(
  log: CampaignLog,
  command: ReplaceInvestigator,
): CampaignEvent[] {
  const replaced = requireInvestigator(log, command.code);
  if (replaced.fate === 'alive')
    throw new CampaignCommandRejected({
      code: 'investigatorNotEliminated',
      investigatorCode: command.code,
    });
  // A campaign has one copy of each investigator, and a killed or insane one may not return.
  const everyone = [...log.investigators, ...log.formerInvestigators];
  if (everyone.some((inv) => inv.code === command.by.code))
    throw new CampaignCommandRejected({
      code: 'duplicateInvestigator',
      investigatorCode: command.by.code,
    });
  return [
    { type: 'InvestigatorReplaced', code: command.code, by: newCampaignInvestigator(command.by) },
  ];
}

/**
 * The log line of an investigator joining the campaign (at the start or as
 * a replacement): no trauma, no XP, alive. Rejects printed stats that are
 * not positive integers.
 */
export function newCampaignInvestigator(joining: JoiningInvestigator): CampaignInvestigator {
  const { code, health, sanity } = joining;
  if (!isPositiveInteger(health) || !isPositiveInteger(sanity))
    throw new CampaignCommandRejected({
      code: 'invalidInvestigatorStats',
      investigatorCode: code,
      health,
      sanity,
    });
  return {
    code,
    health,
    sanity,
    physicalTrauma: 0,
    mentalTrauma: 0,
    xpEarned: 0,
    xpSpent: 0,
    fate: 'alive',
  };
}

/** The current team member with `code`; rejects an unknown code. */
export function requireInvestigator(log: CampaignLog, code: string): CampaignInvestigator {
  const investigator = campaignInvestigator(log, code);
  if (!investigator)
    throw new CampaignCommandRejected({ code: 'unknownInvestigator', investigatorCode: code });
  return investigator;
}

/** The living team member with `code`; killed and insane investigators can no longer take part. */
function requireAlive(log: CampaignLog, code: string): CampaignInvestigator {
  const investigator = requireInvestigator(log, code);
  if (investigator.fate !== 'alive')
    throw new CampaignCommandRejected({
      code: 'investigatorEliminated',
      investigatorCode: code,
      fate: investigator.fate,
    });
  return investigator;
}

function requireAmount(amount: number): void {
  if (!isPositiveInteger(amount)) throw new CampaignCommandRejected({ code: 'invalidAmount', amount });
}
