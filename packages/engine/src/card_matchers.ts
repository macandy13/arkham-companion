import { cardStats, comparableName, type EngineContext } from './cards';
import {
  cardName,
  type CardCode,
  type CardName,
  type InstanceId,
  type InvestigatorId,
} from './ids';
import type { CardInstance, Investigator } from './state';

/** Matches the cards printed with `name` (case-insensitive); built by `byName`. */
export interface NameMatcher {
  by: 'name';
  name: CardName;
}

/** Matches the one card with this exact id; built by `byId`. */
export interface InstanceIdMatcher {
  by: 'id';
  id: InstanceId;
}

/** Matches the cards with this ArkhamDB code; built by `byCode`. */
export interface CodeMatcher {
  by: 'code';
  code: CardCode;
}

/** Matches the cards whose printed name contains `text` (case-insensitive); built by `fuzzy`. */
export interface FuzzyMatcher {
  by: 'fuzzy';
  text: string;
}

/** Matches the one investigator with this seat id; built by `byId`. */
export interface InvestigatorIdMatcher {
  by: 'id';
  id: InvestigatorId;
}

/**
 * How a player (or a test script) points at cards: by printed name, exact
 * instance id, card code, or a fragment of the name. Build one with `byName`,
 * `byId`, `byCode` or `fuzzy`; `matchingCards` applies it. A matcher can match
 * several copies: whoever needs exactly one decides what none or many mean
 * (`BoardView` throws a `TableError`, a handler could reject the command).
 */
export type CardMatcher = NameMatcher | InstanceIdMatcher | CodeMatcher | FuzzyMatcher;

/**
 * `CardMatcher` for investigators. Investigators are seats (`Investigator`), not
 * card instances, so the exact reference is the `InvestigatorId`; name, code and
 * fragment match the investigator card. It shares the name, code and fuzzy
 * variants with `CardMatcher`, so `byName('Roland Banks')` serves both.
 */
export type InvestigatorMatcher = NameMatcher | InvestigatorIdMatcher | CodeMatcher | FuzzyMatcher;

/** Matches cards printed with `name`; case and a trailing full stop do not matter. */
export const byName = (name: string): NameMatcher => ({ by: 'name', name: cardName(name) });

/**
 * Matches one exact card or investigator. Overloaded so the id's brand picks the
 * matcher: an `InstanceId` for cards, an `InvestigatorId` for investigators.
 */
export function byId(id: InstanceId): InstanceIdMatcher;
export function byId(id: InvestigatorId): InvestigatorIdMatcher;
export function byId(id: InstanceId | InvestigatorId): InstanceIdMatcher | InvestigatorIdMatcher {
  // The overloads guarantee id and matcher share a brand; TypeScript cannot correlate them in the union.
  return { by: 'id', id } as InstanceIdMatcher | InvestigatorIdMatcher;
}

/** Matches cards with ArkhamDB code `code`, e.g. every copy of one enemy. */
export const byCode = (code: CardCode): CodeMatcher => ({ by: 'code', code });

/** Matches cards whose printed name contains `text`, ignoring case: `fuzzy('hall')` finds Hallway. */
export const fuzzy = (text: string): FuzzyMatcher => ({ by: 'fuzzy', text });

/** The cards of `cards` that `matcher` matches, in the order given. Pure, so handlers can share it with `BoardView`. */
export function matchingCards(
  ctx: EngineContext,
  cards: readonly CardInstance[],
  matcher: CardMatcher,
): CardInstance[] {
  return cards.filter((card) => {
    if (matcher.by === 'id') return card.id === matcher.id;
    if (matcher.by === 'code') return card.code === matcher.code;
    return matchesText(cardStats(ctx.cards, card.code).name, matcher);
  });
}

/** The investigators of `investigators` that `matcher` matches, in seat order given. */
export function matchingInvestigators(
  investigators: readonly Investigator[],
  matcher: InvestigatorMatcher,
): Investigator[] {
  return investigators.filter((inv) => {
    if (matcher.by === 'id') return inv.id === matcher.id;
    if (matcher.by === 'code') return inv.code === matcher.code;
    return matchesText(inv.name, matcher);
  });
}

/** The matcher in words for an error message: `named "Hallway"`, `with id study`, `with code 01111`, `with text "hall"`. */
export function describeMatcher(matcher: CardMatcher | InvestigatorMatcher): string {
  switch (matcher.by) {
    case 'name':
      return `named "${matcher.name}"`;
    case 'id':
      return `with id ${matcher.id}`;
    case 'code':
      return `with code ${matcher.code}`;
    case 'fuzzy':
      return `with text "${matcher.text}"`;
  }
}

function matchesText(printed: string, matcher: NameMatcher | FuzzyMatcher): boolean {
  const have = comparableName(printed);
  return matcher.by === 'name'
    ? have === comparableName(matcher.name)
    : have.includes(comparableName(matcher.text));
}
