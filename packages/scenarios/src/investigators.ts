import {
  investigatorCode,
  investigatorDbFrom,
  type InvestigatorCard,
  type InvestigatorDb,
} from '@arkham/engine';

/*
 * Test data: three Night of the Zealot investigators (Core Set, 2016 codes, to
 * match The Gathering's 01xxx cards), so scenario tests play with the people
 * found at a real table. Only the stats the engine models are hand-entered:
 * health, sanity, the printed skills (willpower/intellect/combat/agility, as
 * on the Core Set cards; ArkhamDB was not checked from the session).
 * `compileSetup` seats them from `zealotInvestigators`.
 */

/** Roland Banks (01001), the Guardian: health 9, sanity 5, skills 3/3/4/2. */
export const rolandBanks: InvestigatorCard = {
  code: investigatorCode('01001'),
  name: 'Roland Banks',
  health: 9,
  sanity: 5,
  skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
};

/** Daisy Walker (01002), the Seeker: health 5, sanity 9, skills 3/5/2/2. */
export const daisyWalker: InvestigatorCard = {
  code: investigatorCode('01002'),
  name: 'Daisy Walker',
  health: 5,
  sanity: 9,
  skills: { willpower: 3, intellect: 5, combat: 2, agility: 2 },
};

/** Wendy Adams (01005), the Survivor: health 7, sanity 7, skills 4/3/1/4. */
export const wendyAdams: InvestigatorCard = {
  code: investigatorCode('01005'),
  name: 'Wendy Adams',
  health: 7,
  sanity: 7,
  skills: { willpower: 4, intellect: 3, combat: 1, agility: 4 },
};

/** The three investigators above, for the `EngineContext` of scenario tests. */
export const zealotInvestigators: InvestigatorDb = investigatorDbFrom([
  rolandBanks,
  daisyWalker,
  wendyAdams,
]);
