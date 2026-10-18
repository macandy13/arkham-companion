import { cardStats, resolveValue, type EngineContext } from './cards';
import type { AdvanceAct, AdvanceAgenda, ClueSpend, EndScenario, PlaceDoom } from './commands';
import { cardsWithDoom, isInPlay } from './doom';
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
import { activeInvestigator } from './handle_investigator';
import type { InstanceId } from './ids';
import { requireCard } from './lookup';
import { clearTokensEvents, moveCardEvent } from './placement';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { zoneKey } from './zone';

type Deck = 'agenda' | 'act';

/** `PlaceDoom`: doom on a card in play; the current agenda unless the command names another. */
export function handlePlaceDoom(state: GameState, cmd: PlaceDoom): TokensChanged[] {
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  const card =
    cmd.cardId === undefined ? currentCard(state, 'agenda') : requireCard(state.cards, cmd.cardId);
  if (!isInPlay(state, card)) throw new CommandRejected({ code: 'cardNotInPlay', cardId: card.id });
  return [{ type: 'TokensChanged', cardId: card.id, token: 'doom', delta: cmd.amount }];
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
 * `AdvanceAct`, first step: the investigators pay the act's clue requirement
 * when the command carries `spend` (paying clues is only one way to advance an
 * act; others are an objective met, an action taken or an enemy defeated, and
 * those advance with no `spend`), and the act turns to its reverse side;
 * `completeAdvance` replaces it.
 * Payments are validated up front so a rejected command pays nothing.
 */
export function handleAdvanceAct(ctx: EngineContext, state: GameState, cmd: AdvanceAct): Event[] {
  const act = currentCard(state, 'act');
  const flip = reverseSide(state, 'act', cmd.resolution);
  const payments =
    cmd.spend === undefined
      ? []
      : cluePayments(state, act, cmd.spend, clueRequirement(ctx, state, act));
  return [...payments, ...flip];
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
 * the `onAgendaAdvance`/`onActAdvance` hook on the first step's
 * `AgendaAdvanced`/`ActAdvanced`, so `handle` runs this as a step after the
 * hook's follow-ups (`QueuedStep` `finishAdvance`). If the reverse side asks
 * something, this waits for the answer and its events go with that answer.
 * `cardId` is the card that advanced; `asked` tells whether the reverse
 * side raised a decision the players have answered meanwhile.
 */
export function completeAdvance(
  state: GameState,
  deck: Deck,
  cardId: InstanceId,
  resolution: string | undefined,
  asked: boolean,
): (CardMoved | CurrentCardChanged | ScenarioEnded)[] {
  const card = requireCard(state.cards, cardId);
  const nextId = nextCardId(state, deck, card.id);
  const decided = state.meta.ended === true || asked;
  const lastCard = nextId === undefined;
  if (lastCard && !decided && resolution === undefined)
    throw new CommandRejected({ code: 'resolutionRequired', deck });
  return [
    moveCardEvent(card, { kind: 'outOfGame' }),
    { type: 'CurrentCardChanged', deck, ...(nextId === undefined ? {} : { cardId: nextId }) },
    ...(lastCard && !decided && resolution !== undefined
      ? [{ type: 'ScenarioEnded' as const, resolution }]
      : []),
  ];
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
  resolution: string | undefined,
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
  const fromPlayerCards: InvestigatorChanged[] = state.investigators
    .filter((inv) => inv.status === 'active' && inv.doomOnPlayerCards > 0)
    .map((inv) => ({
      type: 'InvestigatorChanged',
      investigatorId: inv.id,
      stat: 'doomOnPlayerCards',
      delta: -inv.doomOnPlayerCards,
    }));
  return [...fromCards, ...fromPlayerCards];
}

/**
 * Clues the act costs for the starting player count; `undefined` for an act
 * without a clue value, which cannot be paid for (not "free": a 0 would let
 * an empty payment pass as if the card asked for it).
 */
function clueRequirement(
  ctx: EngineContext,
  state: GameState,
  act: CardInstance,
): number | undefined {
  const threshold = cardStats(ctx.cards, act.code).clues;
  return threshold === undefined ? undefined : resolveValue(threshold, state.meta.playerCount);
}

/**
 * One `InvestigatorChanged` per payment; rejects payments that do not add up
 * to `required`, and any payment for an act without a clue threshold.
 */
function cluePayments(
  state: GameState,
  act: CardInstance,
  spend: readonly ClueSpend[],
  required: number | undefined,
): InvestigatorChanged[] {
  if (required === undefined)
    throw new CommandRejected({ code: 'noClueThreshold', cardId: act.id });
  const payers = new Set<string>();
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

/** The current agenda or act; rejects if the deck is exhausted. */
function currentCard(state: GameState, deck: Deck): CardInstance {
  const id = state[deck].current;
  if (id === undefined) throw new CommandRejected({ code: 'noCurrentCard', deck });
  return requireCard(state.cards, id);
}
