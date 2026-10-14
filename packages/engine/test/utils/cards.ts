import { cardDbFrom, trait, type CardStats, type EngineContext } from '../../src/index';

/**
 * A card definition with boring defaults (a trait-less treachery named after
 * its code); tests pass only the fields they assert on.
 */
export function makeCard(overrides: Partial<CardStats> & { code: string }): CardStats {
  return { name: overrides.code, typeCode: 'treachery', traits: [], ...overrides };
}

/** An engine context whose card db holds exactly `cards`. */
export function contextWith(...cards: CardStats[]): EngineContext {
  return { cards: cardDbFrom(cards) };
}

/**
 * Invented card definitions for engine tests that need *some* known cards
 * but no particular stats (`L*` locations, `E*` encounter cards, `A*`
 * agendas, `C*` acts). Tests that assert on a stat build their own cards
 * with `makeCard` and `contextWith`, so the value stays visible in the test.
 */
export const testCardDefs: readonly CardStats[] = [
  makeCard({ code: 'A1', typeCode: 'agenda', stage: { number: 1 }, doom: fixed(3) }),
  makeCard({ code: 'A2', typeCode: 'agenda', stage: { number: 2 }, doom: fixed(5) }),
  makeCard({ code: 'C1', typeCode: 'act', stage: { number: 1 }, clues: perInvestigator(2) }),
  makeCard({ code: 'C2', typeCode: 'act', stage: { number: 2 }, clues: perInvestigator(3) }),
  makeCard({ code: 'L1', typeCode: 'location', shroud: 2, clues: perInvestigator(1) }),
  makeCard({ code: 'L2', typeCode: 'location', shroud: 3, clues: perInvestigator(2) }),
  makeCard({ code: 'L3', typeCode: 'location', shroud: 1, clues: fixed(1) }),
  makeCard({
    code: 'E1',
    typeCode: 'enemy',
    traits: [trait('Monster')],
    fight: 2,
    evade: 2,
    health: fixed(3),
    damage: 1,
    horror: 1,
  }),
  makeCard({
    code: 'E2',
    typeCode: 'enemy',
    traits: [trait('Monster'), trait('Elite')],
    fight: 4,
    evade: 3,
    health: perInvestigator(2),
    damage: 2,
    horror: 2,
    victory: 1,
  }),
  makeCard({ code: 'E3', traits: [trait('Terror')] }),
  makeCard({ code: 'E4' }),
];

/** Engine context backed by `testCardDefs`; pass it to `handle`/`execute` in tests. */
export const testContext: EngineContext = { cards: cardDbFrom(testCardDefs) };

/** A printed value that does not scale with the player count. */
export function fixed(value: number) {
  return { fixed: value, perInvestigator: 0 };
}

/** A printed "n per investigator" value. */
export function perInvestigator(value: number) {
  return { fixed: 0, perInvestigator: value };
}
