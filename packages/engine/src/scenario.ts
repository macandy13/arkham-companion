import type { ScenarioResolutions } from './campaign/resolution';
import type { CardCode, ScenarioId } from './ids';
import type { SetupStep } from './setup';
import type { ChaosToken, Difficulty } from './state';
import type { SkillModifierRegistry } from './skill_modifiers';

/**
 * A scenario as data (architecture "Scenarios"): its agendas and acts, chaos bag,
 * reference card and setup steps. `compileSetup` turns it into a
 * `StartScenario`. Campaign variants of the setup join this type with the
 * task that needs them (M1C.5).
 */
export interface ScenarioDefinition {
  /** Stored as `GameMeta.scenarioId`. */
  id: ScenarioId;
  /** Standalone chaos bag per difficulty. */
  chaosBag: Record<Difficulty, readonly ChaosToken[]>;
  /** What the symbol chaos tokens do, as printed on the scenario reference card. */
  reference: ScenarioReference;
  /** Agenda codes, first agenda first. */
  agendaDeck: readonly CardCode[];
  /** Act codes, first act first. */
  actDeck: readonly CardCode[];
  setup: readonly SetupStep[];
  /**
   * The scenario's skill test modifiers in code (a "-X" token value, a
   * scenario-wide rule). Like `reference`, the engine reads them from
   * `EngineContext.scenario`; `compileSetup` doesn't.
   */
  modifiers?: SkillModifierRegistry;
  /**
   * What each resolution writes to the campaign log, which
   * `campaign.proposeResolution` reads once the game has ended. Absent for a
   * scenario that is only played standalone so far.
   */
  resolutions?: ScenarioResolutions;
}

/** The chaos tokens whose effect each scenario defines on its reference card. */
export type SymbolToken = Extract<ChaosToken, 'skull' | 'cultist' | 'tablet' | 'elderThing'>;

/** The symbol tokens in the order a reference card prints their rows. */
export const SYMBOL_TOKENS = [
  'skull',
  'cultist',
  'tablet',
  'elderThing',
] as const satisfies readonly SymbolToken[];

/**
 * Side of the scenario reference card: one side covers Easy and Standard, the
 * other Hard and Expert. `pickReferenceSide` picks it for a difficulty.
 */
export type ReferenceSide = 'easyStandard' | 'hardExpert';

/**
 * The scenario reference card as data: per side, the effect of each symbol
 * token the scenario uses (a token missing from a side has no special effect
 * there). Only numbers and translation keys – no card text – so it can be
 * committed. Skill test suggestions read the `modifier` of a revealed token
 * from here (`skillTestSuggestion`); the rest of the effect stays with the players.
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
export function pickReferenceSide(difficulty: Difficulty): ReferenceSide {
  return difficulty === 'easy' || difficulty === 'standard' ? 'easyStandard' : 'hardExpert';
}
