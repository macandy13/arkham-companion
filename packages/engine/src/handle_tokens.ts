import { cardStats, resolveAmount, type CardStats, type EngineContext } from './cards';
import type { MoveTokens, TokenHolder } from './commands';
import { isInPlay } from './doom';
import { defeatedByDamage } from './enemies';
import type { Event } from './events';
import type { InvestigatorId } from './ids';
import { isActiveInvestigator, requireInvestigator } from './investigators';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, TokenKind } from './state';

/** A `TokenHolder` looked up in the state: the pool, a card or an investigator, or nothing. */
type ResolvedHolder =
  | { kind: 'pool' }
  | { kind: 'card'; card: CardInstance }
  | { kind: 'investigator'; investigatorId: InvestigatorId }
  | { kind: 'absent' };

/**
 * `MoveTokens`: as many tokens as `from` holds, onto `to` (see the command). The amount must be a
 * positive whole number once resolved, since anything else is a mistake in the card data; a
 * holder that can take or give nothing makes the move do nothing.
 */
export function handleMoveTokens(ctx: EngineContext, state: GameState, cmd: MoveTokens): Event[] {
  if (cmd.from === 'pool' && (cmd.to === 'pool' || cmd.amount === 'all'))
    throw new CommandRejected({ code: 'invalidTokenMove' });
  const from = resolveHolder(state, cmd.from, cmd.token);
  const to = resolveHolder(state, cmd.to, cmd.token);
  const wanted = wantedAmount(state, cmd, to);
  if (wanted !== 'all' && (!Number.isInteger(wanted) || wanted <= 0)) {
    if (typeof cmd.amount === 'object' && 'upTo' in cmd.amount) return [];
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: wanted });
  }
  const held = heldBy(state, from, cmd.token);
  const moved = wanted === 'all' ? held : Math.min(wanted, held);
  if (moved === 0 || to.kind === 'absent' || sameHolder(from, to)) return [];
  if (to.kind === 'card' && !canHold(cardStats(ctx.cards, to.card.code), cmd.token)) return [];
  return [
    ...changed(from, cmd.token, -moved),
    ...changed(to, cmd.token, moved),
    ...defeatOf(ctx, state, to, cmd.token, moved),
  ];
}

function resolveHolder(state: GameState, holder: TokenHolder, token: TokenKind): ResolvedHolder {
  if (holder === 'pool') return { kind: 'pool' };
  if (holder === 'currentAgenda' || 'card' in holder) {
    const id = holder === 'currentAgenda' ? state.agenda.current : holder.card;
    if (id === undefined) return { kind: 'absent' };
    const card = requireCard(state.cards, id);
    return isInPlay(state, card) ? { kind: 'card', card } : { kind: 'absent' };
  }
  // Only clues sit on an investigator card here; their damage and horror are wounds (ME.9d).
  if (token !== 'clue') throw new CommandRejected({ code: 'tokenNotOnInvestigators', token });
  const investigator = requireInvestigator(state, holder.investigator);
  return isActiveInvestigator(state, investigator.id)
    ? { kind: 'investigator', investigatorId: investigator.id }
    : { kind: 'absent' };
}

/** The count the command asks for, before it is capped at what `from` holds. */
function wantedAmount(state: GameState, cmd: MoveTokens, to: ResolvedHolder): number | 'all' {
  const { playerCount } = state.meta;
  if (cmd.amount === 'all') return 'all';
  if (typeof cmd.amount === 'object' && 'upTo' in cmd.amount)
    return resolveAmount(cmd.amount.upTo, playerCount) - heldBy(state, to, cmd.token);
  return resolveAmount(cmd.amount, playerCount);
}

function heldBy(state: GameState, holder: ResolvedHolder, token: TokenKind): number {
  switch (holder.kind) {
    case 'pool':
      return Number.POSITIVE_INFINITY;
    case 'card':
      return holder.card.tokens[token] ?? 0;
    case 'investigator':
      return requireInvestigator(state, holder.investigatorId).clues;
    case 'absent':
      return 0;
  }
}

function sameHolder(a: ResolvedHolder, b: ResolvedHolder): boolean {
  if (a.kind === 'card' && b.kind === 'card') return a.card.id === b.card.id;
  return (
    a.kind === 'investigator' && b.kind === 'investigator' && a.investigatorId === b.investigatorId
  );
}

function changed(holder: ResolvedHolder, token: TokenKind, delta: number): Event[] {
  switch (holder.kind) {
    case 'card':
      return [{ type: 'TokensChanged', cardId: holder.card.id, token, delta }];
    case 'investigator':
      return [
        {
          type: 'InvestigatorChanged',
          investigatorId: holder.investigatorId,
          stat: 'clues',
          delta,
        },
      ];
    case 'pool':
    case 'absent':
      return [];
  }
}

/**
 * Whether moved `token`s may land on a card with `stats`: damage only on a card with health and
 * horror only on one with sanity (FAQ, October 2024: no damage moves onto a card without health).
 */
function canHold(stats: CardStats, token: TokenKind): boolean {
  if (token === 'damage') return stats.health !== undefined;
  if (token === 'horror') return stats.sanity !== undefined;
  return true;
}

function defeatOf(
  ctx: EngineContext,
  state: GameState,
  to: ResolvedHolder,
  token: TokenKind,
  moved: number,
): Event[] {
  if (to.kind !== 'card' || token !== 'damage') return [];
  const stats = cardStats(ctx.cards, to.card.code);
  return stats.typeCode === 'enemy' ? defeatedByDamage(state, to.card, stats, moved) : [];
}
