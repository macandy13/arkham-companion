import { describe, expect, it } from 'vitest';
import {
  campaign,
  campaignId,
  cardDbWith,
  cardStats,
  instanceId,
  investigatorId,
  mapId,
  scenario,
  skillTestSuggestion,
  zoneKey,
  type CampaignCommand,
  type CampaignLog,
  type Command,
  type Difficulty,
  type GameState,
  type InstanceId,
  type ScenarioContext,
  type Zone,
} from '@arkham/engine';
import {
  makeCampaignLog,
  rolandMember,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  DEVOURER_BELOW_CODES as codes,
  GATHERING_CODES,
  MIDNIGHT_MASKS_RESOLUTIONS,
  ZEALOT_STORY,
  nightOfTheZealot,
  theDevourerBelow,
  theDevourerBelowCardDefs,
  theGatheringCards,
  theMidnightMasksCardDefs,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(
    cardDbWith(cardDbWith(theGatheringCards, theMidnightMasksCardDefs), theDevourerBelowCardDefs),
    [...standardInvestigatorCards, ...zealotInvestigatorCards],
  ),
  scenario: theDevourerBelow,
};
const woods = mapId('woods');
const mainPath = instanceId(`${codes.mainPath}#1`);
const agenda = instanceId(`${codes.theArkhamWoods}#1`);

/** Names of the cards in `zone`, in zone order. */
function namesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map(
    (id) => cardStats(ctx.cards, state.cards[id]!.code).name,
  );
}

describe('The Devourer Below setup', () => {
  it('puts the three agendas and the three acts into their decks', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'agendaDeck' })).toEqual([
      'The Arkham Woods',
      'The Ritual Begins',
      'Vengeance Awaits',
    ]);
    expect(namesIn(state, { kind: 'actDeck' })).toEqual([
      'Investigating the Trail',
      'Into the Darkness',
      'Disrupting the Ritual',
    ]);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'starts on the revealed Main Path with 4 unrevealed Arkham Woods next to it, seed %i',
    (seed) => {
      const state = startScenario(ctx, { seed, playerCount: 2 });
      const locations = state.order[zoneKey({ kind: 'location', mapId: woods })] ?? [];
      const theWoods = locations.filter((id) => id !== mainPath);

      expect(namesIn(state, { kind: 'location', mapId: woods })).toEqual([
        'Main Path',
        ...Array<string>(4).fill('Arkham Woods'),
      ]);
      expect(state.investigators.map((inv) => inv.locationId)).toEqual([mainPath, mainPath]);
      expect(state.cards[mainPath]?.faceUp).toBe(true);
      expect(theWoods.map((id) => state.cards[id]?.faceUp)).toEqual([false, false, false, false]);
      expect(state.board.maps[woods]?.connections).toEqual(
        expect.arrayContaining(theWoods.map((id) => ({ from: mainPath, to: id, oneWay: false }))),
      );
    },
  );

  it('connects the 4 Woods picked with seed 1 along the ring their revealed sides print', () => {
    const state = startScenario(ctx, { seed: 1 });
    const name = (id: InstanceId) =>
      Object.entries(codes).find(([, code]) => code === state.cards[id]?.code)?.[0];

    const betweenWoods = (state.board.maps[woods]?.connections ?? [])
      .filter((edge) => edge.from !== mainPath)
      .map((edge) => [name(edge.from), name(edge.to)]);

    // Unhallowed Ground and Tangled Thicket are left out, and with them their four connections.
    expect(betweenWoods).toEqual([
      ['arkhamWoodsOldHouse', 'arkhamWoodsTwistingPaths'],
      ['arkhamWoodsQuietGlade', 'arkhamWoodsCliffside'],
    ]);
  });

  it('sets aside the Ritual Site and Umôrdhoth', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'setAside' }).sort()).toEqual(['Ritual Site', 'Umôrdhoth']);
  });

  /** The gathered sets' 25 cards, the same whichever Agents set joins them. */
  const gathered = [
    ...['Acolyte', 'Acolyte', 'Acolyte', 'Wizard of the Order'],
    ...['Mysterious Chanting', 'Mysterious Chanting'],
    ...['Ancient Evils', 'Ancient Evils', 'Ancient Evils'],
    ...['Dissonant Voices', 'Dissonant Voices', 'Frozen in Fear', 'Frozen in Fear'],
    ...['Rotting Remains', 'Rotting Remains', 'Rotting Remains'],
    ...['Ghoul Minion', 'Ghoul Minion', 'Ghoul Minion', 'Ravenous Ghoul'],
    ...['Grasping Hands', 'Grasping Hands', 'Grasping Hands'],
    ...["Umôrdhoth's Wrath", "Umôrdhoth's Wrath"],
  ];

  it.each([
    {
      seed: 9,
      agents: ['Offer of Power', 'Offer of Power', 'Yithian Observer', 'Yithian Observer'],
    },
    { seed: 1, agents: ['Goat Spawn', 'Goat Spawn', 'Goat Spawn', 'Relentless Dark Young'] },
    {
      seed: 3,
      agents: ["Dreams of R'lyeh", "Dreams of R'lyeh", 'Young Deep One', 'Young Deep One'],
    },
    {
      seed: 6,
      agents: ['Screeching Byakhee', 'Screeching Byakhee', 'The Yellow Sign', 'The Yellow Sign'],
    },
  ])(
    'shuffles the gathered sets and one Agents set, $agents, with seed $seed',
    ({ seed, agents }) => {
      const state = startScenario(ctx, { seed });

      expect(namesIn(state, { kind: 'encounterDeck' }).sort()).toEqual(
        [...gathered, ...agents].sort(),
      );
    },
  );

  it('adds an elder thing token to the bag', () => {
    const state = startScenario(ctx, { difficulty: 'standard' });

    expect(state.chaosBag.filter((token) => token === 'elderThing')).toEqual(['elderThing']);
  });

  it('places no doom on agenda 1 and no Ghoul Priest in a standalone game', () => {
    const state = startScenario(ctx);

    expect(state.cards[agenda]?.tokens.doom).toBeUndefined();
    expect(namesIn(state, { kind: 'encounterDeck' })).not.toContain('Ghoul Priest');
  });
});

describe('The Devourer Below setup in the campaign', () => {
  const rolandSeat = { id: investigatorId('roland'), code: rolandBanks.code };
  /** Roland alone before The Devourer Below, with `story` in the log. */
  const logWith = (story: CampaignLog['story']) =>
    makeCampaignLog({
      investigators: [rolandMember],
      story,
      scenarioIds: [theDevourerBelow.id],
      position: 0,
    });
  /** The first `count` of the six unique Cultists, as The Midnight Masks' resolution lists them. */
  const gotAway = (count: number): CampaignLog['story'] => ({
    [ZEALOT_STORY.cultistsWhoGotAway]: {
      kind: 'list',
      entries: [
        '"Wolf-Man" Drew',
        'Herman Collins',
        'Peter Warren',
        'Victoria Devereux',
        'Ruth Turner',
        'The Masked Hunter',
      ].slice(0, count),
    },
  });

  it.each([
    { count: 0, doom: undefined },
    { count: 1, doom: 1 },
    { count: 2, doom: 1 },
    { count: 3, doom: 2 },
    { count: 4, doom: 2 },
    { count: 5, doom: 3 },
    { count: 6, doom: 3 },
  ])('places $doom doom on agenda 1 for $count Cultists who got away', ({ count, doom }) => {
    const command = scenario.compileSetup(ctx, {
      seed: 1,
      investigators: [rolandSeat],
      campaign: logWith(gotAway(count)),
    });

    expect(command.cards.find((card) => card.id === agenda)?.tokens?.doom).toBe(doom);
  });

  it('sets up from The Midnight Masks R2: 3 Cultists got away, the Ghoul Priest lives', () => {
    const campaignCtx = { cards: ctx.cards };
    const yes = { kind: 'flag', value: true } as const;
    const records: readonly CampaignCommand[] = [
      { type: 'RecordStory', key: ZEALOT_STORY.ghoulPriestStillAlive, value: yes },
      { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } },
      {
        type: 'RecordStory',
        key: ZEALOT_STORY.cultistsWhoGotAway,
        value: { kind: 'list', entries: ['Peter Warren', 'Victoria Devereux', 'Ruth Turner'] },
      },
      { type: 'RecordStory', key: ZEALOT_STORY.itIsPastMidnight, value: yes },
      {
        type: 'AdvanceScenario',
        outcome: { kind: 'resolution', id: MIDNIGHT_MASKS_RESOLUTIONS.pastMidnight },
      },
    ];
    const started = campaign.executeCommand(
      campaignCtx,
      campaign.createEmptyLog(),
      campaign.compileStart(nightOfTheZealot, {
        campaignId: campaignId('zealot_campaign'),
        difficulty: 'standard',
        investigators: [rolandBanks.code, daisyWalker.code],
      }),
    ).log;
    const log = records.reduce<CampaignLog>(
      (current, record) => campaign.executeCommand(campaignCtx, current, record).log,
      started,
    );

    const command = scenario.compileSetup(ctx, {
      seed: 1,
      investigators: [rolandSeat, { id: investigatorId('daisy'), code: daisyWalker.code }],
      campaign: log,
    });

    expect(campaign.findCurrentScenarioId(log)).toBe(theDevourerBelow.id);
    expect(command.cards.find((card) => card.id === agenda)?.tokens).toEqual({ doom: 2 });
    expect(
      command.cards.filter(
        (card) => card.zone.kind === 'encounterDeck' && card.code === GATHERING_CODES.ghoulPriest,
      ),
    ).toHaveLength(1);
    expect(command.chaosBag).toEqual([...log.chaosBag, 'elderThing']);
  });
});

describe('The Devourer Below skull token', () => {
  /** The skull's change to a willpower test on the Main Path at `difficulty`. */
  function skullWith(difficulty: Difficulty, ...setup: Command[]): number {
    const state = stateAfter(ctx, startScenario(ctx, { difficulty }), ...setup);
    const test = {
      investigatorId: state.investigators[0]!.id,
      skill: 'willpower',
      difficulty: 3,
      locationId: mainPath,
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: ['skull'] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }
  /** Ghoul Minion's ArkhamDB code; 3 copies are in the Ghouls set. */
  const ghoulMinion = '01160';
  const spawnedAtMainPath = (enemyId: InstanceId): Command => ({
    type: 'SpawnEnemy',
    enemyId,
    at: mainPath,
  });

  it.each([
    { difficulty: 'standard', skull: -2, counts: 'the 2 Ghoul Minions, Umôrdhoth is no Monster' },
    { difficulty: 'hard', skull: -3, counts: 'printed' },
  ] as const)('is $skull on $difficulty: $counts', ({ difficulty, skull }) => {
    expect(
      skullWith(
        difficulty,
        spawnedAtMainPath(instanceId(`${codes.umordhoth}#1`)),
        spawnedAtMainPath(instanceId(`${ghoulMinion}#1`)),
        spawnedAtMainPath(instanceId(`${ghoulMinion}#2`)),
      ),
    ).toBe(skull);
  });
});
