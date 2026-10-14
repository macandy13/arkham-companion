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
import type { InstanceId } from './ids';
import { activeInvestigator } from './handle-investigator';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { zoneKey } from './zone';

type Deck = 'agenda' | 'act';

/** `PlaceDoom`: doom on a card in play; the current agenda unless the command names another. */
export function handlePlaceDoom(state: GameState, cmd: PlaceDoom): TokensChanged[] {
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  const card =
    cmd.cardId === undefined ? currentCard(state, 'agenda') : knownCard(state, cmd.cardId);
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
 * and the act turns to its reverse side; `completeAdvance` replaces it.
 * Payments are validated up front so a rejected command pays nothing.
 */
export function handleAdvanceAct(ctx: EngineContext, state: GameState, cmd: AdvanceAct): Event[] {
  const act = currentCard(state, 'act');
  const flip = reverseSide(state, 'act', cmd.resolution);
  const payments = cluePayments(state, cmd.spend, clueRequirement(ctx, state, act));
  return [...payments, ...flip];
}

/**
 * `AdvanceAgenda`/`AdvanceAct`, second step, which `handle` runs after the
 * forced effects of the first step: the advanced card leaves the game and the
 * next card becomes current. When that was the last card, the scenario ends
 * with the command's `resolution` unless the reverse side already ended it.
 *
 * Why two steps: the rules resolve the reverse side before the next card
 * becomes current, so an effect on "the current agenda/act" must still hit
 * the advancing card, and on the last card it is the reverse side that names
 * the resolution. The reverse side is the `onAgendaAdvance`/`onActAdvance`
 * hook on the first step's `AgendaAdvanced`/`ActAdvanced`, so running the
 * trigger bus between the steps gives that order while every event stays in
 * the originating command's list (one undo group) and under its loop guard.
 * `before` is the state the command started from (it tells which card
 * advanced), `after` the state after the first step and its forced effects.
 */
export function completeAdvance(
  before: GameState,
  after: GameState,
  deck: Deck,
  resolution: string | undefined,
): (CardMoved | CurrentCardChanged | ScenarioEnded)[] {
  const advanced = currentCard(before, deck);
  const card = after.cards[advanced.id] ?? advanced;
  const nextId = nextCardId(after, deck, card.id);
  const ended = after.meta.resolution !== undefined;
  if (nextId === undefined && !ended && resolution === undefined)
    throw new CommandRejected({ code: 'resolutionRequired', deck });
  return [
    { type: 'CardMoved', cardId: card.id, from: card.zone, to: { kind: 'outOfGame' } },
    { type: 'CurrentCardChanged', deck, ...(nextId === undefined ? {} : { cardId: nextId }) },
    ...(nextId === undefined && !ended && resolution !== undefined
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
  const fromCards: TokensChanged[] = cardsWithDoom(state).map((card) => ({
    type: 'TokensChanged',
    cardId: card.id,
    token: 'doom',
    delta: -(card.tokens.doom ?? 0),
  }));
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

/** Clues the act costs for the starting player count; 0 for an act without a clue value. */
function clueRequirement(ctx: EngineContext, state: GameState, act: CardInstance): number {
  const threshold = cardStats(ctx.cards, act.code).clues;
  return threshold ? resolveValue(threshold, state.meta.playerCount) : 0;
}

/** One `InvestigatorChanged` per payment; rejects payments that do not add up to `required`. */
function cluePayments(
  state: GameState,
  spend: readonly ClueSpend[],
  required: number,
): InvestigatorChanged[] {
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
  const card = id === undefined ? undefined : state.cards[id];
  if (!card) throw new CommandRejected({ code: 'noCurrentCard', deck });
  return card;
}

function knownCard(state: GameState, cardId: InstanceId): CardInstance {
  const card = state.cards[cardId];
  if (!card) throw new CommandRejected({ code: 'unknownCard', cardId });
  return card;
}
