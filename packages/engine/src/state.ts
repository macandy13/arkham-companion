import type { Command } from './commands';
import type { DecisionId, InstanceId, InvestigatorId, MapId, SlotId } from './ids';
import type { GameMap } from './map';
import type { RngState } from './rng';
import type { Zone, ZoneKey } from './zone';

/** Kinds of tokens that can be placed on a card instance. */
export type TokenKind = 'doom' | 'clue' | 'damage' | 'horror' | 'resource';
/** All token kinds, e.g. for iterating in the UI or in tests. */
export const TOKEN_KINDS: readonly TokenKind[] = ['doom', 'clue', 'damage', 'horror', 'resource'];

/**
 * One physical card on the table (architecture §5). Multiple copies of the same
 * card are separate instances sharing a `code`; the card's static data
 * (name, text, stats) is looked up by `code` in the `CardDb` of the `EngineContext`.
 */
export interface CardInstance {
  id: InstanceId;
  /** ArkhamDB card code, e.g. '12106'. */
  code: string;
  zone: Zone;
  /** Unrevealed/revealed or front/back. */
  faceUp: boolean;
  exhausted: boolean;
  tokens: Partial<Record<TokenKind, number>>;
  /** Scenario-specific markers. */
  flags: Record<string, unknown>;
}

/**
 * Whether an investigator is still in the scenario. `resigned` and `defeated`
 * are permanent for the rest of the scenario.
 */
export type InvestigatorStatus = 'active' | 'resigned' | 'defeated';

/** The investigator counters that commands and events can change. */
export type InvestigatorStat =
  'damage' | 'horror' | 'clues' | 'resources' | 'doomOnPlayerCards' | 'extraActions';
/** All investigator stats, e.g. for iterating in tests. */
export const INVESTIGATOR_STATS: readonly InvestigatorStat[] = [
  'damage',
  'horror',
  'clues',
  'resources',
  'doomOnPlayerCards',
  'extraActions',
];

/**
 * A player's investigator. The investigator card itself is not a `CardInstance`;
 * cards in their threat area or engaged with them refer to `id` via their `Zone`.
 */
export interface Investigator {
  id: InvestigatorId;
  /** ArkhamDB card code of the investigator card. */
  code: string;
  name: string;
  seat: number;
  locationId?: InstanceId;
  health: { max: number; damage: number };
  sanity: { max: number; horror: number };
  clues: number;
  resources: number;
  /**
   * Doom on the investigator's player cards. The app does not model player
   * cards, so the players keep this plain counter instead; it counts towards
   * the doom total like doom on any card in play (`doomInPlay`).
   */
  doomOnPlayerCards: number;
  /**
   * Actions per turn beyond the standard 3, granted for the rest of the
   * scenario by the investigator's cards ("you may take an additional action
   * during your turn"). Changed with `AdjustInvestigator`; a one-turn bonus is
   * `AdjustActions` instead (`Turn.actionAdjustment`).
   */
  extraActions: number;
  status: InvestigatorStatus;
}

/**
 * Maps and their layout. Each `GameMap` owns its locations and connections
 * (see `map.ts`); the board adds where locations are drawn (`placement` into
 * `slots`).
 */
export interface Board {
  maps: Record<MapId, GameMap>;
  slots: Record<SlotId, { mapId: MapId; x: number; y: number }>;
  placement: Record<InstanceId, SlotId | { x: number; y: number }>;
  layoutMode: 'book' | 'auto';
}

/** Scenario difficulty; selects the chaos bag and some setup variants. */
export type Difficulty = 'easy' | 'standard' | 'hard' | 'expert';
/** Current game phase; `setup` before the first mythos phase. */
export type Phase = 'setup' | 'mythos' | 'investigation' | 'enemy' | 'upkeep';

/**
 * The steps of the round the phase assistant runs itself, numbered as in the
 * Rules Reference, Appendix I ("Framework"): 1.x mythos, 2.x investigation,
 * 3.x enemy, 4.x upkeep. The "phase begins"/"phase ends" steps (1.1, 1.5,
 * 2.1, 2.3, 3.1, 3.4, 4.1) are the `PhaseChanged` of `NextPhase`, and the
 * investigation phase's turns (2.2 "next investigator's turn begins", 2.2.1
 * actions, 2.2.2 "turn ends") are the players' `StartTurn`/`EndTurn`, so they
 * are not steps here. 4.2 "reset actions" needs no step: actions are counted
 * per turn (`Turn`). 4.4's card draw and 4.5's hand size are left to the
 * players (player cards are not modelled).
 */
export type PhaseStepId =
  /** Mythos: place 1 doom on the current agenda. */
  | '1.2'
  /** Mythos: check the doom threshold (the only regular moment the agenda advances). */
  | '1.3'
  /** Mythos: each investigator draws 1 encounter card (one step each, in player order). */
  | '1.4'
  /** Enemy: hunter enemies move. */
  | '3.2'
  /** Enemy: each investigator, in player order, resolves the attacks of engaged enemies. */
  | '3.3'
  /** Upkeep: ready each exhausted card (only enemies are modelled). */
  | '4.3'
  /** Upkeep: each investigator gains 1 resource (and draws 1 card at the table). */
  | '4.4'
  /** Upkeep: the upkeep phase and the round end (`RoundEnded`, `onRoundEnd`). */
  | '4.6';

/** One enemy attack that step 3.3 still has to resolve (`ResolveEnemyAttack`). */
export interface DueAttack {
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
}

/**
 * One outstanding step of the current phase (the phase assistant's cursor,
 * `GameMeta.steps`), identified by its Rules Reference number (`PhaseStepId`).
 * Entering a phase lists its steps; `NextPhase` runs them in order and stops
 * when one leaves a decision pending, so the next `NextPhase` resumes with the
 * step after it. Steps are data in the state rather than a position in code so
 * a mythos phase interrupted by a decision survives undo, replay and a reload.
 */
export type PhaseStep =
  | { id: '1.2' }
  | { id: '1.3' }
  | { id: '1.4'; investigatorId: InvestigatorId }
  | { id: '3.2' }
  /**
   * `attacks` is absent until the step is reached; then it lists the due
   * attacks, so the list reflects hunters that just moved and engaged. The
   * step stays current until the players resolved each of them.
   */
  | { id: '3.3'; attacks?: DueAttack[] }
  | { id: '4.3' }
  | { id: '4.4' }
  | { id: '4.6' };

/**
 * The investigator turn in progress (Rules Reference 2.2: "next
 * investigator's turn begins"), between `StartTurn` and `EndTurn`. Actions
 * are counted per turn against the allowance (`actionAllowance`: the base 3,
 * the investigator's persistent `extraActions` and this turn's
 * `actionAdjustment`), so the upkeep's "reset actions" needs no bookkeeping.
 */
export interface Turn {
  investigatorId: InvestigatorId;
  /** Actions taken so far in this turn (`ActionTaken`). */
  actionsTaken: number;
  /** Change to the allowance for this turn only (`AdjustActions`, `ManualAdjust`). */
  actionAdjustment: number;
}

/** Tokens in the chaos bag. */
export type ChaosToken =
  | '+1'
  | '0'
  | '-1'
  | '-2'
  | '-3'
  | '-4'
  | '-5'
  | '-6'
  | '-7'
  | '-8'
  | 'skull'
  | 'cultist'
  | 'tablet'
  | 'elderThing'
  | 'autoFail'
  | 'elderSign'
  | 'bless'
  | 'curse'
  | 'frost';

/** The kinds of decision; the UI has one dialog per kind (M3.7). */
export type DecisionKind =
  | 'confirm'
  | 'chooseInvestigator'
  | 'chooseLocation'
  | 'chooseCard'
  | 'chooseOption'
  | 'skillTestResult';

/**
 * Who answers a decision: the lead investigator (ties, "of your choice" rules
 * the lead settles), one named investigator (a choice only they make) or the
 * group. A hint for the UI only; the engine accepts an answer from anyone,
 * because it does not know who sits at the table.
 */
export type Decider =
  { kind: 'lead' } | { kind: 'investigator'; investigatorId: InvestigatorId } | { kind: 'group' };

/** The investigator skills a skill test can use. */
export type SkillName = 'willpower' | 'intellect' | 'combat' | 'agility';

/** The test the players resolve at the table for a `skillTestResult` decision. */
export interface SkillTest {
  skill: SkillName;
  /** Shroud, enemy value or the number printed on the card. */
  difficulty: number;
}

/**
 * An open choice for the players (hunter tie, spawn location, effect target,
 * skill test outcome …). The engine never guesses; the answer comes back as a
 * `ResolveDecision` command, which runs the commands of the chosen option.
 * Created by a `DecisionRequested` event (from a rule module or a
 * `RequestDecision` command, e.g. returned by a scenario hook) and kept in
 * `GameState.pending` until it is resolved or the card it is about advances
 * or leaves play. While any decision is pending `handle` rejects every
 * command except `ManualAdjust` and `ResolveDecision`.
 */
export interface Decision {
  /** Unique among pending decisions; derived from kind and subject so a repeated check does not ask twice. */
  id: DecisionId;
  kind: DecisionKind;
  /** The card the decision is about, if any; the decision is dropped when this card advances. */
  subject?: InstanceId;
  /** i18n key or plain text describing the choice. */
  prompt: string;
  decider: Decider;
  /** Only for `skillTestResult`: what the players are testing. */
  skillTest?: SkillTest;
  /**
   * The answers. Each carries the commands it triggers, so the mapping from
   * answer to consequence is data and any module (or scenario) can raise a decision.
   */
  options: DecisionOption[];
}

/** One answer the players can pick for a `Decision`. */
export interface DecisionOption {
  /** Unique within its decision. */
  id: string;
  /** i18n key or plain text. */
  label: string;
  /** Optional reference to a card or investigator the option is about. */
  target?: InstanceId | InvestigatorId;
  /**
   * Commands `ResolveDecision` runs through `handle` when this option is
   * picked (validated, in the same undo group). They are checked when the
   * decision is resolved, not when it is raised, so they may refer to the
   * state of that later moment.
   */
  commands: Command[];
  /**
   * Set when the option's consequence is a count the players confirm or
   * adjust (clues discovered, damage dealt): `commands` are written for
   * `default`, and a `ResolveDecision.amount` in the range replaces the
   * `amount` of each of them.
   */
  amount?: AmountRange;
}

/** The counts an option with an adjustable amount accepts; no `max` means no upper bound. */
export interface AmountRange {
  default: number;
  min: number;
  max?: number;
}

/** Campaign log – stub until campaign mode (architecture §8). */
export interface CampaignLog {
  campaignId: string;
  /** Free-form campaign log entries ("The investigators …"). */
  entries: string[];
  /** Crossed-out / counted records keyed by name. */
  records: Record<string, number | boolean | string>;
}

/** Scenario-wide bookkeeping: identity, randomness and turn structure. */
export interface GameMeta {
  scenarioId: string;
  difficulty: Difficulty;
  /**
   * Number of investigators who started the scenario. Never decremented when an
   * investigator is defeated or resigns: "per investigator" values (clues, enemy
   * health, act thresholds) keep using the starting count, per the Rules
   * Reference and FAQ. Set by `ScenarioStarted`.
   */
  playerCount: number;
  /** Resolution id the scenario ended with (`ScenarioEnded`); absent while it is still running. */
  resolution?: string;
  seed: number;
  rngState: RngState;
  /** Number of the current round; 0 during setup, 1 from the first investigation phase. */
  round: number;
  phase: Phase;
  /** Outstanding steps of the current phase, next first (see `PhaseStep`). */
  steps: PhaseStep[];
  /**
   * Investigators who have taken their turn this round (`EndTurn`, or defeat
   * during their turn). A per-round flag kept apart from `InvestigatorStatus`,
   * which is permanent for the scenario; cleared when the round ends.
   */
  turnsTaken: InvestigatorId[];
  /** The turn in progress during the investigation phase; absent between turns. */
  turn?: Turn;
  leadInvestigator?: InvestigatorId;
}

/**
 * Complete state of one scenario in play. Only ever produced by the reducer
 * (`apply`/`replay`) from events; never mutated directly.
 */
export interface GameState {
  meta: GameMeta;
  /** Absent in standalone play. */
  campaign?: CampaignLog;
  investigators: Investigator[];
  cards: Record<InstanceId, CardInstance>;
  /**
   * Order of the cards in every non-empty zone; index 0 is the top of a deck.
   * Invariant: each card appears exactly once, in the list of its own zone.
   */
  order: Record<ZoneKey, InstanceId[]>;
  board: Board;
  chaosBag: ChaosToken[];
  agenda: { current?: InstanceId };
  act: { current?: InstanceId };
  /** Typed per scenario (zod schema in the scenario package). */
  scenario: unknown;
  pending: Decision[];
}

/** State before any `ScenarioStarted` event. */
export function emptyState(): GameState {
  return {
    meta: {
      scenarioId: '',
      difficulty: 'standard',
      playerCount: 0,
      seed: 0,
      rngState: [0, 0, 0, 1],
      round: 0,
      phase: 'setup',
      steps: [],
      turnsTaken: [],
    },
    investigators: [],
    cards: {},
    order: {},
    board: { maps: {}, slots: {}, placement: {}, layoutMode: 'book' },
    chaosBag: [],
    agenda: {},
    act: {},
    scenario: undefined,
    pending: [],
  };
}
