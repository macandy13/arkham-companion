import { cardStats, resolveValue, type EngineContext } from './cards';
import type { DecisionRequested, Event } from './events';
import { decisionId } from './ids';
import { replay } from './reducer';
import type { CardInstance, GameState } from './state';

/**
 * Whether a card is in play, i.e. part of the table that doom is counted on:
 * on a map, at a location, engaged, in a threat area, or attached to a card in
 * play. Of the agenda and act decks only the current card is in play. Defined
 * by zone alone because the state stores no card types.
 */
export function isInPlay(state: GameState, card: CardInstance): boolean {
  const zone = card.zone;
  switch (zone.kind) {
    case 'location':
    case 'engaged':
    case 'threatArea':
      return true;
    case 'agendaDeck':
      return state.agenda.current === card.id;
    case 'actDeck':
      return state.act.current === card.id;
    case 'atLocation':
    case 'attachedTo': {
      const host = state.cards[zone.kind === 'atLocation' ? zone.locationId : zone.hostId];
      // Hosting cycles are rejected when cards are placed, so the recursion ends.
      return host !== undefined && isInPlay(state, host);
    }
    default:
      return false;
  }
}

/** Cards in play that carry doom, including the current agenda. */
export function cardsWithDoom(state: GameState): CardInstance[] {
  return Object.values(state.cards).filter(
    (card) => (card.tokens.doom ?? 0) > 0 && isInPlay(state, card),
  );
}

/**
 * Doom the threshold is compared with: on the agenda and every other card in
 * play plus the players' doom counters. Only active investigators count -
 * a defeated or resigned investigator's cards are no longer in play.
 */
export function doomInPlay(state: GameState): number {
  const onCards = cardsWithDoom(state).reduce((sum, card) => sum + (card.tokens.doom ?? 0), 0);
  const onPlayerCards = state.investigators
    .filter((inv) => inv.status === 'active')
    .reduce((sum, inv) => sum + inv.doomOnPlayerCards, 0);
  return onCards + onPlayerCards;
}

/**
 * Asks whether to advance the agenda when the doom total has reached its
 * threshold. A single pending question per agenda is enough, so nothing is
 * emitted while one is open. The check runs after doom is placed; the phase
 * assistant (M1.10) decides when the rules actually allow advancing.
 */
export function agendaThresholdDecision(state: GameState, ctx: EngineContext): DecisionRequested[] {
  const agenda = state.agenda.current === undefined ? undefined : state.cards[state.agenda.current];
  if (!agenda) return [];
  const printed = cardStats(ctx.cards, agenda.code).doom;
  if (printed === undefined || doomInPlay(state) < resolveValue(printed, state.meta.playerCount))
    return [];
  const id = decisionId(`advanceAgenda:${agenda.id}`);
  if (state.pending.some((decision) => decision.id === id)) return [];
  return [
    {
      type: 'DecisionRequested',
      decision: {
        id,
        kind: 'advanceAgenda',
        subject: agenda.id,
        prompt: 'decision.advanceAgenda',
        options: [
          { id: 'yes', label: 'decision.yes', target: agenda.id },
          { id: 'no', label: 'decision.no' },
        ],
      },
    },
  ];
}

/** `events` followed by the agenda question if they brought the doom total to the threshold. */
export function withAgendaCheck(state: GameState, events: Event[], ctx: EngineContext): Event[] {
  return [...events, ...agendaThresholdDecision(replay(events, state), ctx)];
}
