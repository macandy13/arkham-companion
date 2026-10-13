import type { InstanceId, MapId } from './ids';
import type { RngState } from './rng';
import type {
  CampaignLog,
  CardInstance,
  ChaosToken,
  Difficulty,
  Investigator,
  TokenKind,
} from './state';
import type { Zone } from './zone';

/**
 * Events are facts: they carry everything needed to apply them, so the
 * reducer never needs to validate, generate IDs or draw random numbers.
 */
export type Event = ScenarioStarted | DeckShuffled | CardMoved | TokensChanged;

export interface ScenarioStarted {
  type: 'ScenarioStarted';
  scenarioId: string;
  difficulty: Difficulty;
  seed: number;
  investigators: Investigator[];
  maps: Record<MapId, { name: string; visible: boolean }>;
  /** All card instances in their initial zones; list order = order within each zone. */
  cards: CardInstance[];
  chaosBag: ChaosToken[];
  campaign?: CampaignLog;
}

export interface DeckShuffled {
  type: 'DeckShuffled';
  zone: Zone;
  /** New order of the zone, top first. */
  order: InstanceId[];
  /** RNG state after the shuffle. */
  rngState: RngState;
}

export interface CardMoved {
  type: 'CardMoved';
  cardId: InstanceId;
  from: Zone;
  to: Zone;
  /** Position in the destination zone (0 = top). Omitted = bottom/end. */
  index?: number;
}

export interface TokensChanged {
  type: 'TokensChanged';
  cardId: InstanceId;
  token: TokenKind;
  delta: number;
}

export type EventType = Event['type'];
