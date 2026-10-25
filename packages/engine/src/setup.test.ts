import { describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardCode,
  cardDbFrom,
  encounterSetCode,
  scenarioId,
  scenario,
  instanceId,
  cardImagePath,
  investigatorCode,
  investigatorCardStats,
  investigatorId,
  mapId,
  fixed,
  perInvestigator,
  spawnZone,
  type AddMapStep,
  type CampaignLog,
  type SetupStep,
} from './index';
import {
  campaignContext,
  daisy,
  daisyMember,
  investigatorSeats,
  makeCampaignLog,
  makeDefinition,
  makeSetupOptions,
  rejectionOf,
  roland,
  rolandMember,
  standardInvestigatorCards,
  wendy,
} from '../test/utils';

const main = mapId('main');
/** A card db with only the standard investigators, whom `makeSetupOptions` seats. */
const investigatorCards = cardDbFrom(standardInvestigatorCards);

/** A map step for `main` with the given locations (unrevealed) and no connections. */
function mainMap(...codes: string[]): AddMapStep {
  return {
    kind: 'addMap',
    mapId: main,
    name: 'Main',
    locations: codes.map((code) => ({ code: cardCode(code) })),
  };
}

describe('compileSetup', () => {
  it('copies identity, difficulty, seed and the chaos bag for the difficulty', () => {
    const def = makeDefinition({
      id: scenarioId('demo'),
      chaosBag: { easy: ['+1'], standard: [], hard: ['-4', 'skull'], expert: [] },
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions({ difficulty: 'hard', seed: 42 }),
    );

    expect(command).toMatchObject({
      type: 'StartScenario',
      scenarioId: 'demo',
      difficulty: 'hard',
      seed: 42,
      chaosBag: ['-4', 'skull'],
    });
  });

  it('puts agendas and acts into their decks in order, side a up', () => {
    const def = makeDefinition({
      agendaDeck: [cardCode('ag1'), cardCode('ag2')],
      actDeck: [cardCode('act1')],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.cards).toEqual([
      { id: 'ag1#1', code: 'ag1', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: 'ag2#1', code: 'ag2', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: 'act1#1', code: 'act1', zone: { kind: 'actDeck' }, faceUp: true },
    ]);
  });

  it('sets cards aside and numbers copies of the same code', () => {
    const def = makeDefinition({
      setup: [{ kind: 'setAside', codes: [cardCode('x'), cardCode('x'), cardCode('y')] }],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.cards.map((c) => [c.id, c.zone.kind])).toEqual([
      ['x#1', 'setAside'],
      ['x#2', 'setAside'],
      ['y#1', 'setAside'],
    ]);
  });

  it('spawns an enemy at a location', () => {
    const def = makeDefinition({
      setup: [mainMap('loc'), { kind: 'spawn', code: cardCode('enemy'), at: cardCode('loc') }],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.cards[1]).toEqual({
      id: 'enemy#1',
      code: 'enemy',
      zone: spawnZone(instanceId('loc#1')),
      faceUp: true,
    });
  });

  it('spawns an enemy with the doom its "after it enters play" ability places', () => {
    const def = makeDefinition({
      setup: [
        mainMap('loc'),
        { kind: 'spawn', code: cardCode('acolyte'), at: cardCode('loc'), tokens: { doom: 1 } },
      ],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.cards[1]).toMatchObject({ id: 'acolyte#1', tokens: { doom: 1 } });
  });

  it('seats investigators in the given order with the printed stats and picture of their card', () => {
    const roland = {
      code: investigatorCode('01001'),
      name: 'Roland Banks',
      health: 9,
      sanity: 5,
      skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
    };
    const daisy = {
      code: investigatorCode('01002'),
      name: 'Daisy Walker',
      health: 5,
      sanity: 9,
      skills: { willpower: 3, intellect: 5, combat: 2, agility: 2 },
      imageSrc: cardImagePath('/bundles/cards/01002.png'),
    };
    const ctx = {
      cards: cardDbFrom([
        investigatorCardStats(roland),
        investigatorCardStats(daisy),
        ...standardInvestigatorCards,
      ]),
    };
    const seats = [
      { id: investigatorId('daisy'), code: daisy.code },
      { id: investigatorId('roland'), code: roland.code },
    ];

    const command = scenario.compileSetup(
      { ...ctx, scenario: makeDefinition() },
      makeSetupOptions({ investigators: seats }),
    );

    expect(command.investigators).toEqual([
      {
        id: 'daisy',
        code: daisy.code,
        name: 'Daisy Walker',
        seat: 0,
        health: { max: 5, damage: 0 },
        sanity: { max: 9, horror: 0 },
        clues: 0,
        resources: 5,
        doomOnPlayerCards: 0,
        skills: daisy.skills,
        imageSrc: '/bundles/cards/01002.png',
        status: 'active',
      },
      expect.objectContaining({ id: 'roland', name: 'Roland Banks', seat: 1 }),
    ]);
  });

  it('rejects a seat whose code has no investigator card', () => {
    const notACard = investigatorCode('not_a_card');
    const seats = [{ id: investigatorId('nobody'), code: notACard }];

    const rejection = rejectionOf(() =>
      scenario.compileSetup(
        { cards: investigatorCards, scenario: makeDefinition() },
        makeSetupOptions({ investigators: seats }),
      ),
    );

    expect(rejection).toEqual({ code: 'unknownInvestigatorCard', investigatorCode: notACard });
  });

  it('places investigators at a location and reveals it with its clues', () => {
    const ctx = {
      cards: cardDbFrom([
        blankLocation('start', { clues: perInvestigator(1) }),
        ...standardInvestigatorCards,
      ]),
    };
    const def = makeDefinition({
      setup: [mainMap('start'), { kind: 'moveInvestigators', to: cardCode('start') }],
    });

    const command = scenario.compileSetup(
      { ...ctx, scenario: def },
      makeSetupOptions({ investigators: investigatorSeats(2) }),
    );

    expect(command.investigators.map((inv) => inv.locationId)).toEqual(['start#1', 'start#1']);
    expect(command.cards[0]).toMatchObject({ faceUp: true, tokens: { clue: 2 } });
  });

  it('leaves investigators unplaced without a moveInvestigators step', () => {
    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: makeDefinition() },
      makeSetupOptions(),
    );

    expect(command.investigators[0]?.locationId).toBeUndefined();
  });

  it('places a fixed number of tokens and adds to tokens already there', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: [cardCode('target')] },
        { kind: 'placeTokens', target: cardCode('target'), token: 'doom', amount: 1 },
        { kind: 'placeTokens', target: cardCode('target'), token: 'doom', amount: 2 },
      ],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.cards[0]?.tokens).toEqual({ doom: 3 });
  });

  it('places tokens per investigator', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: [cardCode('target')] },
        {
          kind: 'placeTokens',
          target: cardCode('target'),
          token: 'clue',
          amount: perInvestigator(2),
        },
      ],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions({ investigators: investigatorSeats(3) }),
    );

    expect(command.cards[0]?.tokens).toEqual({ clue: 6 });
  });

  it('rejects a step that targets a card no earlier step created', () => {
    const def = makeDefinition({ setup: [{ kind: 'moveInvestigators', to: cardCode('missing') }] });

    const rejection = rejectionOf(() =>
      scenario.compileSetup({ cards: investigatorCards, scenario: def }, makeSetupOptions()),
    );

    expect(rejection).toEqual({ code: 'setupTargetNotFound', cardCode: 'missing' });
  });

  it('rejects a step that targets a code with several instances', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: [cardCode('twin'), cardCode('twin')] },
        { kind: 'placeTokens', target: cardCode('twin'), token: 'doom', amount: 1 },
      ],
    });

    const rejection = rejectionOf(() =>
      scenario.compileSetup({ cards: investigatorCards, scenario: def }, makeSetupOptions()),
    );

    expect(rejection).toEqual({ code: 'setupTargetAmbiguous', cardCode: 'twin' });
  });
});

describe('compileSetup addMap', () => {
  it('adds several maps, visible unless stated otherwise', () => {
    const def = makeDefinition({
      setup: [
        mainMap(),
        { kind: 'addMap', mapId: mapId('dream'), name: 'Dream', visible: false, locations: [] },
      ],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.maps).toEqual({
      main: { name: 'Main', visible: true, connections: [], layout: {} },
      dream: { name: 'Dream', visible: false, connections: [], layout: {} },
    });
  });

  it('lays the locations out in the cells the step gives them', () => {
    const ctx = {
      cards: cardDbFrom([blankLocation('a'), blankLocation('b'), ...standardInvestigatorCards]),
    };
    const def = makeDefinition({
      setup: [
        {
          ...mainMap(),
          locations: [{ code: cardCode('a'), at: { column: 0, row: 1 } }, { code: cardCode('b') }],
        },
      ],
    });

    const command = scenario.compileSetup({ ...ctx, scenario: def }, makeSetupOptions());

    expect(command.maps?.[main]?.layout).toEqual({ 'a#1': { column: 0, row: 1 } });
  });

  it('puts its locations onto the map unrevealed unless face up', () => {
    const ctx = { cards: cardDbFrom([blankLocation('b'), ...standardInvestigatorCards]) };
    const def = makeDefinition({
      setup: [
        {
          ...mainMap(),
          locations: [{ code: cardCode('a') }, { code: cardCode('b'), faceUp: true }],
        },
      ],
    });

    const command = scenario.compileSetup({ ...ctx, scenario: def }, makeSetupOptions());

    expect(command.cards).toEqual([
      { id: 'a#1', code: 'a', zone: { kind: 'location', mapId: main }, faceUp: false },
      { id: 'b#1', code: 'b', zone: { kind: 'location', mapId: main }, faceUp: true },
    ]);
  });

  it('places clues per investigator on a location put into play revealed', () => {
    const ctx = {
      cards: cardDbFrom([
        blankLocation('loc', { clues: perInvestigator(2) }),
        ...standardInvestigatorCards,
      ]),
    };
    const def = makeDefinition({
      setup: [{ ...mainMap(), locations: [{ code: cardCode('loc'), faceUp: true }] }],
    });

    const command = scenario.compileSetup(
      { ...ctx, scenario: def },
      makeSetupOptions({ investigators: investigatorSeats(2) }),
    );

    expect(command.cards[0]?.tokens).toEqual({ clue: 4 });
  });

  it('places no clue tokens on a revealed location without clues', () => {
    const ctx = {
      cards: cardDbFrom([
        blankLocation('loc', { clues: perInvestigator(0) }),
        ...standardInvestigatorCards,
      ]),
    };
    const def = makeDefinition({
      setup: [{ ...mainMap(), locations: [{ code: cardCode('loc'), faceUp: true }] }],
    });

    const command = scenario.compileSetup({ ...ctx, scenario: def }, makeSetupOptions());

    expect(command.cards[0]?.tokens).toBeUndefined();
  });

  it('connects its locations two-way by default and one-way on request', () => {
    const def = makeDefinition({
      setup: [
        {
          ...mainMap('a', 'b'),
          connections: [
            { from: cardCode('a'), to: cardCode('b') },
            { from: cardCode('b'), to: cardCode('a'), oneWay: true },
          ],
        },
      ],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.maps?.[main]?.connections).toEqual([
      { from: 'a#1', to: 'b#1', oneWay: false },
      { from: 'b#1', to: 'a#1', oneWay: true },
    ]);
  });

  it('resolves connection codes among its own locations only', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: [cardCode('a')] },
        { ...mainMap('a', 'b'), connections: [{ from: cardCode('a'), to: cardCode('b') }] },
      ],
    });

    const command = scenario.compileSetup(
      { cards: investigatorCards, scenario: def },
      makeSetupOptions(),
    );

    expect(command.maps?.[main]?.connections).toEqual([{ from: 'a#2', to: 'b#1', oneWay: false }]);
  });

  it('rejects a connection to a location that is not on the map', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: [cardCode('b')] },
        { ...mainMap('a'), connections: [{ from: cardCode('a'), to: cardCode('b') }] },
      ],
    });

    const rejection = rejectionOf(() =>
      scenario.compileSetup({ cards: investigatorCards, scenario: def }, makeSetupOptions()),
    );

    expect(rejection).toEqual({ code: 'setupTargetNotFound', cardCode: 'b' });
  });
});

describe('compileSetup buildEncounterDeck', () => {
  const ghoul = blankEnemy('ghoul', { encounterCode: encounterSetCode('set1'), quantity: 3 });
  const curse = blankTreachery('curse', { encounterCode: encounterSetCode('set1'), quantity: 2 });
  const rat = blankEnemy('rat', { encounterCode: encounterSetCode('set2') });
  const room = blankLocation('room', { encounterCode: encounterSetCode('set1') });
  const plan = blankAgenda('plan', fixed(3), { encounterCode: encounterSetCode('set1') });
  const ctx = { cards: cardDbFrom([ghoul, curse, rat, room, plan, ...standardInvestigatorCards]) };

  function deckCodes(setup: SetupStep[]): string[] {
    const command = scenario.compileSetup(
      { ...ctx, scenario: makeDefinition({ setup }) },
      makeSetupOptions(),
    );
    return command.cards
      .filter((card) => card.zone.kind === 'encounterDeck')
      .map((card) => card.code);
  }

  it('adds every copy of the enemies and treacheries in the given sets', () => {
    const codes = deckCodes([
      { kind: 'buildEncounterDeck', sets: [encounterSetCode('set1'), encounterSetCode('set2')] },
    ]);

    expect(codes).toEqual(['ghoul', 'ghoul', 'ghoul', 'curse', 'curse', 'rat']);
  });

  it('leaves out copies that other steps put on the table, before or after the deck', () => {
    const codes = deckCodes([
      { kind: 'setAside', codes: [cardCode('ghoul')] },
      { kind: 'buildEncounterDeck', sets: [encounterSetCode('set1')] },
      { kind: 'setAside', codes: [cardCode('curse'), cardCode('curse')] },
    ]);

    expect(codes).toEqual(['ghoul', 'ghoul']);
  });

  it('leaves out every copy of an excluded code', () => {
    const codes = deckCodes([
      {
        kind: 'buildEncounterDeck',
        sets: [encounterSetCode('set1')],
        exclude: [cardCode('ghoul')],
      },
    ]);

    expect(codes).toEqual(['curse', 'curse']);
  });

  it('counts a card without a quantity as one copy', () => {
    const codes = deckCodes([{ kind: 'buildEncounterDeck', sets: [encounterSetCode('set2')] }]);

    expect(codes).toEqual(['rat']);
  });

  it('shuffles in a card of a set it does not gather', () => {
    const codes = deckCodes([
      { kind: 'buildEncounterDeck', sets: [encounterSetCode('set1')] },
      { kind: 'shuffleIntoEncounterDeck', codes: [cardCode('rat')] },
    ]);

    expect(codes).toEqual(['ghoul', 'ghoul', 'ghoul', 'curse', 'curse', 'rat']);
  });

  it('adds no extra copy for a shuffled-in card of a gathered set: still 3 ghouls', () => {
    const codes = deckCodes([
      { kind: 'buildEncounterDeck', sets: [encounterSetCode('set1')] },
      { kind: 'shuffleIntoEncounterDeck', codes: [cardCode('ghoul')] },
    ]);

    expect(codes.filter((code) => code === 'ghoul')).toHaveLength(3);
  });

  it('rejects an encounter set without cards', () => {
    const def = makeDefinition({
      setup: [{ kind: 'buildEncounterDeck', sets: [encounterSetCode('typo')] }],
    });

    const rejection = rejectionOf(() =>
      scenario.compileSetup({ ...ctx, scenario: def }, makeSetupOptions()),
    );

    expect(rejection).toEqual({ code: 'unknownEncounterSet', encounterCode: 'typo' });
  });
});

describe('compileSetup in a campaign', () => {
  const theGathering = scenarioId('the_gathering');
  const theMidnightMasks = scenarioId('the_midnight_masks');
  const rolandSeat = { id: investigatorId('roland'), code: roland.code };
  const daisySeat = { id: investigatorId('daisy'), code: daisy.code };
  /** The Midnight Masks, whose own bag the campaign's bag replaces. */
  const midnightMasks = {
    cards: campaignContext.cards,
    scenario: makeDefinition({
      id: theMidnightMasks,
      chaosBag: { easy: ['+1'], standard: ['0'], hard: ['-2'], expert: ['-3'] },
    }),
  };
  /** Roland and Daisy before The Midnight Masks, on hard, with a bag the first scenario changed. */
  const beforeMidnightMasks = makeCampaignLog({
    difficulty: 'hard',
    investigators: [rolandMember, daisyMember],
    chaosBag: ['-1', 'skull', 'cultist'],
    scenarioIds: [theGathering, theMidnightMasks],
    position: 1,
  });

  it('takes the difficulty and the chaos bag from the log and passes the log on', () => {
    const command = scenario.compileSetup(midnightMasks, {
      seed: 1,
      investigators: [rolandSeat, daisySeat],
      campaign: beforeMidnightMasks,
    });

    expect(command).toMatchObject({
      difficulty: 'hard',
      chaosBag: ['-1', 'skull', 'cultist'],
      campaign: beforeMidnightMasks,
    });
  });

  it('starts each investigator with damage for physical and horror for mental trauma', () => {
    const log = {
      ...beforeMidnightMasks,
      investigators: [
        { ...rolandMember, physicalTrauma: 2 },
        { ...daisyMember, mentalTrauma: 1 },
      ],
    };

    const command = scenario.compileSetup(midnightMasks, {
      seed: 1,
      investigators: [daisySeat, rolandSeat],
      campaign: log,
    });

    expect(command.investigators).toMatchObject([
      { code: daisy.code, health: { damage: 0 }, sanity: { horror: 1 } },
      { code: roland.code, health: { damage: 2 }, sanity: { horror: 0 } },
    ]);
  });

  it.each([
    [
      'a scenario other than the next one',
      { ...beforeMidnightMasks, position: 0 },
      [rolandSeat, daisySeat],
      { code: 'notNextCampaignScenario', scenarioId: theMidnightMasks, next: theGathering },
    ],
    [
      'a finished campaign',
      { ...beforeMidnightMasks, position: 2 },
      [rolandSeat, daisySeat],
      { code: 'notNextCampaignScenario', scenarioId: theMidnightMasks, next: undefined },
    ],
    [
      'an investigator who is not on the team',
      beforeMidnightMasks,
      [rolandSeat, daisySeat, { id: investigatorId('wendy'), code: wendy.code }],
      { code: 'notOnCampaignTeam', investigatorCode: wendy.code },
    ],
    [
      'a killed investigator',
      { ...beforeMidnightMasks, investigators: [rolandMember, { ...daisyMember, fate: 'killed' }] },
      [rolandSeat, daisySeat],
      { code: 'investigatorNeedsReplacement', investigatorCode: daisy.code, fate: 'killed' },
    ],
    [
      'an insane investigator',
      { ...beforeMidnightMasks, investigators: [{ ...rolandMember, fate: 'insane' }, daisyMember] },
      [rolandSeat, daisySeat],
      { code: 'investigatorNeedsReplacement', investigatorCode: roland.code, fate: 'insane' },
    ],
    [
      'a team without one of its members',
      beforeMidnightMasks,
      [rolandSeat],
      { code: 'campaignMemberNotSeated', investigatorCode: daisy.code },
    ],
  ] as const)('rejects %s', (_, log, seats, rejection) => {
    expect(
      rejectionOf(() =>
        scenario.compileSetup(midnightMasks, { seed: 1, investigators: seats, campaign: log }),
      ),
    ).toEqual(rejection);
  });
});

describe('compileSetup whenStory', () => {
  const theMidnightMasks = scenarioId('the_midnight_masks');
  const rolandSeat = { id: investigatorId('roland'), code: roland.code };
  const yourHouse = blankLocation('your_house');
  const rivertown = blankLocation('rivertown');
  const ghoulPriest = blankEnemy('ghoul_priest', { encounterCode: encounterSetCode('ghouls') });
  const ghoul = blankEnemy('ghoul', { encounterCode: encounterSetCode('ghouls') });
  const cards = cardDbFrom([
    yourHouse,
    rivertown,
    ghoulPriest,
    ghoul,
    ...[roland].map(investigatorCardStats),
  ]);
  /** Roland alone before The Midnight Masks, with `story` in the log. */
  const logWith = (story: CampaignLog['story']) =>
    makeCampaignLog({
      investigators: [rolandMember],
      story,
      scenarioIds: [theMidnightMasks],
      position: 0,
    });
  /** Investigators start at their house if it still stands, else in Rivertown. */
  const startAtHouseIfStanding: SetupStep[] = [
    mainMap('your_house', 'rivertown'),
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: 'houseStillStanding', value: true },
      then: [{ kind: 'moveInvestigators', to: cardCode('your_house') }],
      otherwise: [{ kind: 'moveInvestigators', to: cardCode('rivertown') }],
    },
  ];
  const masksWith = (setup: SetupStep[]) => ({
    cards,
    scenario: makeDefinition({ id: theMidnightMasks, setup }),
  });

  it.each([
    [
      'the house still stands',
      { houseStillStanding: { kind: 'flag', value: true } },
      'your_house#1',
    ],
    [
      'the house burned down',
      { houseStillStanding: { kind: 'flag', value: false } },
      'rivertown#1',
    ],
    ['the log never mentions the house', {}, 'rivertown#1'],
  ] as const)('places the investigators by the log when %s', (_, story, start) => {
    const command = scenario.compileSetup(masksWith(startAtHouseIfStanding), {
      seed: 1,
      investigators: [rolandSeat],
      campaign: logWith(story),
    });

    expect(command.investigators[0]?.locationId).toBe(start);
  });

  it('takes the otherwise steps in a standalone game', () => {
    const command = scenario.compileSetup(masksWith(startAtHouseIfStanding), {
      difficulty: 'standard',
      seed: 1,
      investigators: [rolandSeat],
    });

    expect(command.investigators[0]?.locationId).toBe('rivertown#1');
  });

  it.each([
    ['still alive', true, ['ghoul_priest', 'ghoul']],
    ['defeated', false, ['ghoul']],
  ] as const)(
    'shuffles the Ghoul Priest into the encounter deck only while he is %s',
    (_, alive, deck) => {
      const setup: SetupStep[] = [
        {
          kind: 'whenStory',
          condition: { kind: 'flag', key: 'ghoulPriestStillAlive', value: true },
          then: [{ kind: 'buildEncounterDeck', sets: [encounterSetCode('ghouls')] }],
          otherwise: [
            {
              kind: 'buildEncounterDeck',
              sets: [encounterSetCode('ghouls')],
              exclude: [cardCode('ghoul_priest')],
            },
          ],
        },
      ];

      const command = scenario.compileSetup(masksWith(setup), {
        seed: 1,
        investigators: [rolandSeat],
        campaign: logWith({ ghoulPriestStillAlive: { kind: 'flag', value: alive } }),
      });

      expect(command.cards.map((card) => card.code)).toEqual(deck);
    },
  );

  it('rejects a condition on a record of another kind', () => {
    const rejection = rejectionOf(() =>
      scenario.compileSetup(masksWith(startAtHouseIfStanding), {
        seed: 1,
        investigators: [rolandSeat],
        campaign: logWith({ houseStillStanding: { kind: 'count', value: 1 } }),
      }),
    );

    expect(rejection).toEqual({
      code: 'storyConditionMismatch',
      key: 'houseStillStanding',
      condition: 'flag',
    });
  });
});

describe('compileSetup location versions', () => {
  const rivertown = cardCode('rivertown');
  const downtownBank = cardCode('downtown_bank');
  const downtownAsylum = cardCode('downtown_asylum');
  const ctx = {
    cards: cardDbFrom([
      blankLocation('rivertown'),
      blankLocation('downtown_bank'),
      blankLocation('downtown_asylum'),
      blankEnemy('acolyte'),
      ...standardInvestigatorCards,
    ]),
  };
  /**
   * Rivertown next to Downtown, one of its two versions; an Acolyte spawns at Downtown, which
   * gets 1 doom, and the investigators start there.
   */
  const def = makeDefinition({
    setup: [
      {
        ...mainMap(),
        locations: [
          { code: rivertown },
          { code: downtownBank, versions: [downtownAsylum], at: { column: 1, row: 0 } },
        ],
        connections: [{ from: rivertown, to: downtownBank }],
      },
      { kind: 'spawn', code: cardCode('acolyte'), at: downtownBank },
      { kind: 'placeTokens', target: downtownBank, token: 'doom', amount: 1 },
      { kind: 'moveInvestigators', to: downtownBank },
    ],
  });

  it.each([
    { seed: 1, downtown: 'downtown_bank#1' },
    { seed: 3, downtown: 'downtown_asylum#1' },
  ])('puts $downtown into play with seed $seed, in its place on the map', ({ seed, downtown }) => {
    const command = scenario.compileSetup({ ...ctx, scenario: def }, makeSetupOptions({ seed }));

    expect(command.cards.map((card) => card.id)).toEqual(['rivertown#1', downtown, 'acolyte#1']);
    expect(command.maps?.[main]).toMatchObject({
      connections: [{ from: 'rivertown#1', to: downtown }],
      layout: { [downtown]: { column: 1, row: 0 } },
    });
    expect(command.cards[2]?.zone).toEqual({ kind: 'atLocation', locationId: downtown });
    expect(command.cards[1]?.tokens).toEqual({ doom: 1 });
    expect(command.investigators[0]?.locationId).toBe(downtown);
  });
});

describe('compileSetup whenPlayers', () => {
  const ctx = {
    cards: cardDbFrom([
      blankLocation('southside'),
      blankLocation('graveyard'),
      blankEnemy('acolyte', { quantity: 3 }),
      ...standardInvestigatorCards,
    ]),
  };
  /** One Acolyte at Southside with 2 or more investigators, another at the Graveyard with 3 or more. */
  const def = makeDefinition({
    setup: [
      mainMap('southside', 'graveyard'),
      {
        kind: 'whenPlayers',
        atLeast: 2,
        then: [{ kind: 'spawn', code: cardCode('acolyte'), at: cardCode('southside') }],
      },
      {
        kind: 'whenPlayers',
        atLeast: 3,
        then: [{ kind: 'spawn', code: cardCode('acolyte'), at: cardCode('graveyard') }],
      },
    ],
  });

  it.each([
    { players: 1, acolytes: [] },
    { players: 2, acolytes: ['southside#1'] },
    { players: 3, acolytes: ['southside#1', 'graveyard#1'] },
  ])('spawns Acolytes at $acolytes with $players investigators', ({ players, acolytes }) => {
    const command = scenario.compileSetup(
      { ...ctx, scenario: def },
      makeSetupOptions({ investigators: investigatorSeats(players) }),
    );

    expect(
      command.cards.filter((card) => card.code === 'acolyte').map((card) => card.zone),
    ).toEqual(acolytes.map((locationId) => ({ kind: 'atLocation', locationId })));
  });
});

describe('pickReferenceSide', () => {
  it.each([
    ['easy', 'easyStandard'],
    ['standard', 'easyStandard'],
    ['hard', 'hardExpert'],
    ['expert', 'hardExpert'],
  ] as const)('reads the %s difficulty from the %s side', (difficulty, side) => {
    expect(scenario.pickReferenceSide(difficulty)).toBe(side);
  });
});
