import { duplicates, isPositiveInteger } from '@arkham/util';
import {
  isCampaignStarted,
  traumaFate,
  type CampaignInvestigator,
  type CampaignLog,
  type StoryValue,
} from './campaign_log';

/** Most investigators a campaign team can have (Rules Reference: 1–4 players). */
export const MAX_TEAM_SIZE = 4;

/**
 * Returns a list of invariant violations of a campaign log (empty = the log
 * is consistent): a started campaign has a team of 1–`MAX_TEAM_SIZE`, no
 * investigator code appears twice (current or former), every investigator
 * is consistent (`investigatorErrors`), every former investigator is killed
 * or insane, every story value is well-formed and the scenario position lies
 * within the scenario list. `handleCampaign` also uses it to vet
 * `ManualAdjust` corrections.
 */
export function checkCampaignInvariants(log: CampaignLog): string[] {
  const everyone = [...log.investigators, ...log.formerInvestigators];
  return [
    ...teamErrors(log),
    ...duplicates(everyone.map((inv) => inv.code)).map(
      (code) => `investigator ${code} appears more than once`,
    ),
    ...everyone.flatMap(investigatorErrors),
    ...log.formerInvestigators
      .filter((inv) => inv.fate === 'alive')
      .map((inv) => `former investigator ${inv.code} is alive`),
    ...Object.entries(log.story).flatMap(([key, value]) =>
      storyValueIsValid(value) ? [] : [`story record ${key} is malformed`],
    ),
    ...positionErrors(log),
  ];
}

/**
 * Whether a story value is well-formed: a count is a non-negative integer
 * and a list names each entry once, none of them blank. Shared by the
 * invariants and `RecordStory` validation.
 */
export function storyValueIsValid(value: StoryValue): boolean {
  switch (value.kind) {
    case 'flag':
      return true;
    case 'count':
      return Number.isInteger(value.value) && value.value >= 0;
    case 'list':
      return namesAreValid(value.entries);
    case 'crossableList':
      return namesAreValid(value.entries.map((entry) => entry.name));
  }
}

function namesAreValid(names: readonly string[]): boolean {
  return duplicates(names).length === 0 && names.every((name) => name.trim() !== '');
}

function teamErrors(log: CampaignLog): string[] {
  if (!isCampaignStarted(log)) return [];
  const size = log.investigators.length;
  return size >= 1 && size <= MAX_TEAM_SIZE ? [] : [`team has ${size} investigators`];
}

/**
 * Violations for one investigator: counters are non-negative integers, at
 * most the earned XP is spent, health and sanity are positive, and trauma at
 * the limit means the investigator is no longer alive - the Rules Reference
 * makes that automatic, so a living investigator at the limit is a
 * bookkeeping error.
 */
function investigatorErrors(inv: CampaignInvestigator): string[] {
  const counters = {
    'physical trauma': inv.physicalTrauma,
    'mental trauma': inv.mentalTrauma,
    'earned XP': inv.xpEarned,
    'spent XP': inv.xpSpent,
  };
  return [
    ...Object.entries(counters)
      .filter(([, value]) => !Number.isInteger(value) || value < 0)
      .map(([name, value]) => `investigator ${inv.code} has ${value} ${name}`),
    ...(inv.xpSpent > inv.xpEarned
      ? [`investigator ${inv.code} spent ${inv.xpSpent} of ${inv.xpEarned} XP`]
      : []),
    ...(isPositiveInteger(inv.health) && isPositiveInteger(inv.sanity)
      ? []
      : [`investigator ${inv.code} has health ${inv.health} and sanity ${inv.sanity}`]),
    ...(inv.fate === 'alive' && (traumaFate(inv, 'physical') ?? traumaFate(inv, 'mental'))
      ? [`investigator ${inv.code} is alive with trauma at the limit`]
      : []),
  ];
}

function positionErrors(log: CampaignLog): string[] {
  const { position, scenarioIds } = log;
  return Number.isInteger(position) && position >= 0 && position <= scenarioIds.length
    ? []
    : [`scenario position ${position} is outside 0..${scenarioIds.length}`];
}
