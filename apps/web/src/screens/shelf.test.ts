import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RELIANCE,
  type CampaignSummary,
  type GameSummary,
  campaignDefinitionId,
  campaignId,
  gameId,
  scenarioId,
} from '@arkham/engine';
import { campaignStanding, shelfEntries } from './shelf';

/** A saved game named `id`, last changed at `updatedAt`, of `campaign` when given, playing `scenario`. */
function game(
  id: string,
  updatedAt: number,
  { campaign, scenario = 'the-gathering' }: { campaign?: string; scenario?: string } = {},
): GameSummary {
  return {
    gameId: gameId(id),
    title: id,
    campaignId: campaign === undefined ? undefined : campaignId(campaign),
    createdAt: 0,
    updatedAt,
    lastSeq: 0,
    scenarioId: scenarioId(scenario),
    round: 1,
    phase: 'mythos',
    investigators: [],
    reliance: DEFAULT_RELIANCE,
  };
}

/** A campaign log named `id`, last changed at `updatedAt`, `position` scenarios in, ended with `result`. */
function campaign(
  id: string,
  updatedAt: number,
  { position = 0, result }: { position?: number; result?: CampaignSummary['result'] } = {},
): CampaignSummary {
  return {
    campaignId: campaignId(id),
    title: id,
    createdAt: 0,
    updatedAt,
    lastSeq: 0,
    definitionId: campaignDefinitionId('night-of-the-zealot'),
    difficulty: 'standard',
    position,
    scenarioCount: 2,
    investigators: [],
    result,
    reliance: DEFAULT_RELIANCE,
  };
}

const ids = (entries: ReturnType<typeof shelfEntries>) =>
  entries.map((entry) =>
    entry.kind === 'campaign'
      ? `${entry.campaign.campaignId}: ${entry.games.map((g) => g.gameId).join(', ')}`
      : entry.game.gameId,
  );

describe('shelfEntries', () => {
  it('puts a campaign game on its campaign’s cover, and other games on their own', () => {
    const entries = shelfEntries(
      [campaign('zealot', 1)],
      [
        game('masks', 3, { campaign: 'zealot' }),
        game('quick', 2),
        game('gathering', 1, { campaign: 'zealot' }),
      ],
    );

    expect(ids(entries)).toEqual(['zealot: masks, gathering', 'quick']);
  });

  it.each([
    { campaignChanged: 5, gameChanged: 1, quickChanged: 3, order: ['zealot: gathering', 'quick'] },
    { campaignChanged: 1, gameChanged: 5, quickChanged: 3, order: ['zealot: gathering', 'quick'] },
    { campaignChanged: 1, gameChanged: 2, quickChanged: 3, order: ['quick', 'zealot: gathering'] },
  ])(
    'orders covers by their newest change: campaign $campaignChanged, its game $gameChanged, a quick game $quickChanged',
    ({ campaignChanged, gameChanged, quickChanged, order }) => {
      const entries = shelfEntries(
        [campaign('zealot', campaignChanged)],
        [game('quick', quickChanged), game('gathering', gameChanged, { campaign: 'zealot' })],
      );

      expect(ids(entries)).toEqual(order);
    },
  );

  it('keeps a game whose campaign is not on this device on a cover of its own', () => {
    const entries = shelfEntries([], [game('imported', 1, { campaign: 'elsewhere' })]);

    expect(ids(entries)).toEqual(['imported']);
  });
});

describe('campaignStanding', () => {
  const scenarios = [scenarioId('the-gathering'), scenarioId('the-midnight-masks')];

  it.each([
    {
      case: 'a chapter with its game under way',
      log: campaign('zealot', 1, { position: 1 }),
      games: [game('masks', 2, { scenario: 'the-midnight-masks' }), game('gathering', 1)],
      standing: { kind: 'playing', chapter: 2, scenarioId: 'the-midnight-masks', game: 'masks' },
    },
    {
      case: 'a chapter whose game is not set up yet',
      log: campaign('zealot', 1, { position: 1 }),
      games: [game('gathering', 1)],
      standing: { kind: 'setUp', chapter: 2, scenarioId: 'the-midnight-masks' },
    },
    {
      case: 'every scenario played, the ending not written',
      log: campaign('zealot', 1, { position: 2 }),
      games: [],
      standing: { kind: 'ending' },
    },
    {
      case: 'a campaign that is over',
      log: campaign('zealot', 1, { position: 2, result: 'won' }),
      games: [],
      standing: { kind: 'over', result: 'won' },
    },
  ])('reads $case', ({ log, games, standing }) => {
    const found = campaignStanding(log, games, scenarios);

    expect(found.kind === 'playing' ? { ...found, game: found.game.gameId } : found).toEqual(
      standing,
    );
  });
});
