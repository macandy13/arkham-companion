import { makeInvestigator } from '@arkham/engine/test/utils';
import type { Investigator } from '@arkham/engine';

/*
 * Test data: three Night of the Zealot investigators (Core Set, 2016 codes, to
 * match The Gathering's 01xxx cards), so scenario tests play with the people
 * found at a real table. Only the stats the engine models are hand-entered:
 * health, sanity, the printed skills (willpower/intellect/combat/agility, as
 * on the Core Set cards; ArkhamDB was not checked from the session) and the
 * standard 5 starting resources. Seat 0 is a placeholder – the test seats them.
 */

/** Roland Banks (01001), the Guardian: health 9, sanity 5, skills 3/3/4/2. */
export const rolandBanks: Investigator = makeInvestigator({
  id: 'roland',
  code: '01001',
  name: 'Roland Banks',
  health: { max: 9, damage: 0 },
  sanity: { max: 5, horror: 0 },
  skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
  resources: 5,
});

/** Daisy Walker (01002), the Seeker: health 5, sanity 9, skills 3/5/2/2. */
export const daisyWalker: Investigator = makeInvestigator({
  id: 'daisy',
  code: '01002',
  name: 'Daisy Walker',
  health: { max: 5, damage: 0 },
  sanity: { max: 9, horror: 0 },
  skills: { willpower: 3, intellect: 5, combat: 2, agility: 2 },
  resources: 5,
});

/** Wendy Adams (01005), the Survivor: health 7, sanity 7, skills 4/3/1/4. */
export const wendyAdams: Investigator = makeInvestigator({
  id: 'wendy',
  code: '01005',
  name: 'Wendy Adams',
  health: { max: 7, damage: 0 },
  sanity: { max: 7, horror: 0 },
  skills: { willpower: 4, intellect: 3, combat: 1, agility: 4 },
  resources: 5,
});
