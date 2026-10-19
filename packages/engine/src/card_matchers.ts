import { assertNever } from '@arkham/util';
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

/**
 * Matches a card whose instance id or card code equals `text`, or whose printed
 * name matches it like `NameMatcher` does; built by `byAny`. For a player or
 * test script that has one string and does not care which kind of identifier it is.
 */
export interface AnyIdentifierMatcher {
  by: 'any';
  text: string;
}

/** Matches the one investigator with this seat id; built by `byId`. */
export interface InvestigatorIdMatcher {
  by: 'id';
  id: InvestigatorId;
}

/**
 * How a player (or a test script) points at cards: by printed name, exact
 * instance id, card code, or any one of the three. Build one with `byName`,
 * `byId`, `byCode` or `byAny`; `matchingCards` applies it. A matcher can match
 * several copies: whoever needs exactly one decides what none or many mean
 * (`BoardView` throws a `TableError`, a handler could reject the command).
 */
export type CardMatcher = NameMatcher | InstanceIdMatcher | CodeMatcher | AnyIdentifierMatcher;

/**
 * `CardMatcher` for investigators. Investigators are seats (`Investigator`), not
 * card instances, so the exact reference is the `InvestigatorId`; name and
 * code match the investigator card. It shares the name, code and any-identifier
 * variants with `CardMatcher`, so `byName('Roland Banks')` serves both.
 */
export type InvestigatorMatcher =
  NameMatcher | InvestigatorIdMatcher | CodeMatcher | AnyIdentifierMatcher;

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

/**
 * Matches cards whose id, code or printed name is `text` (name as in `byName`):
 * `byAny('hallway')` finds the Hallway by name, `byAny('01111')` by code. Whole
 * values only, no substrings, so a short text cannot match half the table.
 */
export const byAny = (text: string): AnyIdentifierMatcher => ({ by: 'any', text });

/** The cards of `cards` that `matcher` matches, in the order given. Pure, so handlers can share it with `BoardView`. */
export function matchingCards(
  ctx: EngineContext,
  cards: readonly CardInstance[],
  matcher: CardMatcher,
): CardInstance[] {
  return cards.filter((card) => {
    const name = cardStats(ctx.cards, card.code).name;
    switch (matcher.by) {
      case 'id':
        return card.id === matcher.id;
      case 'code':
        return card.code === matcher.code;
      case 'name':
        return sameName(name, matcher.name);
      case 'any':
        return (
          card.id === matcher.text || card.code === matcher.text || sameName(name, matcher.text)
        );
      default:
        return assertNever(matcher);
    }
  });
}

/** The investigators of `investigators` that `matcher` matches, in seat order given. */
export function matchingInvestigators(
  investigators: readonly Investigator[],
  matcher: InvestigatorMatcher,
): Investigator[] {
  return investigators.filter((inv) => {
    switch (matcher.by) {
      case 'id':
        return inv.id === matcher.id;
      case 'code':
        return inv.code === matcher.code;
      case 'name':
        return sameName(inv.name, matcher.name);
      case 'any':
        return (
          inv.id === matcher.text || inv.code === matcher.text || sameName(inv.name, matcher.text)
        );
      default:
        return assertNever(matcher);
    }
  });
}

/** The matcher in words for an error message: `named "Hallway"`, `with id study`, `with code 01111`, `with id, code or name "hall"`. */
export function describeMatcher(matcher: CardMatcher | InvestigatorMatcher): string {
  switch (matcher.by) {
    case 'name':
      return `named "${matcher.name}"`;
    case 'id':
      return `with id ${matcher.id}`;
    case 'code':
      return `with code ${matcher.code}`;
    case 'any':
      return `with id, code or name "${matcher.text}"`;
    default:
      return assertNever(matcher);
  }
}

function sameName(printed: string, wanted: string): boolean {
  return comparableName(printed) === comparableName(wanted);
}
