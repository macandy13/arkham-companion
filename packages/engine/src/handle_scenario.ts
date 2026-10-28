import type { AdvanceAct, AdvanceAgenda, EndScenario, PlaceDoom, PlaceTokens } from './commands';
import { cardsWithDoom, isInPlay } from './doom';
import { activeInvestigators } from './investigators';
import type {
  ActAdvanced,
  AgendaAdvanced,
  CardFlipped,
  CardMoved,
  CurrentCardChanged,
  Event,
  InvestigatorChanged,
  ScenarioEnded,
  TokensChanged,
} from './events';
import type { InstanceId, ResolutionId } from './ids';
import { requireCard } from './lookup';
import { resolveAmount } from './cards';
import { clearTokensEvents, moveCardEvent } from './placement';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, TokenKind } from './state';
import { zoneKey } from './zone';

type Deck = 'agenda' | 'act';

/** `PlaceDoom`: doom on a card in play; the current agenda unless the command names another. */
export function handlePlaceDoom(state: GameState, cmd: PlaceDoom): TokensChanged[] {
  const card =
    cmd.cardId === undefined ? currentCard(state, 'agenda') : requireCard(state.cards, cmd.cardId);
  return tokensPlaced(state, card, 'doom', cmd.amount);
}

/** `PlaceTokens`: tokens from the pool on a card in play. */
export function handlePlaceTokens(state: GameState, cmd: PlaceTokens): TokensChanged[] {
  const card = requireCard(state.cards, cmd.cardId);
  const { playerCount } = state.meta;
  if ('amount' in cmd)
    return tokensPlaced(state, card, cmd.token, resolveAmount(cmd.amount, playerCount));
  const missing = resolveAmount(cmd.upTo, playerCount) - (card.tokens[cmd.token] ?? 0);
  return missing > 0 ? tokensPlaced(state, card, cmd.token, missing) : [];
}

function tokensPlaced(
  state: GameState,
  card: CardInstance,
  token: TokenKind,
  amount: number,
): TokensChanged[] {
  if (!Number.isInteger(amount) || amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: amount });
  if (!isInPlay(state, card)) throw new CommandRejected({ code: 'cardNotInPlay', cardId: card.id });
  return [{ type: 'TokensChanged', cardId: card.id, token, delta: amount }];
}

/**
 * `AdvanceAgenda`, first step: doom is cleared (the rules remove all doom in
 * play when an agenda advances) and the agenda turns to its reverse side,
 * staying current while that resolves; `completeAdvance` replaces it.
 */
export function handleAdvanceAgenda(state: GameState, cmd: AdvanceAgenda): Event[] {
  const flip = reverseSide(state, 'agenda', cmd.resolution);
  return [...doomRemoval(state), ...flip];
}

/**
 * `AdvanceAct`, first step: the act turns to its reverse side, and `completeAdvance` replaces it.
 * It pays nothing: an act's clues are the cost of its own `advanceBySpendingClues` action, whose
 * effect this is; an objective met or another card's effect advances it for free.
 */
export function handleAdvanceAct(state: GameState, cmd: AdvanceAct): Event[] {
  const act = currentCard(state, 'act');
  const flip = reverseSide(state, 'act', cmd.resolution);
  // Advancing removes the act's tokens (RR "Act Deck and Agenda Deck"), the clues on it included.
  return [...clearTokensEvents(act), ...flip];
}

/**
 * `AdvanceAgenda`/`AdvanceAct`, second step, which `handle` runs after the
 * forced effects of the first step: the advanced card leaves the game and the
 * next card becomes current. When that was the last card, the scenario ends
 * with the command's `resolution` unless the reverse side already ended it or
 * raised a decision whose answer chose the resolution.
 *
 * Why two steps: the rules resolve the reverse side before the next card
 * becomes current, so an effect on "the current agenda/act" must still hit
 * the advancing card, and on the last card it is the reverse side that names
 * the resolution or lets the investigators choose it. The reverse side is
 * the card's `advanced` abilities, opened by the first step's
 * `AgendaAdvanced`/`ActAdvanced`, so `handle` runs
 * this as a step after their follow-ups (`QueuedStep` `finishAdvance`). If
 * the reverse side asks something, this waits for the answer and its events
 * go with that answer.
 * `cardId` is the card that advanced; `asked` tells whether the reverse
 * side raised a decision the players have answered meanwhile.
 */
export function completeAdvance(
  state: GameState,
  deck: Deck,
  cardId: InstanceId,
  resolution: ResolutionId | undefined,
  asked: boolean,
): (CardMoved | CurrentCardChanged | ScenarioEnded)[] {
  const card = requireCard(state.cards, cardId);
  const nextId = nextCardId(state, deck, card.id);
  // A question that chose no resolution (a prey tie, say) leaves the fallback to end it.
  const decided = state.meta.ended === true || (asked && resolution === undefined);
  const replaced: (CardMoved | CurrentCardChanged)[] = [
    moveCardEvent(card, { kind: 'outOfGame' }),
    currentCardChanged(deck, nextId),
  ];
  if (nextId !== undefined || decided) return replaced;
  if (resolution === undefined) throw new CommandRejected({ code: 'resolutionRequired', deck });
  return [...replaced, { type: 'ScenarioEnded', resolution }];
}

/** The event that makes `cardId` the current card of `deck`, or leaves the deck without one. */
function currentCardChanged(deck: Deck, cardId: InstanceId | undefined): CurrentCardChanged {
  return { type: 'CurrentCardChanged', deck, ...(cardId === undefined ? {} : { cardId }) };
}

/** `EndScenario`: the scenario is over with the command's resolution. */
export function handleEndScenario(cmd: EndScenario): ScenarioEnded[] {
  return [{ type: 'ScenarioEnded', resolution: cmd.resolution }];
}

/**
 * Turns the current card of a deck to its reverse side. A fallback
 * `resolution` is rejected while further cards follow: only running out of
 * cards ends the scenario without a reverse side saying so.
 */
function reverseSide(
  state: GameState,
  deck: Deck,
  resolution: ResolutionId | undefined,
): (CardFlipped | AgendaAdvanced | ActAdvanced)[] {
  const card = currentCard(state, deck);
  if (resolution !== undefined && nextCardId(state, deck, card.id) !== undefined)
    throw new CommandRejected({ code: 'unexpectedResolution', deck });
  return [
    { type: 'CardFlipped', cardId: card.id, faceUp: false },
    { type: deck === 'agenda' ? 'AgendaAdvanced' : 'ActAdvanced', cardId: card.id },
  ];
}

/** The card that follows `cardId` in a deck, if any. */
function nextCardId(state: GameState, deck: Deck, cardId: InstanceId): InstanceId | undefined {
  const zone = deck === 'agenda' ? 'agendaDeck' : 'actDeck';
  return (state.order[zoneKey({ kind: zone })] ?? []).find((id) => id !== cardId);
}

/** Removes all doom in play: from cards and from the investigators' counters. */
function doomRemoval(state: GameState): (TokensChanged | InvestigatorChanged)[] {
  const fromCards = cardsWithDoom(state).flatMap((card) => clearTokensEvents(card, ['doom']));
  const fromPlayerCards: InvestigatorChanged[] = activeInvestigators(state)
    .filter((inv) => inv.doomOnPlayerCards > 0)
    .map((inv) => ({
      type: 'InvestigatorChanged',
      investigatorId: inv.id,
      stat: 'doomOnPlayerCards',
      delta: -inv.doomOnPlayerCards,
    }));
  return [...fromCards, ...fromPlayerCards];
}

/** The current agenda or act; rejects if the deck is exhausted. */
function currentCard(state: GameState, deck: Deck): CardInstance {
  const id = state[deck].current;
  if (id === undefined) throw new CommandRejected({ code: 'noCurrentCard', deck });
  return requireCard(state.cards, id);
}
