import type { InvestigatorCode } from './ids';
import type { SkillValues } from './state';

/**
 * What an investigator card prints that the engine models. Investigators are
 * not in the `CardDb` (that holds the scenario's encounter and location
 * cards), so they get their own lookup, `InvestigatorDb`.
 */
export interface InvestigatorCard {
  readonly code: InvestigatorCode;
  readonly name: string;
  readonly health: number;
  readonly sanity: number;
  readonly skills: SkillValues;
}

/**
 * Investigator cards by code, so commands can name an investigator by code and
 * the handler looks up the printed stats. The app builds it from its
 * investigator catalog, tests from hand-entered cards.
 */
export interface InvestigatorDb {
  get(code: InvestigatorCode): InvestigatorCard | undefined;
}

/** Builds an `InvestigatorDb`; a later duplicate code replaces an earlier one. */
export function investigatorDbFrom(cards: Iterable<InvestigatorCard>): InvestigatorDb {
  const byCode = new Map<InvestigatorCode, InvestigatorCard>();
  for (const card of cards) byCode.set(card.code, card);
  return { get: (code) => byCode.get(code) };
}
