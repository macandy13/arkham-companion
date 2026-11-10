import type { EngineContext } from './cards';
import type { ClueSpend } from './commands';
import type { CluesDiscovered, DefeatCause, InvestigatorChanged, TokensChanged } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import { CommandRejected } from './rejection';
import { isRestrictedFor } from './restrictions';
import type { GameState, Investigator, InvestigatorStat, SkillName, SkillValues } from './state';

/** Health the investigator has left; 0 or less means they are defeated. */
export function remainingHealth(investigator: Investigator): number {
  return investigator.health.max - investigator.health.damage;
}

/** Sanity the investigator has left; 0 or less means they are defeated. */
export function remainingSanity(investigator: Investigator): number {
  return investigator.sanity.max - investigator.sanity.horror;
}

/**
 * What defeats the investigator right now, or `undefined` while they still
 * have health and sanity; `damageAndHorror` when both ran out, which only
 * damage and horror placed at once can do (`woundEvents`).
 */
export function defeatCause(
  investigator: Investigator,
): Exclude<DefeatCause, 'cardEffect'> | undefined {
  const outOfHealth = remainingHealth(investigator) <= 0;
  const outOfSanity = remainingSanity(investigator) <= 0;
  if (outOfHealth && outOfSanity) return 'damageAndHorror';
  if (outOfHealth) return 'damage';
  if (outOfSanity) return 'horror';
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
 * A copy of the investigator with each given counter set to an absolute value,
 * e.g. `withStats(investigator, { damage: 2, horror: 1 })`; counters left out
 * keep their value. Expressed as `withStatDelta` steps, so it changes state the
 * same way the reducer does and does no clamping or validation of its own: like
 * the reducer, it can produce a negative counter, and rejecting those is the
 * command handler's job. Mainly for building states in tests and scenario setup.
 *
 * `health.max` and `sanity.max` are not tracked stats (no event adjusts them)
 * and are not covered; set them when constructing the investigator.
 */
export function withStats(
  investigator: Investigator,
  values: Readonly<Partial<Record<InvestigatorStat, number>>>,
): Investigator {
  // Object.entries widens the keys to string; the Partial<Record<…>> type guarantees they are stats.
  const entries = Object.entries(values) as [InvestigatorStat, number | undefined][];
  return entries.reduce(
    (current, [stat, value]) =>
      value === undefined
        ? current
        : withStatDelta(current, stat, value - statValue(current, stat)),
    investigator,
  );
}

/**
 * `investigator`'s skill values with their lasting boosts (`Investigator.skillBoosts`) added to
 * the printed ones: what Prey compares and what the investigator card shows. A skill test shows
 * the boost as a step of its own instead (`skillTestSuggestion`).
 */
export function boostedSkills(
  investigator: Pick<Investigator, 'skills' | 'skillBoosts'>,
): SkillValues {
  const { skills, skillBoosts } = investigator;
  const boosted = (skill: SkillName) => skills[skill] + (skillBoosts?.[skill] ?? 0);
  return {
    willpower: boosted('willpower'),
    intellect: boosted('intellect'),
    combat: boosted('combat'),
    agility: boosted('agility'),
  };
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

/** `amount` clues go from `locationId` to the investigator, as `DiscoverClues` does. */
export function discoverCluesEvents(
  investigatorId: InvestigatorId,
  locationId: InstanceId,
  amount: number,
): [TokensChanged, InvestigatorChanged, CluesDiscovered] {
  return [
    { type: 'TokensChanged', cardId: locationId, token: 'clue', delta: -amount },
    { type: 'InvestigatorChanged', investigatorId, stat: 'clues', delta: amount },
    { type: 'CluesDiscovered', investigatorId, locationId, amount },
  ];
}

/** The reverse of `discoverCluesEvents`: `amount` of the investigator's clues go onto `locationId`. */
export function cluesToLocationEvents(
  investigatorId: InvestigatorId,
  locationId: InstanceId,
  amount: number,
): [InvestigatorChanged, TokensChanged] {
  return [
    { type: 'InvestigatorChanged', investigatorId, stat: 'clues', delta: -amount },
    { type: 'TokensChanged', cardId: locationId, token: 'clue', delta: amount },
  ];
}

/** The investigator with `id`, in any status; `undefined` for an unknown ID. */
export function findInvestigator(state: GameState, id: InvestigatorId): Investigator | undefined {
  return state.investigators.find((inv) => inv.id === id);
}

/** The investigators still in the scenario (not defeated or resigned), in seat order. */
export function activeInvestigators(state: GameState): Investigator[] {
  return state.investigators.filter((inv) => inv.status === 'active');
}

/**
 * The clues the active investigators hold between them, which they may spend as a group (a
 * `groupClues` cost, the act's `advanceBySpendingClues`). The clues of an investigator a card
 * forbids to spend clues (`isRestrictedFor`, The Masked Hunter) don't count.
 */
export function cluesHeldByGroup(ctx: EngineContext, state: GameState): number {
  return clueSpenders(ctx, state).reduce((sum, inv) => sum + inv.clues, 0);
}

/** The clues the investigators at `locationId` who may spend clues hold between them (`clueSpendersAt`). */
export function cluesHeldAt(ctx: EngineContext, state: GameState, locationId: InstanceId): number {
  return clueSpendersAt(ctx, state, locationId).reduce((sum, inv) => sum + inv.clues, 0);
}

/**
 * The investigators who may spend clues as a group at `locationId` ("investigators in the
 * Hallway", The Barrier): the `clueSpenders` there, or all of them without a location.
 */
export function clueSpendersAt(
  ctx: EngineContext,
  state: GameState,
  locationId: InstanceId | undefined,
): Investigator[] {
  return clueSpenders(ctx, state).filter(
    (inv) => locationId === undefined || inv.locationId === locationId,
  );
}

/** The active investigators no card forbids to spend clues, in seat order. */
export function clueSpenders(ctx: EngineContext, state: GameState): Investigator[] {
  return activeInvestigators(state).filter(
    (inv) => !isRestrictedFor(ctx, state, inv.id, 'spend', 'clues'),
  );
}

/** Whether `id` names an investigator still in the scenario (not defeated or resigned). */
export function isActiveInvestigator(state: GameState, id: InvestigatorId): boolean {
  return findInvestigator(state, id)?.status === 'active';
}

/** The investigator with `id`, in any status; rejects an unknown ID (`unknownInvestigator`). */
export function requireInvestigator(state: GameState, id: InvestigatorId): Investigator {
  const investigator = findInvestigator(state, id);
  if (!investigator) throw new CommandRejected({ code: 'unknownInvestigator', investigatorId: id });
  return investigator;
}

/** The investigator, rejecting unknown IDs and those who are no longer in the scenario. */
export function activeInvestigator(state: GameState, id: InvestigatorId): Investigator {
  const investigator = requireInvestigator(state, id);
  if (investigator.status !== 'active')
    throw new CommandRejected({ code: 'investigatorNotActive', investigatorId: id });
  return investigator;
}

/**
 * One `InvestigatorChanged` per payment of clues the investigators spend "as a group" (advancing
 * the act, Uncovering the Conspiracy's action): the payers choose who pays how many. Rejects a
 * payment that is not a whole number above 0, a payer listed twice, without that many clues or
 * forbidden to spend clues (`restrictedFor`), and payments that do not add up to `required`.
 */
export function groupCluePayments(
  ctx: EngineContext,
  state: GameState,
  spend: readonly ClueSpend[],
  required: number,
): InvestigatorChanged[] {
  const payers = new Set<InvestigatorId>();
  const payments = spend.map((payment): InvestigatorChanged => {
    if (!Number.isInteger(payment.amount) || payment.amount <= 0)
      throw new CommandRejected({ code: 'invalidTokenDelta', delta: payment.amount });
    const investigator = activeInvestigator(state, payment.investigatorId);
    if (payers.has(investigator.id))
      throw new CommandRejected({
        code: 'duplicateInvestigator',
        investigatorId: investigator.id,
      });
    payers.add(investigator.id);
    if (isRestrictedFor(ctx, state, investigator.id, 'spend', 'clues'))
      throw new CommandRejected({
        code: 'restrictedFor',
        cannot: 'spend',
        what: 'clues',
        investigatorId: investigator.id,
      });
    if (investigator.clues < payment.amount)
      throw new CommandRejected({
        code: 'negativeInvestigatorStat',
        investigatorId: investigator.id,
        stat: 'clues',
        current: investigator.clues,
        delta: -payment.amount,
      });
    return {
      type: 'InvestigatorChanged',
      investigatorId: investigator.id,
      stat: 'clues',
      delta: -payment.amount,
    };
  });
  const spent = spend.reduce((sum, payment) => sum + payment.amount, 0);
  if (spent !== required) throw new CommandRejected({ code: 'wrongClueTotal', required, spent });
  return payments;
}

/**
 * A group payment of `required` clues when the players name no payers: `first` pays all they
 * can, then the other active investigators in seat order (or only those `among`, `clueSpendersAt`),
 * leaving out those a card forbids to spend clues. The players change it by naming the payers (`UseCardAction.spend`); the app has
 * no way to name them yet (#488).
 */
export function defaultCluePayments(
  ctx: EngineContext,
  state: GameState,
  first: InvestigatorId | undefined,
  required: number,
  among: readonly Investigator[] = clueSpenders(ctx, state),
): ClueSpend[] {
  const payers = [...among].sort((a, b) => Number(b.id === first) - Number(a.id === first));
  let left = required;
  return payers.flatMap((investigator) => {
    const amount = Math.min(left, investigator.clues);
    left -= amount;
    return amount > 0 ? [{ investigatorId: investigator.id, amount }] : [];
  });
}
