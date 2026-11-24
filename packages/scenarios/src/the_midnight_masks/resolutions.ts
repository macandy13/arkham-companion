import {
  eachInPlay,
  eachInZone,
  scenarioDeck,
  thereAre,
  victoryDisplay,
  type AbilityCondition,
  type CardCode,
  type ResolutionStep,
  type ScenarioResolutions,
  type StoryValue,
} from '@arkham/engine';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import { GATHERING_CODES } from '../the_gathering/cards';
import { MIDNIGHT_MASKS_CODES, MIDNIGHT_MASKS_RESOLUTIONS } from './cards';

const codes = MIDNIGHT_MASKS_CODES;
const yes: StoryValue = { kind: 'flag', value: true };
const no: StoryValue = { kind: 'flag', value: false };

/** The five unique Cultists of the Cultist deck. */
const cultistDeck: readonly CardCode[] = [
  codes.wolfManDrew,
  codes.hermanCollins,
  codes.peterWarren,
  codes.victoriaDevereux,
  codes.ruthTurner,
];

/** "Record the names of each unique Cultist enemy in the victory display": the five and The Masked Hunter. */
const cultistsWeInterrogated: ResolutionStep = {
  kind: 'recordNames',
  key: ZEALOT_STORY.cultistsWeInterrogated,
  names: [...cultistDeck, codes.theMaskedHunter].map((code) => ({
    code,
    when: thereAre(eachInZone(victoryDisplay, { code }), { min: 1 }),
  })),
};

/**
 * "Record the name of each unique enemy still remaining in the Cultist deck
 * or in play". The Masked Hunter is set aside only as agenda 1's reverse
 * side, so it got away when in play or, with `hunterAtAgenda1`, while agenda
 * 1 is current (R1: "If it is Agenda 1, record The Masked Hunter as well").
 */
function cultistsWhoGotAway({ hunterAtAgenda1 }: { hunterAtAgenda1: boolean }): ResolutionStep {
  const hunterInPlay = thereAre(eachInPlay({ code: codes.theMaskedHunter }), { min: 1 });
  return {
    kind: 'recordNames',
    key: ZEALOT_STORY.cultistsWhoGotAway,
    names: [
      ...cultistDeck.map((code) => ({
        code,
        when: {
          kind: 'anyOf',
          conditions: [
            thereAre(eachInPlay({ code }), { min: 1 }),
            thereAre(eachInZone(scenarioDeck('cultist'), { code }), { min: 1 }),
          ],
        } satisfies AbilityCondition,
      })),
      {
        code: codes.theMaskedHunter,
        when: hunterAtAgenda1
          ? {
              kind: 'anyOf',
              conditions: [
                hunterInPlay,
                { kind: 'currentCard', deck: 'agenda', codes: [codes.predatorOrPrey] },
              ],
            }
          : hunterInPlay,
      },
    ],
  };
}

/** "If the Ghoul Priest is in the victory display, cross out 'the Ghoul Priest is still alive'." */
const ghoulPriestDefeated: ResolutionStep = {
  kind: 'when',
  condition: thereAre(eachInZone(victoryDisplay, { code: GATHERING_CODES.ghoulPriest }), {
    min: 1,
  }),
  then: [{ kind: 'record', key: ZEALOT_STORY.ghoulPriestStillAlive, value: no }],
};

const victoryXp: ResolutionStep = { kind: 'awardXp', to: 'each', bonus: 0, victoryDisplay: true };
const upgradeDecks: ResolutionStep = {
  kind: 'byHand',
  textKey: 'scenario.theMidnightMasks.resolution.upgradeDecks',
};

const conspiracyUncovered: readonly ResolutionStep[] = [
  cultistsWeInterrogated,
  cultistsWhoGotAway({ hunterAtAgenda1: true }),
  ghoulPriestDefeated,
  victoryXp,
  upgradeDecks,
];

/**
 * The Midnight Masks' resolutions, in the campaign guide's order of steps.
 * "No resolution" reads R1. Crossing out "the Ghoul Priest is still alive"
 * records the flag as false.
 */
export const theMidnightMasksResolutions: ScenarioResolutions = {
  none: conspiracyUncovered,
  byId: {
    [MIDNIGHT_MASKS_RESOLUTIONS.conspiracyUncovered]: conspiracyUncovered,
    [MIDNIGHT_MASKS_RESOLUTIONS.pastMidnight]: [
      cultistsWeInterrogated,
      cultistsWhoGotAway({ hunterAtAgenda1: false }),
      { kind: 'record', key: ZEALOT_STORY.itIsPastMidnight, value: yes },
      ghoulPriestDefeated,
      victoryXp,
      upgradeDecks,
    ],
  },
};
