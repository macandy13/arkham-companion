import {
  campaignDefinitionId,
  campaignId,
  type CampaignDefinitionId,
  type CampaignId,
  type InvestigatorCode,
  type ScenarioId,
} from '../ids';
import type { ChaosToken, Difficulty } from '../state';

/**
 * What became of an investigator over the campaign. A single field rather
 * than separate killed/insane flags, so an investigator can never be both.
 * `killed` and `insane` are permanent in play (only an `AdjustCampaign`
 * correction undoes them): such an investigator cannot gain XP or trauma and
 * must be replaced (`ReplaceInvestigator`) before the next scenario (M1C.4).
 */
export type InvestigatorFate = 'alive' | 'killed' | 'insane';

/** The two kinds of trauma (Rules Reference, "Trauma"). */
export type TraumaKind = 'physical' | 'mental';

/** The two XP totals the campaign log keeps per investigator. */
export type XpAccount = 'earned' | 'spent';

/**
 * One investigator's line in the campaign log, identified by the ArkhamDB
 * code of the investigator card (a campaign never has two copies of one
 * investigator). Unlike the game's `Investigator`, it survives every
 * scenario. `name`, `health` and `sanity` are the printed values, copied in
 * so the log reads and checks itself without a `CardDb`: trauma reaching
 * health or sanity kills the investigator or drives them insane.
 */
export interface CampaignInvestigator {
  /** ArkhamDB code of the investigator card. */
  readonly code: InvestigatorCode;
  /** Printed name, as written on the paper campaign log. */
  readonly name: string;
  readonly health: number;
  readonly sanity: number;
  readonly physicalTrauma: number;
  readonly mentalTrauma: number;
  /** All XP earned so far; spending never lowers it, so the log shows both totals like the paper log. */
  readonly xpEarned: number;
  readonly xpSpent: number;
  readonly fate: InvestigatorFate;
}

/** An entry of a `crossableList` story record, e.g. a cultist who got away. */
export interface CrossableEntry {
  readonly name: string;
  /** Crossed out in the log, e.g. once the cultist who got away is defeated after all. */
  readonly crossedOut: boolean;
}

/**
 * The value of a story record in the campaign log ("The investigators
 * burned the house", "cultists who got away"). Typed instead of a loose
 * `unknown`, so `campaignSetup` and resolutions (M1C.3/M1C.4) can read it
 * safely and the UI knows how to show it.
 */
export type StoryValue =
  /** A yes/no record, e.g. "the Ghoul Priest is still alive". */
  | { readonly kind: 'flag'; readonly value: boolean }
  /** A non-negative count, e.g. "doubt" marks. */
  | { readonly kind: 'count'; readonly value: number }
  /** Names written under a heading, each at most once. */
  | { readonly kind: 'list'; readonly entries: readonly string[] }
  /** Names written under a heading that later scenarios may cross out again. */
  | { readonly kind: 'crossableList'; readonly entries: readonly CrossableEntry[] };

/** The kinds of `StoryValue`; a record keeps its kind once written. */
export type StoryKind = StoryValue['kind'];

/**
 * The campaign log (architecture §5, §8): everything that carries over from
 * one scenario to the next. The state of the campaign aggregate, only ever
 * produced by `applyEvent`/`replayEvents` from campaign events; a
 * game's `GameState.campaign` holds a copy of it at scenario start.
 */
export interface CampaignLog {
  /** ID of this campaign (one play-through); `GameStore` links games to it. */
  readonly campaignId: CampaignId;
  /** `CampaignDefinition.id` of the campaign being played. */
  readonly definitionId: CampaignDefinitionId;
  readonly difficulty: Difficulty;
  /** The current team in seat order; a replaced investigator moves to `formerInvestigators`. */
  readonly investigators: readonly CampaignInvestigator[];
  /**
   * Investigators no longer on the team: killed or insane ones, who never
   * come back, and living ones whose player left the campaign, who may rejoin
   * between scenarios (Rules Reference, "Joining or Leaving a Campaign").
   * Kept because the log still lists them and a joining player must pick an
   * investigator not used before in this campaign.
   */
  readonly formerInvestigators: readonly CampaignInvestigator[];
  /** Story records by key, e.g. `ghoulPriestDefeated`. */
  readonly story: Readonly<Record<string, StoryValue>>;
  /** The campaign's chaos bag; a multiset, so order carries no meaning. */
  readonly chaosBag: readonly ChaosToken[];
  /** `ScenarioDefinition.id`s in campaign order. Empty only before `CampaignStarted`. */
  readonly scenarioIds: readonly ScenarioId[];
  /**
   * Index into `scenarioIds` of the scenario to play next; equal to its
   * length once the campaign is complete.
   */
  readonly position: number;
}

/** Log before any `CampaignStarted` event. */
export function createEmptyLog(): CampaignLog {
  return {
    campaignId: campaignId(''),
    definitionId: campaignDefinitionId(''),
    difficulty: 'standard',
    investigators: [],
    formerInvestigators: [],
    story: {},
    chaosBag: [],
    scenarioIds: [],
    position: 0,
  };
}

/**
 * Whether `CampaignStarted` has been applied. Derived from the scenario
 * list because `StartCampaign` requires at least one scenario, so no extra
 * flag can drift out of sync.
 */
export function isStarted(log: CampaignLog): boolean {
  return log.scenarioIds.length > 0;
}

/** The current team member with card code `code`, if any. */
export function findInvestigator(
  log: CampaignLog,
  code: InvestigatorCode,
): CampaignInvestigator | undefined {
  return log.investigators.find((investigator) => investigator.code === code);
}

/** The XP an investigator can still spend. */
export function countAvailableXp(investigator: CampaignInvestigator): number {
  return investigator.xpEarned - investigator.xpSpent;
}

/** The trauma count of one kind. */
export function countTrauma(investigator: CampaignInvestigator, kind: TraumaKind): number {
  return kind === 'physical' ? investigator.physicalTrauma : investigator.mentalTrauma;
}

/** `investigator` with `delta` more trauma of `kind`. */
export function addTrauma(
  investigator: CampaignInvestigator,
  kind: TraumaKind,
  delta: number,
): CampaignInvestigator {
  return kind === 'physical'
    ? { ...investigator, physicalTrauma: investigator.physicalTrauma + delta }
    : { ...investigator, mentalTrauma: investigator.mentalTrauma + delta };
}

/**
 * The fate trauma of `kind` leads to once it reaches the investigator's
 * health (physical) or sanity (mental), per the Rules Reference ("Trauma"),
 * or `undefined` while it is below.
 */
export function findTraumaFate(
  investigator: CampaignInvestigator,
  kind: TraumaKind,
): InvestigatorFate | undefined {
  const limit = kind === 'physical' ? investigator.health : investigator.sanity;
  if (countTrauma(investigator, kind) < limit) return undefined;
  return kind === 'physical' ? 'killed' : 'insane';
}

/** The ID of the scenario to play next, or `undefined` once the campaign is complete. */
export function findCurrentScenarioId(log: CampaignLog): ScenarioId | undefined {
  return log.scenarioIds[log.position];
}
