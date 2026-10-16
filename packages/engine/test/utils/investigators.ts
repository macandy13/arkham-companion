import {
  investigatorId,
  type GameState,
  type Investigator,
  type InvestigatorId,
} from '../../src/index';

/**
 * An investigator with boring defaults (8 health, 6 sanity, 5 resources, no
 * clues, no extra actions, 3 actions left, seat 0, not placed); tests pass only what they depend on.
 */
export function makeInvestigator(
  overrides: Partial<Omit<Investigator, 'id'>> & { id: string },
): Investigator {
  return {
    code: overrides.id,
    name: overrides.id,
    seat: 0,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
    clues: 0,
    resources: 5,
    doomOnPlayerCards: 0,
    extraActions: 0,
    actionsRemaining: 3,
    status: 'active',
    ...overrides,
    id: investigatorId(overrides.id),
  };
}

/**
 * Four invented investigators with distinct health and sanity, so tests about
 * prey, defeat or seat order can tell them apart. Codes start with `INV-`.
 * `investigators(n)` takes the first `n` in seat order.
 */
export const standardInvestigators: readonly Investigator[] = [
  makeInvestigator({
    id: 'tank',
    code: 'INV-1',
    seat: 0,
    health: { max: 9, damage: 0 },
    sanity: { max: 5, horror: 0 },
  }),
  makeInvestigator({
    id: 'seeker',
    code: 'INV-2',
    seat: 1,
    health: { max: 6, damage: 0 },
    sanity: { max: 9, horror: 0 },
  }),
  makeInvestigator({
    id: 'rogue',
    code: 'INV-3',
    seat: 2,
    health: { max: 7, damage: 0 },
    sanity: { max: 7, horror: 0 },
  }),
  makeInvestigator({
    id: 'mystic',
    code: 'INV-4',
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

/** The investigator with `id` in `state` (fails the test if there is none). */
export function investigatorOf(state: GameState, id: InvestigatorId | string): Investigator {
  const found = state.investigators.find((inv) => inv.id === id);
  if (!found) throw new Error(`no investigator ${id}`);
  return found;
}
