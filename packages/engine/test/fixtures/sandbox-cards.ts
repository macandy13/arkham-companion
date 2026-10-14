import { cardDbFrom, trait, type CardStats, type EngineContext } from '../../src/index';

/**
 * Fake card definitions shared by all engine tests (and later the sandbox
 * scenario). Codes and names are invented so no real card data ends up in the
 * repo. Tests that assert on a specific stat should build a local `CardDb`
 * with `cardDbFrom` instead, so the value stays visible in the test.
 */
export const sandboxCardDefs: readonly CardStats[] = [
  {
    code: 'A1',
    name: 'Sandbox Agenda 1',
    typeCode: 'agenda',
    traits: [],
    stage: { number: 1 },
    doom: { fixed: 3, perInvestigator: 0 },
  },
  {
    code: 'A2',
    name: 'Sandbox Agenda 2',
    typeCode: 'agenda',
    traits: [],
    stage: { number: 2 },
    doom: { fixed: 5, perInvestigator: 0 },
  },
  {
    code: 'C1',
    name: 'Sandbox Act 1',
    typeCode: 'act',
    traits: [],
    stage: { number: 1 },
    clues: { fixed: 0, perInvestigator: 2 },
  },
  {
    code: 'C2',
    name: 'Sandbox Act 2',
    typeCode: 'act',
    traits: [],
    stage: { number: 2 },
    clues: { fixed: 0, perInvestigator: 3 },
  },
  {
    code: 'C2c',
    name: 'Sandbox Act 2 (Alternative)',
    typeCode: 'act',
    traits: [],
    stage: { number: 2, variant: 'c' },
    clues: { fixed: 1, perInvestigator: 1 },
  },
  {
    code: 'L1',
    name: 'Sandbox Hall',
    typeCode: 'location',
    traits: [],
    shroud: 2,
    clues: { fixed: 0, perInvestigator: 1 },
  },
  {
    code: 'L2',
    name: 'Sandbox Cellar',
    typeCode: 'location',
    traits: [],
    shroud: 3,
    clues: { fixed: 0, perInvestigator: 2 },
  },
  {
    code: 'L3',
    name: 'Sandbox Attic',
    typeCode: 'location',
    traits: [],
    shroud: 1,
    clues: { fixed: 1, perInvestigator: 0 },
  },
  {
    code: 'E1',
    name: 'Sandbox Ghoul',
    typeCode: 'enemy',
    traits: [trait('Monster')],
    fight: 2,
    evade: 2,
    health: { fixed: 3, perInvestigator: 0 },
    damage: 1,
    horror: 1,
  },
  {
    code: 'E2',
    name: 'Sandbox Horror',
    typeCode: 'enemy',
    traits: [trait('Monster'), trait('Elite')],
    fight: 4,
    evade: 3,
    health: { fixed: 2, perInvestigator: 2 },
    damage: 2,
    horror: 2,
    victory: 1,
  },
  { code: 'E3', name: 'Sandbox Dread', typeCode: 'treachery', traits: [trait('Terror')] },
  { code: 'E4', name: 'Sandbox Mishap', typeCode: 'treachery', traits: [] },
];

/** Codes of all sandbox cards, e.g. for property tests that pick arbitrary cards. */
export const sandboxCodes: readonly string[] = sandboxCardDefs.map((def) => def.code);

/** Engine context backed by the sandbox cards; pass it to `handle`/`execute` in tests. */
export const sandboxContext: EngineContext = { cards: cardDbFrom(sandboxCardDefs) };
