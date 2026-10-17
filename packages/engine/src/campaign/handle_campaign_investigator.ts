import { isPositiveInteger } from '@arkham/util';
import type { InvestigatorCode } from '../ids';
import type { InvestigatorDb } from '../investigator_cards';
import type { AddTrauma, AwardXp, ReplaceInvestigator, SpendXp } from './campaign_commands';
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
  code: InvestigatorCode,
  fate: Exclude<InvestigatorFate, 'alive'>,
): CampaignEvent[] {
  requireAlive(log, code);
  return [{ type: 'InvestigatorFateChanged', code, fate }];
}

/** `ReplaceInvestigator`: a newcomer takes the seat of a killed or insane team member. */
export function handleReplaceInvestigator(
  investigators: InvestigatorDb,
  log: CampaignLog,
  command: ReplaceInvestigator,
): CampaignEvent[] {
  const replaced = requireCampaignInvestigator(log, command.code);
  if (replaced.fate === 'alive')
    throw new CampaignCommandRejected({
      code: 'investigatorNotEliminated',
      investigatorCode: command.code,
    });
  // A campaign has one copy of each investigator, and a killed or insane one may not return.
  const everyone = [...log.investigators, ...log.formerInvestigators];
  if (everyone.some((inv) => inv.code === command.by))
    throw new CampaignCommandRejected({
      code: 'duplicateInvestigator',
      investigatorCode: command.by,
    });
  return [
    {
      type: 'InvestigatorReplaced',
      code: command.code,
      by: newCampaignInvestigator(investigators, command.by),
    },
  ];
}

/**
 * The campaign log entry of an investigator joining the campaign (at the start or as
 * a replacement), from their card: no trauma, no XP, alive. Rejects a code
 * missing from `investigators` and printed stats that are not positive integers.
 */
export function newCampaignInvestigator(
  investigators: InvestigatorDb,
  code: InvestigatorCode,
): CampaignInvestigator {
  const card = investigators.get(code);
  if (!card)
    throw new CampaignCommandRejected({ code: 'unknownInvestigatorCard', investigatorCode: code });
  const { name, health, sanity } = card;
  if (!isPositiveInteger(health) || !isPositiveInteger(sanity))
    throw new CampaignCommandRejected({
      code: 'invalidInvestigatorStats',
      investigatorCode: code,
      health,
      sanity,
    });
  return {
    code,
    name,
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
export function requireCampaignInvestigator(
  log: CampaignLog,
  code: InvestigatorCode,
): CampaignInvestigator {
  const investigator = campaignInvestigator(log, code);
  if (!investigator)
    throw new CampaignCommandRejected({ code: 'unknownInvestigator', investigatorCode: code });
  return investigator;
}

/** The living team member with `code`; killed and insane investigators can no longer take part. */
function requireAlive(log: CampaignLog, code: InvestigatorCode): CampaignInvestigator {
  const investigator = requireCampaignInvestigator(log, code);
  if (investigator.fate !== 'alive')
    throw new CampaignCommandRejected({
      code: 'investigatorEliminated',
      investigatorCode: code,
      fate: investigator.fate,
    });
  return investigator;
}

function requireAmount(amount: number): void {
  if (!isPositiveInteger(amount))
    throw new CampaignCommandRejected({ code: 'invalidAmount', amount });
}
