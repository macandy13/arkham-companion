import type { SetupStep } from './setup';
import type { ChaosToken, Difficulty } from './state';
import type { ScenarioHooks } from './triggers';

/**
 * A scenario as data (architecture "Scenarios"): its agendas and acts, chaos bag,
 * reference card and setup steps. `compileSetup` turns it into a
 * `StartScenario`. Resolutions and campaign variants join this type with the
 * tasks that need them.
 */
export interface ScenarioDefinition {
  /** Stored as `GameMeta.scenarioId`. */
  id: string;
  /** Standalone chaos bag per difficulty. */
  chaosBag: Record<Difficulty, readonly ChaosToken[]>;
  /** What the symbol chaos tokens do, as printed on the scenario reference card. */
  reference: ScenarioReference;
  /** Agenda codes, first agenda first. */
  agendaDeck: readonly string[];
  /** Act codes, first act first. */
  actDeck: readonly string[];
  setup: readonly SetupStep[];
  /**
   * The scenario's forced effects. Not read by `compileSetup`: the app passes
   * them to the engine as `EngineContext.hooks` for the whole scenario.
   */
  hooks?: Partial<ScenarioHooks>;
}

/** The chaos tokens whose effect each scenario defines on its reference card. */
export type SymbolToken = Extract<ChaosToken, 'skull' | 'cultist' | 'tablet' | 'elderThing'>;

/**
 * Side of the scenario reference card: one side covers Easy and Standard, the
 * other Hard and Expert. `referenceSide` picks it for a difficulty.
 */
export type ReferenceSide = 'easyStandard' | 'hardExpert';

/**
 * The scenario reference card as data: per side, the effect of each symbol
 * token the scenario uses (a token missing from a side has no special effect
 * there). Only numbers and translation keys – no card text – so it can be
 * committed. Resolving a revealed token is a later task; this only records
 * what the card says.
 */
export type ScenarioReference = Record<
  ReferenceSide,
  Partial<Record<SymbolToken, SymbolTokenEffect>>
>;

/** What one symbol token does on one side of a scenario reference card. */
export interface SymbolTokenEffect {
  /**
   * The printed skill test modifier, e.g. -2. Absent when the effect defines
   * it (a "−X" that counts something in play) or replaces it ("reveal
   * another token"); the effect text then says how.
   */
  readonly modifier?: number;
  /** Translation key of the effect text, e.g. 'scenario.theGathering.skull.easyStandard'. */
  readonly effectKey: string;
}

/** The reference card side that applies at `difficulty`. */
export function referenceSide(difficulty: Difficulty): ReferenceSide {
  return difficulty === 'easy' || difficulty === 'standard' ? 'easyStandard' : 'hardExpert';
}
