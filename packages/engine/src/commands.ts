import type { InstanceId, MapId } from './ids';
import type { CampaignLog, ChaosToken, Difficulty, Investigator, TokenKind } from './state';
import type { Zone } from './zone';

/** Commands are intents from the UI; `handle` validates them and produces events. */
export type Command = StartScenario | ManualAdjust;

export interface StartingCard {
  /** Explicit instance ID, so other starting cards can reference it. Defaults to `c<index>`. */
  id?: InstanceId;
  code: string;
  zone: Zone;
  faceUp?: boolean;
}

export interface StartScenario {
  type: 'StartScenario';
  scenarioId: string;
  difficulty: Difficulty;
  seed: number;
  investigators: Investigator[];
  maps?: Record<MapId, { name: string; visible?: boolean }>;
  cards: StartingCard[];
  chaosBag?: ChaosToken[];
  campaign?: CampaignLog;
  /** Shuffle the encounter deck after setup (default true). */
  shuffleEncounterDeck?: boolean;
}

/** Manual correction by the players ("assistant, not referee"). */
export interface ManualAdjust {
  type: 'ManualAdjust';
  adjustment: Adjustment;
}

export type Adjustment =
  | { kind: 'moveCard'; cardId: InstanceId; to: Zone; index?: number }
  | { kind: 'tokens'; cardId: InstanceId; token: TokenKind; delta: number };

export type CommandType = Command['type'];
