import {
  blankInvestigator,
  investigatorCardStats,
  type BlankInvestigatorFields,
  type CardStats,
  type GameState,
  type Investigator,
  type InvestigatorId,
  type InvestigatorSeat,
} from '../../src/index';

/**
 * `blankInvestigator` with the ID among the fields, the form the tests not yet
 * built with `newGame()` use; M1V.3 slice 4 removes it.
 */
export function makeInvestigator({
  id,
  ...fields
}: BlankInvestigatorFields & { id: string }): Investigator {
  return blankInvestigator(id, fields);
}

/**
 * Four invented investigators with distinct health and sanity, so tests about
 * prey, defeat or seat order can tell them apart. Each one's card code is its ID.
 * `investigators(n)` takes the first `n` in seat order.
 */
export const standardInvestigators: readonly Investigator[] = [
  makeInvestigator({
    id: 'tank',
    seat: 0,
    health: { max: 9, damage: 0 },
    sanity: { max: 5, horror: 0 },
  }),
  makeInvestigator({
    id: 'seeker',
    seat: 1,
    health: { max: 6, damage: 0 },
    sanity: { max: 9, horror: 0 },
  }),
  makeInvestigator({
    id: 'rogue',
    seat: 2,
    health: { max: 7, damage: 0 },
    sanity: { max: 7, horror: 0 },
  }),
  makeInvestigator({
    id: 'mystic',
    seat: 3,
    health: { max: 5, damage: 0 },
    sanity: { max: 8, horror: 0 },
  }),
];

/** The first `count` (1–4) standard investigators, lead investigator first. */
export function investigators(count: number): Investigator[] {
  if (count < 1 || count > standardInvestigators.length)
    throw new RangeError(`expected 1–4 investigators, got ${count}`);
  return standardInvestigators.slice(0, count);
}

/** The standard investigators' cards, so `compileSetup` can seat them; in `testContext` and `contextWith`. */
export const standardInvestigatorCards: readonly CardStats[] = standardInvestigators.map((inv) =>
  investigatorCardStats({
    code: inv.code,
    name: inv.name,
    health: inv.health.max,
    sanity: inv.sanity.max,
    skills: inv.skills,
  }),
);

/** Seats for the first `count` (1–4) standard investigators, lead investigator first. */
export function investigatorSeats(count: number): InvestigatorSeat[] {
  return investigators(count).map(({ id, code }) => ({ id, code }));
}

/** The investigator with `id` in `state` (fails the test if there is none). */
export function investigatorOf(state: GameState, id: InvestigatorId | string): Investigator {
  const found = state.investigators.find((inv) => inv.id === id);
  if (!found) throw new Error(`no investigator ${id}`);
  return found;
}
