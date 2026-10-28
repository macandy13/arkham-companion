import { resolveValue, type EngineContext } from './cards';
import type { DecisionRequested } from './events';
import { confirmOptions, requestDecision } from './decisions';
import { decisionId } from './ids';
import { activeInvestigators } from './investigators';
import { currentCard } from './lookup';
import type { CardInstance, GameState } from './state';

/**
 * Whether a card is in play, i.e. part of the table that doom is counted on:
 * on a map, at a location, engaged, in a threat area or play area, or attached to a card in
 * play. Of the agenda and act decks only the current card is in play. Defined
 * by zone alone because the state stores no card types.
 */
export function isInPlay(state: GameState, card: CardInstance): boolean {
  const zone = card.zone;
  switch (zone.kind) {
    case 'location':
    case 'engaged':
    case 'threatArea':
    case 'playArea':
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

/** Every card in play (`isInPlay`), in card order; `cardsWithActiveAbilities` narrows it for windows. */
export function cardsInPlay(state: GameState): CardInstance[] {
  return Object.values(state.cards).filter((card) => isInPlay(state, card));
}

/**
 * Whether the card's printed abilities, modifiers and actions are active: all but an unrevealed
 * location's, which are printed on its revealed side (RR "Locations"). Its restrictions are kept
 * apart, as some are printed on the unrevealed side (`CardRestriction.unrevealed`).
 */
export function hasActiveAbilities(card: CardInstance): boolean {
  return card.zone.kind !== 'location' || card.faceUp;
}

/** The cards in play a window for "each card in play" opens for (`hasActiveAbilities`). */
export function cardsWithActiveAbilities(state: GameState): CardInstance[] {
  return cardsInPlay(state).filter(hasActiveAbilities);
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
  const onPlayerCards = activeInvestigators(state).reduce(
    (sum, inv) => sum + inv.doomOnPlayerCards,
    0,
  );
  return onCards + onPlayerCards;
}

/**
 * The doom `agenda` needs to advance, for this many players; none when it prints no
 * threshold. Face down, as act and agenda at once (The Devourer Below's Vengeance Awaits),
 * it shows its reverse side, which prints none, so its doom no longer advances it.
 */
export function agendaThreshold(
  ctx: EngineContext,
  state: GameState,
  agenda: CardInstance,
): number | undefined {
  const threshold = agenda.faceUp ? ctx.cards.get(agenda.code)?.doom : undefined;
  return threshold === undefined ? undefined : resolveValue(threshold, state.meta.playerCount);
}

/**
 * `CheckDoomThreshold`: asks to confirm advancing the agenda when the doom
 * total has reached its threshold. Rules Reference, "Agenda Deck": the agenda
 * then must advance, and this check (mythos phase, or a card that says so)
 * is the only time it can. Declining is not a rules option; the question is a
 * `confirm` only because the app tracks doom on the players' behalf: "no"
 * means "the app's doom count is wrong", to be corrected with `ManualAdjust`,
 * and the question comes back at the next check. A single pending question per
 * agenda is enough, so nothing is emitted while one is open.
 */
export function agendaThresholdDecision(ctx: EngineContext, state: GameState): DecisionRequested[] {
  const agenda = currentCard(state, 'agenda');
  const threshold = agenda && agendaThreshold(ctx, state, agenda);
  if (!agenda || threshold === undefined || doomInPlay(state) < threshold) return [];
  return requestDecision(state, {
    id: decisionId(`advanceAgenda:${agenda.id}`),
    kind: 'confirm',
    subject: agenda.id,
    prompt: 'decision.advanceAgenda',
    decider: { kind: 'group' },
    options: confirmOptions([{ type: 'AdvanceAgenda' }], agenda.id),
  });
}
