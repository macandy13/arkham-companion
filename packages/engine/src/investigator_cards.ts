import type { CardDb, CardStats } from './cards';
import type { InvestigatorCode } from './ids';
import type { SkillValues } from './state';

/**
 * What an investigator card prints that the engine models: the investigator's
 * fields of `CardStats`, all required. Investigators live in the `CardDb`
 * like every other card; this is the typed view the campaign and setup read
 * through `investigatorCard`.
 */
export interface InvestigatorCard {
  readonly code: InvestigatorCode;
  readonly name: string;
  readonly health: number;
  readonly sanity: number;
  readonly skills: SkillValues;
}

/** The `CardStats` that put `card` into a `CardDb`. */
export function investigatorCardStats(card: InvestigatorCard): CardStats {
  return {
    code: card.code,
    name: card.name,
    typeCode: 'investigator',
    traits: [],
    health: { fixed: card.health, perInvestigator: 0 },
    sanity: card.sanity,
    skills: card.skills,
  };
}

/**
 * The investigator card `code` in `cards`; undefined when `cards` lacks it or
 * it is not an investigator with health, sanity and skills.
 */
export function investigatorCard(
  cards: CardDb,
  code: InvestigatorCode,
): InvestigatorCard | undefined {
  const stats = cards.get(code);
  if (stats?.typeCode !== 'investigator') return undefined;
  const { name, health, sanity, skills } = stats;
  if (health === undefined || sanity === undefined || skills === undefined) return undefined;
  return { code, name, health: health.fixed, sanity, skills };
}
