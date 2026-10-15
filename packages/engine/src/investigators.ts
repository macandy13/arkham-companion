import type { GameState, Investigator, InvestigatorStat } from './state';

/** Health the investigator has left; 0 or less means they are defeated. */
export function remainingHealth(investigator: Investigator): number {
  return investigator.health.max - investigator.health.damage;
}

/** Sanity the investigator has left; 0 or less means they are defeated. */
export function remainingSanity(investigator: Investigator): number {
  return investigator.sanity.max - investigator.sanity.horror;
}

/** What defeats the investigator right now, or `undefined` while they still have health and sanity. */
export function defeatCause(investigator: Investigator): 'damage' | 'horror' | undefined {
  if (remainingHealth(investigator) <= 0) return 'damage';
  if (remainingSanity(investigator) <= 0) return 'horror';
  return undefined;
}

/** Current value of one counter; damage and horror are stored inside `health` and `sanity`. */
export function statValue(investigator: Investigator, stat: InvestigatorStat): number {
  switch (stat) {
    case 'damage':
      return investigator.health.damage;
    case 'horror':
      return investigator.sanity.horror;
    case 'clues':
      return investigator.clues;
    case 'resources':
      return investigator.resources;
    case 'doomOnPlayerCards':
      return investigator.doomOnPlayerCards;
  }
}

/**
 * A copy of the investigator with one counter changed by `delta`. Shared by the
 * reducer and by `handle`, which uses it to ask `defeatCause` about the outcome
 * before emitting events.
 */
export function withStatDelta(
  investigator: Investigator,
  stat: InvestigatorStat,
  delta: number,
): Investigator {
  switch (stat) {
    case 'damage':
      return {
        ...investigator,
        health: { ...investigator.health, damage: investigator.health.damage + delta },
      };
    case 'horror':
      return {
        ...investigator,
        sanity: { ...investigator.sanity, horror: investigator.sanity.horror + delta },
      };
    case 'clues':
      return { ...investigator, clues: investigator.clues + delta };
    case 'resources':
      return { ...investigator, resources: investigator.resources + delta };
    case 'doomOnPlayerCards':
      return { ...investigator, doomOnPlayerCards: investigator.doomOnPlayerCards + delta };
  }
}

/**
 * Prey criterion "lowest remaining health" (architecture §5). The prey helpers
 * return every active investigator tied for the extreme, in the order given,
 * because the players, not the engine, break ties (M1.8/M1.9). Defeated and
 * resigned investigators never count; the result is empty if none is active.
 */
export function lowestRemainingHealth(investigators: readonly Investigator[]): Investigator[] {
  return tiedFor(investigators, remainingHealth, 'lowest');
}

/** Prey "lowest remaining sanity"; see `lowestRemainingHealth` for tie handling. */
export function lowestRemainingSanity(investigators: readonly Investigator[]): Investigator[] {
  return tiedFor(investigators, remainingSanity, 'lowest');
}

/** Prey "most clues"; see `lowestRemainingHealth` for tie handling. */
export function mostClues(investigators: readonly Investigator[]): Investigator[] {
  return tiedFor(investigators, (inv) => inv.clues, 'highest');
}

/** Prey "most resources"; see `lowestRemainingHealth` for tie handling. */
export function mostResources(investigators: readonly Investigator[]): Investigator[] {
  return tiedFor(investigators, (inv) => inv.resources, 'highest');
}

function tiedFor(
  investigators: readonly Investigator[],
  value: (investigator: Investigator) => number,
  extreme: 'lowest' | 'highest',
): Investigator[] {
  const active = investigators.filter((inv) => inv.status === 'active');
  if (active.length === 0) return [];
  const values = active.map(value);
  const best = extreme === 'lowest' ? Math.min(...values) : Math.max(...values);
  return active.filter((inv) => value(inv) === best);
}

/**
 * The active investigators in player order: by seat, starting with the lead
 * investigator (Rules Reference, "Player Order").
 */
export function playerOrder(state: GameState): Investigator[] {
  const seated = [...state.investigators].sort((a, b) => a.seat - b.seat);
  const lead = Math.max(
    0,
    seated.findIndex((inv) => inv.id === state.meta.leadInvestigator),
  );
  return [...seated.slice(lead), ...seated.slice(0, lead)].filter((inv) => inv.status === 'active');
}
