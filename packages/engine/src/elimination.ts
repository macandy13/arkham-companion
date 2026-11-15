import type { EngineContext } from './cards';
import { arrivalEngagements } from './engagement';
import { decisionId } from './ids';
import { requestDecision } from './decisions';
import type {
  ChaosTokenReleased,
  DecisionWithdrawn,
  Event,
  InvestigatorChanged,
  InvestigatorDefeated,
  InvestigatorResigned,
} from './events';
import { replay } from './reducer';
import {
  activeInvestigators,
  cluesToLocationEvents,
  defeatCause,
  isActiveInvestigator,
  withStatDelta,
} from './investigators';
import { cardsInZone, requireCard } from './lookup';
import { discardEncounterCard, moveCardEvent } from './placement';
import type { GameState, Investigator } from './state';

/** Id of the decision that asks the group for a new lead investigator. */
const NEW_LEAD_DECISION = decisionId('newLeadInvestigator');

/**
 * Everything that follows an investigator leaving the scenario, in the order
 * the Rules Reference gives it ("Investigator Elimination"):
 *
 * 1. `left` itself (`InvestigatorDefeated` or `InvestigatorResigned`).
 * 2. Their clues are placed on their location, enemies engaged with them stay
 *    at that location unengaged (keeping damage and exhaustion), cards in
 *    their threat area are discarded, cards they control are removed from
 *    the game and the tokens sealed on those cards go back into the chaos bag.
 * 3. The enemies left unengaged engage another investigator at that location,
 *    as any ready unengaged enemy does (Rules Reference, "Enemy Engagement").
 * 4. If nobody is left, the scenario ends without a resolution.
 * 5. If they were the lead investigator, the group picks a new one: not here
 *    but in a `newLeadInvestigator` step (`newLeadInvestigatorEvents`) that `triggeredSteps`
 *    queues after the departure, so an effect on several investigators
 *    ("each investigator … is defeated") applies to all of them first. A question for a new lead
 *    already open when another investigator leaves is withdrawn and asked again here
 *    (`reaskedNewLead`).
 *
 * All callers (damage, horror, resign) share this one function, so every way
 * out of the scenario leaves the same board. `state` is the state before
 * `left`; the clean-up reads what the investigator holds from it, which no
 * event that precedes the departure (damage, horror) changes.
 */
export function investigatorLeavesEvents(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  left: InvestigatorDefeated | InvestigatorResigned,
): Event[] {
  const events: Event[] = [
    left,
    ...clueEvents(investigator),
    ...engagedEnemyEvents(ctx, state, investigator),
    ...threatAreaEvents(ctx, state, investigator),
    ...sealedTokenEvents(state, investigator),
    ...controlledCardEvents(state, investigator),
  ];
  const cleared = replay(events, state);
  const engagements =
    investigator.locationId === undefined
      ? []
      : arrivalEngagements(ctx, cleared, investigator.locationId);
  const after = replay(engagements, cleared);
  const nobodyLeft = activeInvestigators(after).length === 0;
  if (nobodyLeft) return [...events, ...engagements, { type: 'ScenarioEnded' }];
  return [...events, ...engagements, ...reaskedNewLead(after)];
}

/**
 * The open question for a new lead asked again once another investigator has left too, so it
 * offers only those still in (or makes the one left the lead): its options were fixed when it was
 * asked, and answering it with someone who has left since would be refused.
 */
function reaskedNewLead(state: GameState): Event[] {
  if (!state.pending.some(({ id }) => id === NEW_LEAD_DECISION)) return [];
  const withdrawn: DecisionWithdrawn = { type: 'DecisionWithdrawn', decisionId: NEW_LEAD_DECISION };
  return [withdrawn, ...newLeadInvestigatorEvents(replay([withdrawn], state))];
}

/**
 * `damage` and `horror` placed on an investigator at once (Rules Reference,
 * "Dealing Damage/Horror": placed simultaneously): an `InvestigatorChanged`
 * per amount above 0, then `beforeDefeat` (an attack's `EnemyAttacked`), then the
 * defeat both together cause, if any. Neither amount is lost to a defeat the
 * other causes, unlike two effects in a row. Amounts are checked by callers.
 */
export function woundEvents(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  amounts: { damage: number; horror: number },
  beforeDefeat: readonly Event[] = [],
): Event[] {
  const changes: InvestigatorChanged[] = (['damage', 'horror'] as const)
    .filter((stat) => amounts[stat] > 0)
    .map((stat) => ({
      type: 'InvestigatorChanged',
      investigatorId: investigator.id,
      stat,
      delta: amounts[stat],
    }));
  const after = changes.reduce(
    (inv, change) => withStatDelta(inv, change.stat, change.delta),
    investigator,
  );
  const cause = defeatCause(after);
  if (cause === undefined) return [...changes, ...beforeDefeat];
  return [
    ...changes,
    ...beforeDefeat,
    ...investigatorLeavesEvents(ctx, state, investigator, {
      type: 'InvestigatorDefeated',
      investigatorId: investigator.id,
      cause,
    }),
  ];
}

/** Clues move to the location they were found at, where the remaining investigators can discover them. */
function clueEvents(investigator: Investigator): Event[] {
  if (investigator.clues === 0 || investigator.locationId === undefined) return [];
  return cluesToLocationEvents(investigator.id, investigator.locationId, investigator.clues);
}

/**
 * Engaged enemies stay where the investigator was; a massive enemy was never
 * engaged, so it is not touched. An investigator without a location (not yet
 * placed, or removed by a card effect) leaves their enemies nowhere to stay,
 * and an unengaged enemy must be at a location, so they are discarded.
 */
function engagedEnemyEvents(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): Event[] {
  const { locationId } = investigator;
  const engaged = cardsInZone(state, { kind: 'engaged', investigatorId: investigator.id });
  if (locationId === undefined)
    return engaged.flatMap((enemyId) => discardEncounterCard(ctx, state, enemyId));
  return engaged.map((enemyId) => ({ type: 'EnemyDisengaged', enemyId, locationId }));
}

/** Threat-area cards are discarded like any card leaving play (`discardEncounterCard`). */
function threatAreaEvents(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): Event[] {
  return cardsInZone(state, { kind: 'threatArea', investigatorId: investigator.id }).flatMap(
    (cardId) => discardEncounterCard(ctx, state, cardId),
  );
}

/**
 * Tokens sealed on the cards they control go back into the bag: those cards leave play with them,
 * and a sealed token is released when its card leaves play (Rules Reference, "Seal").
 */
function sealedTokenEvents(state: GameState, investigator: Investigator): ChaosTokenReleased[] {
  return state.sealedTokens
    .filter((sealed) => sealed.investigatorId === investigator.id)
    .map(({ token }) => ({ type: 'ChaosTokenReleased', token, investigatorId: investigator.id }));
}

/**
 * Cards they control leave with them: "cards they control … are removed from the game" (Rules
 * Reference, "Investigator Elimination"), so a story asset like Lita Chantler doesn't stay behind
 * for the others to take.
 */
function controlledCardEvents(state: GameState, investigator: Investigator): Event[] {
  return cardsInZone(state, { kind: 'playArea', investigatorId: investigator.id }).map((cardId) =>
    moveCardEvent(requireCard(state.cards, cardId), { kind: 'outOfGame' }),
  );
}

/**
 * A new lead investigator when the lead has left the scenario (the
 * `newLeadInvestigator` step): a single remaining investigator becomes lead without
 * a question; with several, the group chooses (`SetLeadInvestigator`). A
 * decision is used rather than the next in seat order because the rules let
 * the players choose. Nothing while the lead is still in, or once nobody is
 * left (the scenario has ended).
 */
export function newLeadInvestigatorEvents(state: GameState): Event[] {
  const lead = state.meta.leadInvestigator;
  if (lead !== undefined && isActiveInvestigator(state, lead)) return [];
  const remaining = activeInvestigators(state);
  const [only, ...others] = remaining;
  if (only === undefined) return [];
  if (others.length === 0) return [{ type: 'LeadInvestigatorChanged', investigatorId: only.id }];
  return requestDecision(state, {
    id: NEW_LEAD_DECISION,
    kind: 'chooseInvestigator',
    prompt: 'decision.chooseLeadInvestigator',
    decider: { kind: 'group' },
    options: remaining.map((inv) => ({
      id: inv.id,
      label: inv.name,
      target: inv.id,
      commands: [{ type: 'SetLeadInvestigator', investigatorId: inv.id }],
    })),
  });
}
