import { cardStats, resolveValue, type EngineContext } from './cards';
import type { AdvanceAct, AdvanceAgenda, ClueSpend, PlaceDoom } from './commands';
import { cardsWithDoom, isInPlay } from './doom';
import type {
  ActAdvanced,
  AgendaAdvanced,
  CardFlipped,
  CardMoved,
  Event,
  InvestigatorChanged,
  ScenarioEnded,
  TokensChanged,
} from './events';
import type { InstanceId } from './ids';
import { activeInvestigator } from './handle_investigator';
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
 * `AdvanceAgenda`. Doom is cleared first because the rules remove all doom in
 * play when an agenda advances.
 */
export function handleAdvanceAgenda(state: GameState, cmd: AdvanceAgenda): Event[] {
  const advance = advanceDeck(state, 'agenda', cmd.resolution);
  return [...doomRemoval(state), ...advance.events, ...reverseSideEvents(), ...advance.ended];
}

/**
 * `AdvanceAct`: the investigators pay the act's clue requirement, then the
 * act advances. Payments are validated up front so a rejected command pays nothing.
 */
export function handleAdvanceAct(ctx: EngineContext, state: GameState, cmd: AdvanceAct): Event[] {
  const act = currentCard(state, 'act');
  const payments = cluePayments(state, cmd.spend, clueRequirement(ctx, state, act));
  const advance = advanceDeck(state, 'act', cmd.resolution);
  return [...payments, ...advance.events, ...reverseSideEvents(), ...advance.ended];
}

/**
 * Extension point for the reverse side of an advancing agenda or act. The
 * trigger bus (M1.6) will run the card's hook here and return the events it
 * produces (it will then take the state, the card and the context); until
 * then advancing has no card-specific effect.
 */
function reverseSideEvents(): Event[] {
  return [];
}

/**
 * The events that take the current card of a deck out of play and make the
 * next one current, plus `ScenarioEnded` (kept apart so it comes after the
 * reverse-side events) when that was the last card.
 */
function advanceDeck(
  state: GameState,
  deck: Deck,
  resolution: string | undefined,
): { events: (CardFlipped | CardMoved | AgendaAdvanced | ActAdvanced)[]; ended: ScenarioEnded[] } {
  const card = currentCard(state, deck);
  const zone = deck === 'agenda' ? 'agendaDeck' : 'actDeck';
  const nextId = (state.order[zoneKey({ kind: zone })] ?? []).find((id) => id !== card.id);
  if (nextId === undefined && resolution === undefined)
    throw new CommandRejected({ code: 'resolutionRequired', deck });
  return {
    events: [
      { type: 'CardFlipped', cardId: card.id, faceUp: false },
      { type: 'CardMoved', cardId: card.id, from: card.zone, to: { kind: 'outOfGame' } },
      {
        type: deck === 'agenda' ? 'AgendaAdvanced' : 'ActAdvanced',
        cardId: card.id,
        ...(nextId === undefined ? {} : { nextId }),
      },
    ],
    ended:
      nextId === undefined && resolution !== undefined
        ? [{ type: 'ScenarioEnded', resolution }]
        : [],
  };
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
