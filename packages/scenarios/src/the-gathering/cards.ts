import {
  cardDbFrom,
  trait,
  type CardDb,
  type CardStats,
  type CardType,
  type ScaledValue,
} from '@arkham/engine';

/** Encounter set holding the sandbox scenario's own cards. */
export const SANDBOX_SET = 'sandbox';
/** A second, generic encounter set, so encounter deck building covers several sets. */
export const SANDBOX_HAZARDS_SET = 'sandbox_hazards';

/**
 * Invented cards for the sandbox scenario. Codes start with `SB-` and names
 * are made up, so no real card data ends up in the repo; real ArkhamDB codes
 * are numeric and cannot collide.
 */
export const sandboxCardDefs: readonly CardStats[] = [
  agenda('SB-A1', 'Rising Unease', 1, 4),
  agenda('SB-A2', 'The Door Opens', 2, 6),
  act('SB-C1', 'Search the House', 1, 2),
  act('SB-C2', 'Seal the Door', 2, 3),
  location('SB-L1', 'Foyer', 1, 1),
  location('SB-L2', 'Library', 3, 2),
  location('SB-L3', 'Cellar', 2, 1),
  location('SB-L4', 'Attic', 2, 2),
  location('SB-L5', 'Garden', 1, 1),
  { ...location('SB-L6', 'Hidden Crypt', 4, 3), clues: fixed(3) },
  enemy('SB-E1', 'Sandbox Ghoul', 3, { fight: 2, evade: 2, health: 2, damage: 1, horror: 1 }),
  enemy('SB-E2', 'Sandbox Stalker', 2, { fight: 3, evade: 2, health: 3, damage: 1, horror: 0 }),
  enemy('SB-E3', 'Sandbox Lurker', 1, { fight: 2, evade: 3, health: 3, damage: 0, horror: 1 }),
  {
    ...enemy('SB-E4', 'Sandbox Horror', 1, {
      fight: 4,
      evade: 3,
      health: 3,
      damage: 2,
      horror: 2,
    }),
    traits: [trait('Monster'), trait('Elite')],
    health: perInvestigator(3),
    victory: 2,
  },
  treachery('SB-T1', 'Creeping Dread', SANDBOX_SET, 2),
  treachery('SB-T2', 'Sudden Chill', SANDBOX_HAZARDS_SET, 3),
  treachery('SB-T3', 'Rotten Floor', SANDBOX_HAZARDS_SET, 2),
];

/** Card data for the sandbox scenario; put it in the `EngineContext` to play it. */
export const sandboxCards: CardDb = cardDbFrom(sandboxCardDefs);

function agenda(code: string, name: string, stage: number, doom: number): CardStats {
  return { ...scenarioCard(code, name, 'agenda'), stage: { number: stage }, doom: fixed(doom) };
}

function act(code: string, name: string, stage: number, clues: number): CardStats {
  return {
    ...scenarioCard(code, name, 'act'),
    stage: { number: stage },
    clues: perInvestigator(clues),
  };
}

function location(code: string, name: string, shroud: number, clues: number): CardStats {
  return { ...scenarioCard(code, name, 'location'), shroud, clues: perInvestigator(clues) };
}

/** Combat stats of an enemy, as printed; `health` is a fixed value. */
type EnemyStats = Required<Pick<CardStats, 'fight' | 'evade' | 'damage' | 'horror'>> & {
  health: number;
};

function enemy(code: string, name: string, quantity: number, stats: EnemyStats): CardStats {
  return {
    ...scenarioCard(code, name, 'enemy'),
    traits: [trait('Monster')],
    quantity,
    ...stats,
    health: fixed(stats.health),
  };
}

function treachery(code: string, name: string, set: string, quantity: number): CardStats {
  return { code, name, typeCode: 'treachery', traits: [], encounterCode: set, quantity };
}

/** A single-copy card of the sandbox encounter set. */
function scenarioCard(code: string, name: string, typeCode: CardType): CardStats {
  return { code, name, typeCode, traits: [], encounterCode: SANDBOX_SET, quantity: 1 };
}

/** A printed value that does not scale with the player count. */
function fixed(value: number): ScaledValue {
  return { fixed: value, perInvestigator: 0 };
}

/** A printed "n per investigator" value. */
function perInvestigator(value: number): ScaledValue {
  return { fixed: 0, perInvestigator: value };
}
