import type { DecisionId, InstanceId, InvestigatorId, MapId, SlotId } from './ids';
import type { RngState } from './rng';
import type { Zone, ZoneKey } from './zone';

/** Kinds of tokens that can be placed on a card instance. */
export type TokenKind = 'doom' | 'clue' | 'damage' | 'horror' | 'resource';
/** All token kinds, e.g. for iterating in the UI or in tests. */
export const TOKEN_KINDS: readonly TokenKind[] = ['doom', 'clue', 'damage', 'horror', 'resource'];

/**
 * One physical card on the table (architecture §5). Multiple copies of the same
 * card are separate instances sharing a `code`; the card's static data
 * (name, text, stats) is looked up by `code` in `@arkham/carddata`.
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
  status: InvestigatorStatus;
}

/** A connection between two location instances on the map graph (architecture §5 "Map model"). */
export interface Edge {
  from: InstanceId;
  to: InstanceId;
  /** One-way edges only allow movement from `from` to `to`. */
  oneWay: boolean;
}

/**
 * Map layout and connection graph. Which cards are locations on which map is
 * given by their `Zone` (`{ kind: 'location', mapId }`); the board adds where
 * they are drawn (`placement` into `slots`) and how they connect.
 */
export interface Board {
  maps: Record<MapId, { name: string; visible: boolean }>;
  slots: Record<SlotId, { mapId: MapId; x: number; y: number }>;
  placement: Record<InstanceId, SlotId | { x: number; y: number }>;
  connections: Edge[];
  layoutMode: 'book' | 'auto';
}

/** Scenario difficulty; selects the chaos bag and some setup variants. */
export type Difficulty = 'easy' | 'standard' | 'hard' | 'expert';
/** Current game phase; `setup` before the first mythos phase. */
export type Phase = 'setup' | 'mythos' | 'investigation' | 'enemy' | 'upkeep';

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

/**
 * An open choice for the players (hunter tie, spawn location, effect target …).
 * The engine never guesses; the answer comes back as a `ResolveDecision` command.
 */
export interface Decision {
  id: DecisionId;
  /** Machine-readable kind, e.g. 'hunterTie'. Interpreted by the rule module that created it. */
  kind: string;
  /** i18n key or plain text describing the choice. */
  prompt: string;
  options: DecisionOption[];
}

/** One answer the players can pick for a `Decision`. */
export interface DecisionOption {
  id: string;
  label: string;
  /** Optional reference to a card or investigator the option is about. */
  target?: InstanceId | InvestigatorId;
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
  playerCount: number;
  seed: number;
  rngState: RngState;
  round: number;
  phase: Phase;
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
    },
    investigators: [],
    cards: {},
    order: {},
    board: { maps: {}, slots: {}, placement: {}, connections: [], layoutMode: 'book' },
    chaosBag: [],
    agenda: {},
    act: {},
    scenario: undefined,
    pending: [],
  };
}
