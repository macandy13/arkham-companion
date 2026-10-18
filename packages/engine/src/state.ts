import type { CampaignLog } from './campaign/campaign_log';
import type {
  Command,
  DrawEncounter,
  EngageEnemy,
  Investigate,
  MoveInvestigator,
} from './commands';
import {
  scenarioId,
  type CardCode,
  type DecisionId,
  type InstanceId,
  type InvestigatorCode,
  type InvestigatorId,
  type MapId,
  type ScenarioId,
  type SlotId,
} from './ids';
import type { GameMap } from './map';
import type { RngState } from './rng';
import type { Zone, ZoneKey } from './zone';

/** Kinds of tokens that can be placed on a card instance. */
export type TokenKind = 'doom' | 'clue' | 'damage' | 'horror' | 'resource';
/** All token kinds, e.g. for iterating in the UI or in tests. */
export const TOKEN_KINDS: readonly TokenKind[] = ['doom', 'clue', 'damage', 'horror', 'resource'];

/**
 * One physical card on the table (architecture "Game state"). Multiple copies of the same
 * card are separate instances sharing a `code`; the card's static data
 * (name, text, stats) is looked up by `code` in the `CardDb` of the `EngineContext`.
 */
export interface CardInstance {
  id: InstanceId;
  /** ArkhamDB card code, e.g. '12106'. */
  code: CardCode;
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
export type InvestigatorStat = 'damage' | 'horror' | 'clues' | 'resources' | 'doomOnPlayerCards';
/** All investigator stats, e.g. for iterating in tests. */
export const INVESTIGATOR_STATS: readonly InvestigatorStat[] = [
  'damage',
  'horror',
  'clues',
  'resources',
  'doomOnPlayerCards',
];

/**
 * A player's investigator. The investigator card itself is not a `CardInstance`;
 * cards in their threat area or engaged with them refer to `id` via their `Zone`.
 */
export interface Investigator {
  id: InvestigatorId;
  /** ArkhamDB card code of the investigator card. */
  code: InvestigatorCode;
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
   * Actions the investigator has left this round. A plain counter the players
   * manage (`AdjustActions`): the engine cannot tell an action from a card
   * effect while player cards are not modelled, so it does not count actions
   * itself. Set to `BASE_ACTIONS_PER_TURN` by the scenario start and by
   * upkeep step 4.2 (`ActionsReset`); never negative. There is deliberately no
   * separate count of extra actions: an investigator whose cards grant one
   * more action gets it by the players adjusting this counter after the reset.
   */
  actionsRemaining: number;
  /**
   * The printed skill values of the investigator card, the base of every
   * skill test they take (`skillTestSuggestion`). Fixed for the scenario:
   * changes by cards are modifiers, not edits of these values.
   */
  skills: SkillValues;
  status: InvestigatorStatus;
}

/** One value per skill, e.g. an investigator's printed skills. */
export type SkillValues = Readonly<Record<SkillName, number>>;

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
 * The steps of the round the phase assistant runs itself, named for what they
 * do; each comment gives its number in the Rules Reference, Appendix I
 * ("Framework"): 1.x mythos, 2.x investigation,
 * 3.x enemy, 4.x upkeep. The "phase begins"/"phase ends" steps (1.1, 1.5,
 * 2.1, 2.3, 3.1, 3.4, 4.1) are the `PhaseChanged` of `NextPhase`, and the
 * investigation phase's turns (2.2 "next investigator's turn begins", 2.2.1
 * actions, 2.2.2 "turn ends") are the players' `StartTurn`/`EndTurn`, so they
 * are not steps here. Player cards are not modelled, so the players handle
 * their part themselves: counting their actions during the turn (2.2.1,
 * `AdjustActions`), readying their cards (4.3), drawing 1 card (4.4) and
 * checking hand size (4.5).
 */
export type PhaseStepId =
  /** 1.2 Mythos: place 1 doom on the current agenda. */
  | 'placeDoom'
  /** 1.3 Mythos: check the doom threshold (the only regular moment the agenda advances). */
  | 'checkDoomThreshold'
  /** 1.4 Mythos: each investigator draws 1 encounter card (one step each, in player order). */
  | 'drawEncounterCard'
  /** 3.2 Enemy: hunter enemies move. */
  | 'huntersMove'
  /** 3.3 Enemy: each investigator, in player order, resolves the attacks of engaged enemies. */
  | 'enemiesAttack'
  /** 4.2 Upkeep: reset each investigator's remaining actions (`ActionsReset`). */
  | 'resetActions'
  /**
   * 4.3 Upkeep: ready each exhausted card. Only enemies are modelled; the players
   * ready their own cards at the table.
   */
  | 'readyExhausted'
  /** 4.4 Upkeep: each investigator gains 1 resource; drawing 1 card is left to the players. */
  | 'gainResources'
  /** 4.6 Upkeep: the upkeep phase and the round end (`RoundEnded`, `onRoundEnd`). */
  | 'endRound';

/** One enemy attack that step 3.3 still has to resolve (`ResolveEnemyAttack`). */
export interface DueAttack {
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
}

/**
 * One outstanding step of the current phase (the phase assistant's cursor,
 * `GameMeta.steps`), identified by a readable name (`PhaseStepId`).
 * Entering a phase lists its steps; `NextPhase` runs them in order and stops
 * when one leaves a decision pending, so the next `NextPhase` resumes with the
 * step after it. Steps are data in the state rather than a position in code so
 * a mythos phase interrupted by a decision survives undo, replay and a reload.
 */
export type PhaseStep =
  | { id: 'placeDoom' }
  | { id: 'checkDoomThreshold' }
  | { id: 'drawEncounterCard'; investigatorId: InvestigatorId }
  | { id: 'huntersMove' }
  /**
   * `attacks` is absent until the step is reached; then it lists the due
   * attacks, so the list reflects hunters that just moved and engaged. The
   * step stays current until the players resolved each of them.
   */
  | { id: 'enemiesAttack'; attacks?: DueAttack[] }
  | { id: 'resetActions' }
  | { id: 'readyExhausted' }
  | { id: 'gainResources' }
  | { id: 'endRound' };

/**
 * The investigator turn in progress (Rules Reference 2.2: "next
 * investigator's turn begins"), between `StartTurn` and `EndTurn`. It tells
 * the UI whose turn it is and gates the end of the investigation phase; the
 * players count that investigator's actions (`Investigator.actionsRemaining`).
 */
export interface Turn {
  investigatorId: InvestigatorId;
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
  | 'frost'
  /** Core Set (2026): -1, reveal another token, seal the first box on the investigator card. */
  | 'blood';

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

/** Whether a skill test succeeded or failed (`SkillTestResolved`). */
export type SkillTestOutcome = 'pass' | 'fail';

/** Which number of a skill test a modifier changes: the investigator's skill value or the difficulty. */
export type ModifierTarget = 'skill' | 'difficulty';

/**
 * Where one step of a skill test's explanation trace comes from
 * (`ModifierStep`), so the UI can name it: the investigator's printed skill,
 * the test's printed difficulty, the one modifier the players enter
 * (`SkillTestInput.modifier`), a revealed chaos token (with the reference
 * card's effect text, if it has one), or the rules that cap the result
 * (auto-fail, nothing below 0).
 */
export type ModifierSource =
  | { kind: 'baseSkill' }
  | { kind: 'baseDifficulty' }
  | { kind: 'playerModifier' }
  | { kind: 'chaosToken'; token: ChaosToken; effectKey?: string }
  | { kind: 'autoFail' }
  | { kind: 'minimumZero' };

/** One line of the explanation trace: what `source` changed and the running total after it. */
export interface ModifierStep {
  target: ModifierTarget;
  source: ModifierSource;
  change: number;
  /** The target's value after this step. */
  total: number;
}

/**
 * The modified skill value and difficulty the engine computes for a skill
 * test (`skillTestSuggestion`), with the steps that led there. Only a
 * suggestion: the players resolve the test at the table and still answer the
 * decision with pass or fail, so a modifier the engine does not know about
 * (a player card, a misread token) never decides a test.
 */
export interface SkillTestSuggestion {
  skill: number;
  difficulty: number;
  /** `pass` when the skill value reaches the difficulty and no auto-fail was revealed. */
  outcome: 'pass' | 'fail';
  /**
   * Revealed tokens whose modifier the engine cannot tell (the elder sign,
   * which is the investigator's ability, or a symbol whose reference card
   * effect has no number): the players add those themselves.
   */
  unknownTokens: ChaosToken[];
  /** Base values first, then every change in the order applied. */
  trace: ModifierStep[];
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
   * Only for `skillTestResult` decided by one investigator: the modified
   * values before the players enter their modifier or reveal a token,
   * computed when the decision is raised. The UI recomputes it with the
   * players' input (`suggestSkillTest`); the answer stays pass/fail either way.
   */
  suggestion?: SkillTestSuggestion;
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
  /**
   * Like `amount`, for an option with several counts the players confirm or
   * adjust (an attack's damage and horror): each range is keyed by the
   * command field it replaces, and `ResolveDecision.amounts` sets them.
   */
  amounts?: Readonly<Record<string, AmountRange>>;
}

/** The counts an option with an adjustable amount accepts; no `max` means no upper bound. */
export interface AmountRange {
  default: number;
  min: number;
  max?: number;
}

/** Scenario-wide bookkeeping: identity, randomness and turn structure. */
export interface GameMeta {
  scenarioId: ScenarioId;
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
  /**
   * Set by `ScenarioEnded`, with or without a resolution. Kept apart from
   * `resolution` because a scenario in which every investigator was
   * eliminated ends with no resolution, and `handle` must still refuse play
   * from then on (`CommandSpec.allowedAfterEnd`).
   */
  ended?: true;
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
  /**
   * A command waiting for pending decisions (`ActionHeld`): an action for
   * the attacks of opportunity it provoked, or a surge draw for the
   * decisions of the card before it. Absent otherwise.
   */
  heldAction?: HeldAction;
}

/**
 * The commands that can wait for pending decisions: the actions the engine
 * sees that provoke attacks of opportunity (`attackOfOpportunityDecisions`),
 * and a surge draw (`surgeDraw`).
 */
export type HeldAction = MoveInvestigator | Investigate | EngageEnemy | DrawEncounter;

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
      scenarioId: scenarioId(''),
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
