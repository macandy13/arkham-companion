import {
  cardCode,
  cardStats,
  currentCard,
  scenario,
  scenarioId,
  type ScenarioDefinition,
  type TokenValue,
} from '@arkham/engine';
import { CAMPUS, CAMPUS_CELLS, SPREADING_FLAMES_CODES, SPREADING_FLAMES_SETS } from './cards';
import { spreadingFlamesResolutions } from './resolutions';

const codes = SPREADING_FLAMES_CODES;

/** Translation key prefix for Spreading Flames' reference card effects. */
const reference = 'scenario.spreadingFlames.reference';

/**
 * The skull token's "-X": X is the current act's number on Easy/Standard and 1 more on
 * Hard/Expert. Both sides print a "-X", so the value checks the difficulty.
 */
const actNumber: TokenValue = (ctx, state) => {
  const act = currentCard(state, 'act');
  const stage = act === undefined ? 0 : (cardStats(ctx.cards, act.code).stage?.number ?? 0);
  const more = scenario.pickReferenceSide(state.meta.difficulty) === 'hardExpert' ? 1 : 0;
  // Subtracting from 0 rather than negating keeps "no act" a plain 0, not -0, in the trace.
  return 0 - (stage + more);
};

/**
 * Spreading Flames (Core Set, 2026, scenario I of Brethren of Ash), set up as the campaign guide
 * describes: Your Friend's Room is the only location in play and every investigator starts there;
 * the other campus locations, Dr. Henry Armitage, the Servant of Flame and all five copies of
 * Fire! are set aside, and the rest of the nine encounter sets is shuffled into the encounter
 * deck. The acts put the campus into play (`spreadingFlamesCardDefs`). Chaos bags and the
 * reference card (12105) are entered by hand from the ArkhamCards campaign guide and ArkhamDB;
 * the tablet's "reveal another token" and damage and the elder thing's Fire! draw are done by
 * hand.
 */
export const spreadingFlames: ScenarioDefinition = {
  id: scenarioId('spreading-flames'),
  // Number tokens, then symbol tokens: easier to check against the guide than one token per line.
  // prettier-ignore
  chaosBag: {
    easy: [
      '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
      'skull', 'skull', 'tablet', 'elderThing', 'autoFail', 'elderSign',
    ],
    standard: [
      '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
      'skull', 'skull', 'tablet', 'elderThing', 'autoFail', 'elderSign',
    ],
    hard: [
      '0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
      'skull', 'skull', 'tablet', 'elderThing', 'autoFail', 'elderSign',
    ],
    expert: [
      '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
      'skull', 'skull', 'tablet', 'elderThing', 'autoFail', 'elderSign',
    ],
  },
  referenceCode: cardCode('12105'),
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      tablet: { modifier: -1, effectKey: `${reference}.easyStandard.tablet` },
      elderThing: { modifier: -3, effectKey: `${reference}.easyStandard.elderThing` },
    },
    hardExpert: {
      skull: { effectKey: `${reference}.hardExpert.skull` },
      tablet: { modifier: -2, effectKey: `${reference}.hardExpert.tablet` },
      elderThing: { modifier: -4, effectKey: `${reference}.hardExpert.elderThing` },
    },
  },
  agendaDeck: [codes.pastCurfew, codes.litUp, codes.wildFlames],
  actDeck: [
    codes.whereTheresSmoke,
    codes.escapeTheDorms,
    codes.searchingForDrArmitage,
    codes.blazeOfGlory,
  ],
  setup: [
    {
      kind: 'addMap',
      mapId: CAMPUS,
      name: 'Campus',
      locations: [{ code: codes.yourFriendsRoom, at: CAMPUS_CELLS.yourFriendsRoom }],
    },
    {
      kind: 'setAside',
      codes: [
        codes.dormitories,
        codes.miskatonicQuad,
        codes.scienceHall,
        codes.warrenObservatory,
        codes.orneLibrary,
        codes.drHenryArmitage,
        codes.servantOfFlame,
        ...Array<typeof codes.fire>(5).fill(codes.fire),
      ],
    },
    { kind: 'moveInvestigators', to: codes.yourFriendsRoom },
    { kind: 'buildEncounterDeck', sets: Object.values(SPREADING_FLAMES_SETS) },
  ],
  modifiers: { tokenValues: { skull: actNumber } },
  resolutions: spreadingFlamesResolutions,
};
