import type { EngineContext } from './cards';
import { arrivalEngagements } from './engagement';
import { decisionId } from './ids';
import { requestDecision } from './decisions';
import type { Event, InvestigatorDefeated, InvestigatorResigned } from './events';
import { replay } from './reducer';
import { cluesToLocationEvents } from './investigators';
import { cardsInZone } from './lookup';
import { discardEncounterCard } from './placement';
import type { GameState, Investigator } from './state';

/** Id of the decision that asks the group for a new lead investigator. */
const NEW_LEAD_DECISION = decisionId('newLeadInvestigator');

/**
 * Everything that follows an investigator leaving the scenario, in the order
 * the Rules Reference gives it ("Investigator Elimination"):
 *
 * 1. `left` itself (`InvestigatorDefeated` or `InvestigatorResigned`).
 * 2. Their clues are placed on their location, enemies engaged with them stay
 *    at that location unengaged (keeping damage and exhaustion), and cards in
 *    their threat area are discarded.
 * 3. The enemies left unengaged engage another investigator at that location,
 *    as any ready unengaged enemy does (Rules Reference, "Enemy Engagement").
 * 4. If they were the lead investigator, the group picks a new one.
 * 5. If nobody is left, the scenario ends without a resolution.
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
    ...engagedEnemyEvents(state, investigator),
    ...threatAreaEvents(state, investigator),
  ];
  const cleared = replay(events, state);
  const engagements =
    investigator.locationId === undefined
      ? []
      : arrivalEngagements(ctx, cleared, investigator.locationId);
  const after = replay(engagements, cleared);
  return [...events, ...engagements, ...successionEvents(after, investigator)];
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
function engagedEnemyEvents(state: GameState, investigator: Investigator): Event[] {
  const { locationId } = investigator;
  const engaged = cardsInZone(state, { kind: 'engaged', investigatorId: investigator.id });
  if (locationId === undefined)
    return engaged.flatMap((enemyId) => discardEncounterCard(state, enemyId));
  return engaged.map((enemyId) => ({ type: 'EnemyDisengaged', enemyId, locationId }));
}

/** Threat-area cards are encounter cards (player cards are not modelled), so they go to the encounter discard. */
function threatAreaEvents(state: GameState, investigator: Investigator): Event[] {
  return cardsInZone(state, { kind: 'threatArea', investigatorId: investigator.id }).flatMap(
    (cardId) => discardEncounterCard(state, cardId),
  );
}

/**
 * What the departure of `departed` makes necessary, given the state after the
 * clean-up. A single remaining investigator becomes lead without a question;
 * with several, the group chooses (`SetLeadInvestigator`). A decision is used
 * rather than the next in seat order because the rules let the players choose.
 */
function successionEvents(after: GameState, departed: Investigator): Event[] {
  const remaining = after.investigators.filter((inv) => inv.status === 'active');
  const [only, ...others] = remaining;
  if (only === undefined) return [{ type: 'ScenarioEnded' }];
  if (after.meta.leadInvestigator !== departed.id) return [];
  if (others.length === 0) return [{ type: 'LeadInvestigatorChanged', investigatorId: only.id }];
  return requestDecision(after, {
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
