import type { InstanceId, MapId } from './ids';
import type { RngState } from './rng';
import type {
  CampaignLog,
  CardInstance,
  ChaosToken,
  Difficulty,
  Edge,
  Investigator,
  TokenKind,
} from './state';
import type { Zone } from './zone';

/**
 * Events are facts: they carry everything needed to apply them, so the
 * reducer never needs to validate, generate IDs or draw random numbers.
 */
export type Event = ScenarioStarted | DeckShuffled | CardMoved | TokensChanged;

/** A scenario was set up; replaces the whole state. Produced by `StartScenario`. */
export interface ScenarioStarted {
  type: 'ScenarioStarted';
  scenarioId: string;
  difficulty: Difficulty;
  seed: number;
  investigators: Investigator[];
  maps: Record<MapId, { name: string; visible: boolean }>;
  /** All card instances in their initial zones; list order = order within each zone. */
  cards: CardInstance[];
  connections: Edge[];
  chaosBag: ChaosToken[];
  campaign?: CampaignLog;
}

/** A zone (usually the encounter deck) was shuffled using the state's RNG. */
export interface DeckShuffled {
  type: 'DeckShuffled';
  zone: Zone;
  /** New order of the zone, top first. */
  order: InstanceId[];
  /** RNG state after the shuffle. */
  rngState: RngState;
}

/** A card instance changed zone or position within its zone. */
export interface CardMoved {
  type: 'CardMoved';
  cardId: InstanceId;
  from: Zone;
  to: Zone;
  /** Position in the destination zone (0 = top). Omitted = bottom/end. */
  index?: number;
}

/** Tokens of one kind were added to (`delta` > 0) or removed from a card. */
export interface TokensChanged {
  type: 'TokensChanged';
  cardId: InstanceId;
  token: TokenKind;
  delta: number;
}

/** String literal of every event type. */
export type EventType = Event['type'];
