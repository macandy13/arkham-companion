import { mapId, type AddMapStep, type ScenarioDefinition } from '@arkham/engine';
import { GATHERING_CODES, GATHERING_SETS } from './cards';

const codes = GATHERING_CODES;
const sets = GATHERING_SETS;

/** Translation key prefix for The Gathering's reference card effects. */
const reference = 'scenario.theGathering.reference';

/**
 * The house as act 1 ("Trapped") reveals it: the Study is removed and the
 * Hallway connects to the Attic, the Cellar and the Parlor, with the
 * investigators moving to the Hallway. Not part of `theGathering.setup`,
 * because applying setup steps mid-scenario (taking these locations from the
 * set-aside zone) needs the reverse-side hooks of M1.6, which `AdvanceAct`
 * calls (`reverseSideEvents`); until then tests compile it on its own to
 * check the layout.
 */
export const theGatheringHouse: AddMapStep = {
  kind: 'addMap',
  mapId: mapId('house'),
  name: 'House',
  locations: [
    { code: codes.hallway },
    { code: codes.attic },
    { code: codes.cellar },
    { code: codes.parlor },
  ],
  connections: [
    { from: codes.hallway, to: codes.attic },
    { from: codes.hallway, to: codes.cellar },
    { from: codes.hallway, to: codes.parlor },
  ],
};

/**
 * The Gathering (Core Set, 2016, scenario I of Night of the Zealot), set up as
 * the campaign guide describes: the Study is the only location in play, the
 * other locations, the Ghoul Priest and Lita Chantler are set aside, and the
 * rest of the six encounter sets is shuffled into the encounter deck. Card
 * data is hand-entered (`theGatheringCardDefs`); it is the shared test
 * scenario for the generic rules until real scenario data arrives (M4).
 */
export const theGathering: ScenarioDefinition = {
  id: 'the-gathering',
  // Number tokens, then symbol tokens: easier to check against the guide than one token per line.
  // prettier-ignore
  chaosBag: {
    easy: [
      '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
    standard: [
      '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
    hard: [
      '0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
    expert: [
      '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8',
      'skull', 'skull', 'cultist', 'tablet', 'autoFail', 'elderSign',
    ],
  },
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      cultist: { modifier: -1, effectKey: `${reference}.easyStandard.cultist` },
      tablet: { modifier: -2, effectKey: `${reference}.easyStandard.tablet` },
    },
    hardExpert: {
      skull: { modifier: -2, effectKey: `${reference}.hardExpert.skull` },
      cultist: { effectKey: `${reference}.hardExpert.cultist` },
      tablet: { modifier: -4, effectKey: `${reference}.hardExpert.tablet` },
    },
  },
  agendaDeck: [codes.whatsGoingOn, codes.riseOfTheGhouls, codes.theyreGettingOut],
  actDeck: [codes.trapped, codes.theBarrier, codes.whatHaveYouDone],
  setup: [
    { kind: 'addMap', mapId: mapId('study'), name: 'Study', locations: [{ code: codes.study }] },
    {
      kind: 'setAside',
      codes: [
        codes.hallway,
        codes.attic,
        codes.cellar,
        codes.parlor,
        codes.ghoulPriest,
        codes.litaChantler,
      ],
    },
    { kind: 'moveInvestigators', to: codes.study },
    { kind: 'buildEncounterDeck', sets: Object.values(sets) },
  ],
};
