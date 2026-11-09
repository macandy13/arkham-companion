import { describe, expect, it } from 'vitest';
import {
  STATE_VERSION,
  campaign,
  campaignDefinitionId,
  campaignId,
  cardCode,
  gameId,
  instanceId,
  interludeId,
  investigatorCode,
  scenarioId,
  type CampaignEvent,
  type Event,
} from '@arkham/engine';
import { parseExportFile, serialiseCampaignExport } from './campaignExport';
import { serialiseGameExport } from './gameExport';
import { GameImportError } from './importError';

const zealot = campaignId('zealot');

const started: CampaignEvent = {
  type: 'CampaignStarted',
  campaignId: zealot,
  definitionId: campaignDefinitionId('night-of-the-zealot'),
  difficulty: 'hard',
  investigators: [],
  chaosBag: ['0'],
  scenarioIds: [scenarioId('the-gathering')],
};

const xpEarned: CampaignEvent = {
  type: 'XpChanged',
  code: investigatorCode('01001'),
  account: 'earned',
  delta: 2,
};

/** The Gathering set up on its own, outside any campaign. */
const standaloneGatheringStarted: Event = {
  type: 'ScenarioStarted',
  scenarioId: scenarioId('the-gathering'),
  difficulty: 'hard',
  seed: 7,
  investigators: [],
  maps: {},
  cards: [
    {
      id: instanceId('study'),
      code: cardCode('01111'),
      zone: { kind: 'encounterDeck' },
      faceUp: false,
      exhausted: false,
      tokens: {},
      flags: {},
    },
  ],
  chaosBag: ['0'],
};

/** The Gathering set up as the Zealot campaign's first chapter, with its copy of the log. */
const gatheringStarted: Event = {
  ...standaloneGatheringStarted,
  campaign: campaign.replayEvents([started]),
};

const gathering = {
  title: 'The Gathering',
  createdAt: 2000,
  events: [
    { gameId: gameId('g'), seq: 1, timestamp: 2000, commandId: 'start', event: gatheringStarted },
  ],
};

const zealotLog = [
  { campaignId: zealot, seq: 1, timestamp: 1000, commandId: 'start', event: started },
  {
    campaignId: zealot,
    seq: 2,
    timestamp: 3000,
    commandId: 'resolution',
    event: xpEarned,
    cause: { kind: 'interlude' as const, interludeId: interludeId('the_interlude') },
  },
];

/** The Zealot campaign's export: its start, 2 XP written by an interlude, and The Gathering. */
const zealotExport = serialiseCampaignExport(
  { title: 'Zealot – Roland', createdAt: 1000, reliance: 'assist' },
  zealotLog,
  [gathering],
);

/** The failure reason of `parseExportFile`, or `undefined` if the text was accepted. */
function failureOf(text: string) {
  try {
    parseExportFile(text);
  } catch (error) {
    return error instanceof GameImportError ? error.reason : 'other';
  }
  return undefined;
}

describe('campaign export', () => {
  it('parses what it serialises: the title, the reliance, the log and the games', () => {
    expect(parseExportFile(zealotExport)).toEqual({
      kind: 'campaign',
      campaign: {
        title: 'Zealot – Roland',
        reliance: 'assist',
        events: [
          { timestamp: 1000, commandId: 'start', event: started },
          {
            timestamp: 3000,
            commandId: 'resolution',
            event: xpEarned,
            cause: { kind: 'interlude', interludeId: 'the_interlude' },
          },
        ],
        games: [
          {
            title: 'The Gathering',
            events: [{ timestamp: 2000, commandId: 'start', event: gatheringStarted }],
          },
        ],
      },
    });
  });

  it('reads a single game’s export as a game', () => {
    const text = serialiseGameExport('The Gathering', 2000, gathering.events);

    expect(parseExportFile(text)).toMatchObject({ kind: 'game', game: { title: 'The Gathering' } });
  });

  it.each([
    {
      case: 'a log with an unknown event',
      text: zealotExport.replace('"XpChanged"', '"NoSuchEvent"'),
      reason: 'invalid',
    },
    {
      case: 'a game with an unknown event',
      text: zealotExport.replace('"ScenarioStarted"', '"NoSuchEvent"'),
      reason: 'invalid',
    },
    {
      case: 'a cause the log could not word',
      text: zealotExport.replace('"interludeId":"the_interlude"', '"interlude":"the_interlude"'),
      reason: 'invalid',
    },
    {
      case: 'a log that does not start the campaign',
      text: JSON.stringify({
        ...JSON.parse(zealotExport),
        events: JSON.parse(zealotExport).events.slice(1),
      }),
      reason: 'invalid',
    },
    {
      case: 'a game that is not the campaign’s',
      text: serialiseCampaignExport(
        { title: 'Zealot', createdAt: 1000, reliance: 'assist' },
        zealotLog,
        [
          {
            ...gathering,
            events: [{ ...gathering.events[0]!, event: standaloneGatheringStarted }],
          },
        ],
      ),
      reason: 'invalid',
    },
    {
      case: 'a campaign without its games',
      text: JSON.stringify({ ...JSON.parse(zealotExport), games: undefined }),
      reason: 'invalid',
    },
    {
      case: 'an export of a newer version',
      text: JSON.stringify({ ...JSON.parse(zealotExport), stateVersion: STATE_VERSION + 1 }),
      reason: 'newerVersion',
    },
  ])('refuses $case', ({ text, reason }) => {
    expect(failureOf(text)).toBe(reason);
  });
});
