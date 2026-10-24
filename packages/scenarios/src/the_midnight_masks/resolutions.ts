import type {
  CardCode,
  GameCondition,
  ResolutionStep,
  ScenarioResolutions,
  StoryValue,
} from '@arkham/engine';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import { GATHERING_CODES } from '../the_gathering/cards';
import { MIDNIGHT_MASKS_CODES, MIDNIGHT_MASKS_RESOLUTIONS } from './cards';

const codes = MIDNIGHT_MASKS_CODES;
const yes: StoryValue = { kind: 'flag', value: true };
const no: StoryValue = { kind: 'flag', value: false };

/** The five unique Cultists of the Cultist deck, which is set aside during the game. */
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
    when: { kind: 'cardIn', code, places: ['victoryDisplay'] },
  })),
};

/**
 * "Record the name of each unique enemy still remaining in the Cultist deck
 * or in play": a cultist still set aside is still in the Cultist deck. The
 * Masked Hunter is set aside only as agenda 1's reverse side, so it got away
 * when in play or, with `atAgenda1`, while agenda 1 is current (R1: "If it is
 * Agenda 1, record The Masked Hunter as well").
 */
function cultistsWhoGotAway(atAgenda1: boolean): ResolutionStep {
  const hunterInPlay: GameCondition = {
    kind: 'cardIn',
    code: codes.theMaskedHunter,
    places: ['inPlay'],
  };
  return {
    kind: 'recordNames',
    key: ZEALOT_STORY.cultistsWhoGotAway,
    names: [
      ...cultistDeck.map((code) => ({
        code,
        when: { kind: 'cardIn', code, places: ['inPlay', 'setAside'] } as const,
      })),
      {
        code: codes.theMaskedHunter,
        when: atAgenda1
          ? {
              kind: 'anyOf',
              conditions: [
                hunterInPlay,
                { kind: 'currentAgenda', agendas: [codes.predatorOrPrey] },
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
  condition: { kind: 'cardIn', code: GATHERING_CODES.ghoulPriest, places: ['victoryDisplay'] },
  then: [{ kind: 'record', key: ZEALOT_STORY.ghoulPriestStillAlive, value: no }],
};

const victoryXp: ResolutionStep = { kind: 'awardXp', to: 'each', bonus: 0, victoryDisplay: true };
const upgradeDecks: ResolutionStep = {
  kind: 'byHand',
  textKey: 'scenario.theMidnightMasks.resolution.upgradeDecks',
};

const conspiracyUncovered: readonly ResolutionStep[] = [
  cultistsWeInterrogated,
  cultistsWhoGotAway(true),
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
      cultistsWhoGotAway(false),
      { kind: 'record', key: ZEALOT_STORY.itIsPastMidnight, value: yes },
      ghoulPriestDefeated,
      victoryXp,
      upgradeDecks,
    ],
  },
};
