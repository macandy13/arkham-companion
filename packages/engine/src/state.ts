import type { DecisionId, InstanceId, InvestigatorId, MapId, SlotId } from './ids';
import type { RngState } from './rng';
import type { Zone, ZoneKey } from './zone';

export type TokenKind = 'doom' | 'clue' | 'damage' | 'horror' | 'resource';
export const TOKEN_KINDS: readonly TokenKind[] = ['doom', 'clue', 'damage', 'horror', 'resource'];

/** One physical card on the table (architecture §5). */
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

export type InvestigatorStatus = 'active' | 'resigned' | 'defeated';

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

export interface Edge {
  from: InstanceId;
  to: InstanceId;
  /** One-way edges only allow movement from `from` to `to`. */
  oneWay: boolean;
}

export interface Board {
  maps: Record<MapId, { name: string; visible: boolean }>;
  slots: Record<SlotId, { mapId: MapId; x: number; y: number }>;
  placement: Record<InstanceId, SlotId | { x: number; y: number }>;
  connections: Edge[];
  layoutMode: 'book' | 'auto';
}

export type Difficulty = 'easy' | 'standard' | 'hard' | 'expert';
export type Phase = 'setup' | 'mythos' | 'investigation' | 'enemy' | 'upkeep';

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
