import { beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import {
  campaign,
  cardCode,
  investigatorCode,
  type CampaignLog,
  type StoryRead,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { storyReadLines } from './storyReads';

/** A Zealot log of two investigators, which is all the lines read of it. */
const twoInvestigators: CampaignLog = {
  ...campaign.createEmptyLog(),
  investigators: [
    {
      code: investigatorCode('01001'),
      name: 'Roland Banks',
      health: 9,
      sanity: 5,
      physicalTrauma: 0,
      mentalTrauma: 0,
      xpEarned: 0,
      xpSpent: 0,
      fate: 'alive',
      earnedCards: [],
    },
    {
      code: investigatorCode('01002'),
      name: 'Daisy Walker',
      health: 5,
      sanity: 9,
      physicalTrauma: 0,
      mentalTrauma: 0,
      xpEarned: 0,
      xpSpent: 0,
      fate: 'alive',
      earnedCards: [],
    },
  ],
};
const ghoulPriest = cardCode('01116');
const theArkhamWoods = cardCode('01143');
const linesOf = (reads: readonly StoryRead[]) =>
  storyReadLines(
    i18next.t,
    (key) => i18next.exists(key),
    'story.nightOfTheZealot',
    twoInvestigators,
    reads,
  );

describe('storyReadLines', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it("writes the log's note for a flag and what the setup does for it", () => {
    expect(
      linesOf([
        {
          condition: { kind: 'flag', key: 'ghoulPriestStillAlive', value: true },
          holds: true,
          steps: [{ kind: 'shuffleIntoEncounterDeck', codes: [ghoulPriest] }],
        },
      ]),
    ).toEqual([
      {
        entry: 'The Ghoul Priest is still out there.',
        effects: ['Ghoul Priest is shuffled into the encounter deck'],
      },
    ]);
  });

  it('counts the names under a list heading for doom on The Arkham Woods', () => {
    expect(
      linesOf([
        {
          condition: { kind: 'atLeastNames', key: 'cultistsWhoGotAway', count: 3 },
          holds: true,
          steps: [{ kind: 'placeTokens', target: theArkhamWoods, token: 'doom', amount: 1 }],
        },
      ]),
    ).toEqual([
      {
        entry: 'At least 3 names under “Cultists Who Got Away”.',
        effects: ['1 doom on The Arkham Woods'],
      },
    ]);
  });

  it.each([
    [
      'a read that takes no step',
      {
        condition: { kind: 'flag', key: 'ghoulPriestStillAlive', value: true },
        holds: false,
        steps: [],
      },
    ],
    [
      'a flag side the log page has no note for',
      {
        condition: { kind: 'flag', key: 'ghoulPriestStillAlive', value: true },
        holds: false,
        steps: [{ kind: 'setAside', codes: [ghoulPriest] }],
      },
    ],
    [
      'a step the players need no word on',
      {
        condition: { kind: 'listsName', key: 'cultistsWhoGotAway', name: 'Ruth Turner' },
        holds: true,
        steps: [{ kind: 'shuffle', zone: { kind: 'encounterDeck' } }],
      },
    ],
  ] as [string, StoryRead][])('leaves out %s', (_, read) => {
    expect(linesOf([read])).toEqual([]);
  });
});
