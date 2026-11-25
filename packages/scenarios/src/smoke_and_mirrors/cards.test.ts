import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankTreachery,
  effectiveValue,
  encounterDeck,
  encounterDiscard,
  engagedWith,
  encounterSetCode,
  execute,
  instanceId,
  investigatorId,
  newGame,
  requireInvestigator,
  resignAction,
  resolveValue,
  skillValues,
  threatAreaOf,
  type CardStats,
  type Command,
  type Event,
  type InvestigatorId,
  type LocationSymbol,
  type Zone,
} from '@arkham/engine';
import {
  answer,
  cardIn,
  rejectionFrom,
  resolveRevelation,
  runFrom,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  ARCANE_LOCK_DECISION,
  DOWNPOUR_DECISION,
  SANATORIUM_DECISION,
  SMOKE_AND_MIRRORS_CODES,
  smokeAndMirrorsCardDefs,
  smokeAndMirrorsCards,
} from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(smokeAndMirrorsCards, code);

describe('Smoke and Mirrors card data', () => {
  it.each([
    { code: '12145', name: 'Downtown (First Bank)', symbol: 'triangle', connectsTo: ['moon', 't'] },
    { code: '12146', name: 'Downtown (Sanatorium)', symbol: 'triangle', connectsTo: ['moon', 't'] },
    { code: '12147', name: 'Uptown (Hospital)', symbol: 'plus', connectsTo: ['diamond', 'square'] },
    { code: '12148', name: 'Uptown (Shoppe)', symbol: 'plus', connectsTo: ['diamond', 'square'] },
    { code: '12149', name: 'Northside', symbol: 't', connectsTo: ['diamond', 'triangle'] },
    {
      code: '12150',
      name: 'Easttown',
      symbol: 'moon',
      connectsTo: ['circle', 'triangle', 'spade'],
    },
    {
      code: '12151',
      name: 'Merchant District',
      symbol: 'circle',
      connectsTo: ['moon', 'diamond', 'square', 'spade'],
    },
    { code: '12152', name: 'Waterfront District', symbol: 'spade', connectsTo: ['circle', 'moon'] },
    {
      code: '12153',
      name: 'Southside',
      symbol: 'square',
      connectsTo: ['plus', 'hourglass', 'circle'],
    },
    { code: '12154', name: 'French Hill', symbol: 'hourglass', connectsTo: ['square'] },
    {
      code: '12155',
      name: 'Miskatonic University (In Flames)',
      symbol: 'diamond',
      connectsTo: ['t', 'plus', 'circle'],
    },
    {
      code: '12156',
      name: 'Miskatonic University (Quiet Campus)',
      symbol: 'diamond',
      connectsTo: ['t', 'plus', 'circle'],
    },
  ])(
    'gives $name its printed $symbol, connecting to $connectsTo on both sides',
    ({ code, symbol, connectsTo }) => {
      const card = cardOf(code);

      expect(card.symbol).toBe(symbol);
      expect(card.connectsTo).toEqual(connectsTo);
      expect(card.unrevealedSymbol).toBeUndefined();
      expect(card.unrevealedConnectsTo).toBeUndefined();
    },
  );

  it('connects each Arkham location to a location that connects back to it', () => {
    const locations = smokeAndMirrorsCardDefs.filter((card) => card.typeCode === 'location');
    const symbolsConnectingTo = (symbol: LocationSymbol | undefined) =>
      locations
        .filter((card) => symbol !== undefined && card.connectsTo?.includes(symbol))
        .map((card) => card.symbol);

    const oneWay = locations.flatMap((card) =>
      (card.connectsTo ?? [])
        .filter((target) => !symbolsConnectingTo(card.symbol).includes(target))
        .map((target) => `${card.name} → ${target}`),
    );

    expect(oneWay).toEqual([]);
  });

  it.each([
    { set: 'smoke_and_mirrors', copies: 5, cards: '4 Mark of Elokoss, Servant of Flame' },
    { set: 'people_of_arkham', copies: 6, cards: 'the six suspects' },
    { set: 'arcane_lock', copies: 2, cards: '2 Arcane Lock' },
    { set: 'bad_weather', copies: 4, cards: '2 Downpour, 2 Flash Flood' },
    { set: 'dead_ends', copies: 4, cards: '2 Raising Suspicions, 2 Red Herring' },
    { set: 'flying_terrors', copies: 4, cards: '2 Bat Horror, 2 Aerial Pursuit' },
    { set: 'gangs_of_arkham', copies: 4, cards: '2 Rogue Gangster, 2 Crossfire' },
    { set: 'whippoorwills_ch2', copies: 5, cards: '3 Whippoorwill, 2 Eager for Death' },
  ])('has $copies enemy and treachery copies in set $set: $cards', ({ set, copies }) => {
    const encounterCards = smokeAndMirrorsCardDefs.filter(
      (card) =>
        card.encounterCode === encounterSetCode(set) &&
        (card.typeCode === 'enemy' || card.typeCode === 'treachery'),
    );

    const total = encounterCards.reduce((sum, card) => sum + (card.quantity ?? 1), 0);

    expect(total).toBe(copies);
  });

  it('has the twelve Arkham locations, two versions each of Downtown, Uptown and Miskatonic University', () => {
    const locations = smokeAndMirrorsCardDefs.filter((card) => card.typeCode === 'location');

    expect(locations.map((card) => card.name)).toEqual([
      'Downtown',
      'Downtown',
      'Uptown',
      'Uptown',
      'Northside',
      'Easttown',
      'Merchant District',
      'Waterfront District',
      'Southside',
      'French Hill',
      'Miskatonic University',
      'Miskatonic University',
    ]);
  });

  it.each([
    { code: '12134', name: 'Arkham Alive' },
    { code: '12135', name: 'Emergent Evils' },
  ])('lets the investigators resign at $name', ({ code }) => {
    expect(cardOf(code).actions).toEqual([resignAction()]);
  });

  it.each([
    { players: 1, health: 5 },
    { players: 4, health: 20 },
  ])(
    'gives the Servant of Flame $health health with $players investigator(s)',
    ({ players, health }) => {
      const printed = cardOf('12138').health;

      expect(printed && resolveValue(printed, players)).toBe(health);
    },
  );
});

describe('Smoke and Mirrors card abilities', () => {
  const alice = investigatorId('alice');
  const bob = investigatorId('bob');
  const northside = instanceId('northside');
  /** Alice draws the encounter card named `card`. */
  const aliceDraws = (card: string): Command => ({
    type: 'DrawCard',
    investigatorId: alice,
    from: encounterDeck,
    pick: { match: { name: card } },
  });

  describe('Rogue Gangster', () => {
    it.each([
      { resources: 2, left: 1, attacks: false },
      { resources: 0, left: 0, attacks: true },
    ])(
      'takes 1 of the $resources resources alice has as it engages her, or attacks her without any: attacks $attacks',
      ({ resources, left, attacks }) => {
        const gangster = instanceId('rogue_gangster');
        const { context, state: started } = newGame()
          .withLocation(northside, cardOf('12149'), { revealed: true })
          .withInvestigator(alice, { locationId: northside, resources })
          .withCard(gangster, cardOf('12164'), encounterDeck)
          .withCard(instanceId('bottom_card'), cardOf('12164'), encounterDeck)
          .withTurnOf(alice)
          .start();

        const state = stateAfter(context, started, aliceDraws('Rogue Gangster'));

        expect(state.cards[gangster]?.zone).toEqual(engagedWith(alice));
        expect(requireInvestigator(state, alice).resources).toBe(left);
        expect(state.pending.map((decision) => decision.id)).toEqual(
          attacks ? ['cardAttack:rogue_gangster:alice'] : [],
        );
      },
    );
  });

  describe('Downtown (First Bank of Arkham)', () => {
    it('gives alice 1 resource when she uses its reaction after discovering a clue there', () => {
      const bank = instanceId('first_bank');
      const { context, state: started } = newGame()
        .withLocation(bank, cardOf(SMOKE_AND_MIRRORS_CODES.downtownFirstBank), {
          revealed: true,
          clues: 2,
        })
        .withInvestigator(alice, { locationId: bank, resources: 0 })
        .withTurnOf(alice)
        .start();

      const state = stateAfter(
        context,
        started,
        { type: 'DiscoverClues', investigatorId: alice, locationId: bank, amount: 1 },
        answer('reaction:first_bank:0', 'use'),
      );

      expect(requireInvestigator(state, alice).resources).toBe(1);
    });
  });

  describe('Downtown (Arkham Sanatorium)', () => {
    const sanatorium = instanceId('sanatorium');
    const bob = investigatorId('bob');
    const aliceDiscovers: Command = {
      type: 'DiscoverClues',
      investigatorId: alice,
      locationId: sanatorium,
      amount: 1,
    };
    /** Alice and bob at the Sanatorium on alice's turn, with the horror each is given. */
    const bothThere = (horror: { alice: number; bob: number }) =>
      newGame()
        .withLocation(sanatorium, cardOf(SMOKE_AND_MIRRORS_CODES.downtownSanatorium), {
          revealed: true,
          clues: 2,
        })
        .withInvestigator(alice, {
          locationId: sanatorium,
          sanity: { max: 6, horror: horror.alice },
        })
        .withInvestigator(bob, { locationId: sanatorium, sanity: { max: 6, horror: horror.bob } })
        .withTurnOf(alice)
        .start();

    it('lets alice heal 1 horror from bob, whom she picks among the investigators there', () => {
      const { context, state: started } = bothThere({ alice: 2, bob: 1 });

      const state = stateAfter(
        context,
        started,
        aliceDiscovers,
        answer('reaction:sanatorium:0', 'use'),
        answer(SANATORIUM_DECISION, 'investigator'),
        answer('pick:sanatorium', 'bob'),
      );

      expect(requireInvestigator(state, alice).sanity.horror).toBe(2);
      expect(requireInvestigator(state, bob).sanity.horror).toBe(0);
    });

    it.each([
      { horror: { alice: 0, bob: 1 }, options: ['investigator', 'ally'] },
      { horror: { alice: 0, bob: 0 }, options: ['ally'] },
    ])(
      'offers to heal $options with alice at $horror.alice horror and bob at $horror.bob',
      ({ horror, options }) => {
        const { context, state: started } = bothThere(horror);

        const state = stateAfter(
          context,
          started,
          aliceDiscovers,
          answer('reaction:sanatorium:0', 'use'),
        );

        expect(state.pending[0]?.options.map((option) => option.id)).toEqual(options);
      },
    );

    it('leaves healing an Ally asset there to alice', () => {
      const { context, state: started } = bothThere({ alice: 0, bob: 0 });
      const asked = stateAfter(
        context,
        started,
        aliceDiscovers,
        answer('reaction:sanatorium:0', 'use'),
      );

      const { events } = execute(context, asked, answer(SANATORIUM_DECISION, 'ally'));

      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'CommandDeferred',
          command: expect.objectContaining({
            type: 'HealAsset',
            investigatorId: alice,
            stat: 'horror',
            amount: 1,
            trait: 'Ally',
          }),
        }),
      );
    });
  });

  describe('Merchant District', () => {
    const bob = investigatorId('bob');
    const district = instanceId('merchant_district');
    const easttown = instanceId('easttown');
    /** Merchant District with Easttown connecting to it and French Hill not, alice and bob there. */
    const bothInTheDistrict = newGame()
      .withLocation(district, cardOf(SMOKE_AND_MIRRORS_CODES.merchantDistrict), { revealed: true })
      .withLocation(easttown, cardOf(SMOKE_AND_MIRRORS_CODES.easttown), { revealed: true })
      .withLocation(instanceId('french_hill'), cardOf(SMOKE_AND_MIRRORS_CODES.frenchHill), {
        revealed: true,
      })
      .withInvestigator(alice, { locationId: district })
      .withInvestigator(bob, { locationId: district });
    const movesFree = (investigatorId: InvestigatorId): Command => ({
      type: 'UseCardAction',
      investigatorId,
      cardId: district,
      action: 0,
    });

    it('moves alice without asking to Easttown, its only connecting location, as a fast ability in her turn', () => {
      const { context, state: started } = bothInTheDistrict.withTurnOf(alice).start();

      const state = stateAfter(context, started, movesFree(alice));

      expect(requireInvestigator(state, alice)).toMatchObject({
        locationId: easttown,
        actionsRemaining: 3,
      });
    });

    it("refuses alice's move in bob's turn", () => {
      const { context, state } = bothInTheDistrict.withTurnOf(bob).start();

      expect(rejectionFrom(context, state, movesFree(alice)).code).toBe('cardActionConditionUnmet');
    });

    it("refuses alice's second move this round once she is back, and lets bob make his", () => {
      const { context, state: started } = bothInTheDistrict.withTurnOf(alice).start();
      const backAgain = stateAfter(context, started, movesFree(alice), {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: district,
      });
      const bobsTurn = { ...backAgain, meta: { ...backAgain.meta, turn: { investigatorId: bob } } };

      const bobMoved = stateAfter(context, bobsTurn, movesFree(bob));

      expect(rejectionFrom(context, backAgain, movesFree(alice)).code).toBe(
        'cardActionLimitReached',
      );
      expect(requireInvestigator(bobMoved, bob).locationId).toBe(easttown);
    });
  });

  describe('Easttown', () => {
    const easttown = instanceId('easttown');

    it.each([
      { clues: 1, asked: ['reaction:easttown:0'] },
      { clues: 2, asked: [] },
    ])(
      'offers its ally search when alice discovers the last clue: with $clues clues there, $asked',
      ({ clues, asked }) => {
        const { context, state: started } = newGame()
          .withLocation(easttown, cardOf(SMOKE_AND_MIRRORS_CODES.easttown), {
            revealed: true,
            clues,
          })
          .withInvestigator(alice, { locationId: easttown })
          .withTurnOf(alice)
          .start();

        const state = stateAfter(context, started, {
          type: 'DiscoverClues',
          investigatorId: alice,
          locationId: easttown,
          amount: 1,
        });

        expect(state.pending.map((decision) => decision.id)).toEqual(asked);
      },
    );

    it.each([
      { who: 'alice again', discoverer: alice, asked: [] },
      { who: 'bob', discoverer: investigatorId('bob'), asked: ['reaction:easttown:0'] },
    ])(
      'offers it to $who after alice used it once in the game and a clue came back: $asked',
      ({ discoverer, asked }) => {
        const { context, state: started } = newGame()
          .withLocation(easttown, cardOf(SMOKE_AND_MIRRORS_CODES.easttown), {
            revealed: true,
            clues: 1,
          })
          .withInvestigator(alice, { locationId: easttown })
          .withInvestigator(investigatorId('bob'), { locationId: easttown })
          .withTurnOf(alice)
          .start();
        const used = stateAfter(
          context,
          started,
          { type: 'DiscoverClues', investigatorId: alice, locationId: easttown, amount: 1 },
          answer('reaction:easttown:0', 'use'),
        );
        const nextRound = { ...used, meta: { ...used.meta, round: used.meta.round + 1 } };
        const refilled = stateAfter(context, nextRound, {
          type: 'MoveTokens',
          token: 'clue',
          amount: 1,
          from: 'pool',
          to: { card: easttown },
        });

        const state = stateAfter(context, refilled, {
          type: 'DiscoverClues',
          investigatorId: discoverer,
          locationId: easttown,
          amount: 1,
        });

        expect(state.pending.map((decision) => decision.id)).toEqual(asked);
      },
    );

    it('leaves the search for an Ally asset to play to alice', () => {
      const { context, state: started } = newGame()
        .withLocation(easttown, cardOf(SMOKE_AND_MIRRORS_CODES.easttown), {
          revealed: true,
          clues: 1,
        })
        .withInvestigator(alice, { locationId: easttown })
        .withTurnOf(alice)
        .start();
      const asked = stateAfter(context, started, {
        type: 'DiscoverClues',
        investigatorId: alice,
        locationId: easttown,
        amount: 1,
      });

      const { events } = execute(context, asked, answer('reaction:easttown:0', 'use'));

      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'CommandDeferred',
          command: expect.objectContaining({
            type: 'SearchDeck',
            investigatorId: alice,
            traits: ['Ally'],
            play: true,
          }),
        }),
      );
    });
  });

  describe("the suspects' reactions", () => {
    const suspect = instanceId('suspect');
    /** Alice at Northside on her turn, with the suspect `code` in `zone`. */
    const withSuspect = (code: string, zone: Zone) =>
      newGame()
        .withLocation(northside, cardOf(SMOKE_AND_MIRRORS_CODES.northside), { revealed: true })
        .withInvestigator(alice, { locationId: northside })
        .withCard(suspect, cardOf(code), zone)
        .withTurnOf(alice)
        .start();
    const investigates = (margin?: number): Command[] => [
      { type: 'Investigate', investigatorId: alice },
      { ...answer('investigate:alice', 'pass'), ...(margin === undefined ? {} : { margin }) },
    ];
    /** The codex entry a `CommandDeferred` among `events` hands to alice. */
    const codexReadBy = (events: readonly Event[]) =>
      events.flatMap((event) =>
        event.type === 'CommandDeferred' && event.command.type === 'ReadCodexEntry'
          ? [{ investigatorId: event.command.investigatorId, entry: event.command.entry }]
          : [],
      );

    it.each([
      { margin: 1, asked: [] },
      { margin: 2, asked: ['reaction:suspect:0'] },
    ])(
      "offers Margaret Liu's reaction after alice succeeds by $margin at her location: $asked",
      ({ margin, asked }) => {
        const { context, state: started } = withSuspect(
          SMOKE_AND_MIRRORS_CODES.margaretLiu,
          atLocation(northside),
        );

        const state = stateAfter(context, started, ...investigates(margin));

        expect(state.pending.map((decision) => decision.id)).toEqual(asked);
      },
    );

    it.each([
      { name: 'David Renfield', code: SMOKE_AND_MIRRORS_CODES.davidRenfield, entry: 1 },
      { name: 'Margaret Liu', code: SMOKE_AND_MIRRORS_CODES.margaretLiu, entry: 6 },
    ])(
      "has alice read codex entry $entry with $name's reaction after she investigates his or her location",
      ({ code, entry }) => {
        const { context, state: started } = withSuspect(code, atLocation(northside));
        const asked = stateAfter(context, started, ...investigates(2));

        const { events } = execute(context, asked, answer('reaction:suspect:0', 'use'));

        expect(codexReadBy(events)).toEqual([{ investigatorId: alice, entry }]);
      },
    );

    it.each<{ how: string; commands: Command[]; asked: string[] }>([
      {
        how: 'a passed evasion test',
        commands: [
          { type: 'Evade', investigatorId: alice, enemyId: suspect },
          answer('evade:alice:suspect', 'pass'),
        ],
        asked: ['reaction:suspect:0'],
      },
      {
        how: 'an automatic evade, which is no successful evasion',
        commands: [{ type: 'EvadeEnemy', enemyId: suspect, investigatorId: alice }],
        asked: [],
      },
    ])("offers Cornelia Akely's reaction after $how: $asked", ({ commands, asked }) => {
      const { context, state: started } = withSuspect(
        SMOKE_AND_MIRRORS_CODES.corneliaAkely,
        engagedWith(alice),
      );

      const state = stateAfter(context, started, ...commands);

      expect(state.pending.map((decision) => decision.id)).toEqual(asked);
    });

    it('readies Cornelia Akely, who engages alice again, and has her read codex entry 2 with the reaction after evading Cornelia', () => {
      const { context, state: started } = withSuspect(
        SMOKE_AND_MIRRORS_CODES.corneliaAkely,
        engagedWith(alice),
      );
      const asked = stateAfter(
        context,
        started,
        { type: 'Evade', investigatorId: alice, enemyId: suspect },
        answer('evade:alice:suspect', 'pass'),
      );

      const { state, events } = execute(context, asked, answer('reaction:suspect:0', 'use'));

      expect(state.cards[suspect]).toMatchObject({ zone: engagedWith(alice), exhausted: false });
      expect(codexReadBy(events)).toEqual([{ investigatorId: alice, entry: 2 }]);
    });
  });

  describe('Miskatonic University (In Flames)', () => {
    it('deals 1 damage to each investigator there, and none elsewhere, as the investigation phase ends', () => {
      const university = instanceId('miskatonic_university');
      const { context, state: started } = newGame()
        .withLocation(university, cardOf('12155'), { revealed: true })
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: university })
        .withInvestigator(bob, { locationId: northside })
        .withTurnOf(alice)
        .start();

      const state = stateAfter(
        context,
        started,
        { type: 'EndTurn', investigatorId: alice },
        { type: 'StartTurn', investigatorId: bob },
        { type: 'EndTurn', investigatorId: bob },
        { type: 'NextPhase' },
      );

      expect(requireInvestigator(state, alice).health.damage).toBe(1);
      expect(requireInvestigator(state, bob).health.damage).toBe(0);
    });
  });

  describe('Whippoorwill', () => {
    it('gives alice at its location -1 to each skill, and not bob at Easttown', () => {
      const easttown = instanceId('easttown');
      const skills = { willpower: 3, intellect: 3, combat: 3, agility: 3 };
      const { context, state } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withLocation(easttown, cardOf('12150'), { revealed: true })
        .withInvestigator(alice, { locationId: northside, skills })
        .withInvestigator(bob, { locationId: easttown, skills })
        .withCard(instanceId('whippoorwill'), cardOf('12166'), atLocation(northside))
        .start();

      expect(skillValues(context, state, requireInvestigator(state, alice))).toEqual({
        willpower: 2,
        intellect: 2,
        combat: 2,
        agility: 2,
      });
      expect(skillValues(context, state, requireInvestigator(state, bob))).toEqual(skills);
    });
  });

  describe('Mark of Elokoss', () => {
    it("puts Mark of Elokoss into alice's threat area", () => {
      const mark = instanceId('mark_of_elokoss');
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside })
        .withCard(mark, cardOf('12137'), { kind: 'encounterDeck' })
        .start();

      const { state } = runFrom(context, started, [
        aliceDraws('Mark of Elokoss'),
        resolveRevelation('mark_of_elokoss'),
      ]);

      expect(state.cards[mark]?.zone).toEqual(threatAreaOf(alice));
    });

    it('lets alice discard it with its two-action ability', () => {
      const mark = instanceId('mark_of_elokoss');
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside })
        .withCard(mark, cardOf('12137'), threatAreaOf(alice))
        .withTurnOf(alice)
        .start();

      const state = stateAfter(context, started, {
        type: 'UseCardAction',
        investigatorId: alice,
        cardId: mark,
        action: 0,
      });

      expect(state.cards[mark]?.zone).toEqual(encounterDiscard);
    });
  });

  describe('Arcane Lock', () => {
    const lock = instanceId('arcane_lock');

    it("attaches to alice's location as it is drawn", () => {
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside })
        .withCard(lock, cardOf('12157'), { kind: 'encounterDeck' })
        .start();

      const { state } = runFrom(context, started, [
        aliceDraws('Arcane Lock'),
        resolveRevelation('arcane_lock'),
      ]);

      expect(state.cards[lock]?.zone).toEqual({ kind: 'attachedTo', hostId: northside });
    });

    it.each([
      { result: 'pass', zone: { kind: 'encounterDiscard' } },
      { result: 'fail', zone: { kind: 'attachedTo', hostId: northside } },
    ])(
      'tests willpower or intellect (4) as an action; a $result leaves it in $zone.kind',
      ({ result, zone }) => {
        const { context, state: started } = newGame()
          .withLocation(northside, cardOf('12149'), { revealed: true })
          .withInvestigator(alice, { locationId: northside })
          .withCard(lock, cardOf('12157'), { kind: 'attachedTo', hostId: northside })
          .withTurnOf(alice)
          .start();
        const chosen = stateAfter(
          context,
          started,
          { type: 'UseCardAction', investigatorId: alice, cardId: lock, action: 0 },
          answer(ARCANE_LOCK_DECISION, 'intellect'),
        );

        const state = stateAfter(context, chosen, answer('test:arcane_lock', result));

        expect(chosen.pending).toMatchObject([
          { skillTest: { skill: 'intellect', difficulty: 4 } },
        ]);
        expect(state.cards[lock]?.zone).toEqual(zone);
      },
    );

    it('discards a second Arcane Lock drawn where one is already attached', () => {
      const first = instanceId('first_lock');
      const second = instanceId('second_lock');
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside })
        .withCard(first, cardOf('12157'), { kind: 'attachedTo', hostId: northside })
        .withCard(second, cardOf('12157'), { kind: 'encounterDeck' })
        // A card left in the deck, so the discard pile is not shuffled back into an empty one.
        .withCard(instanceId('downpour'), cardOf('12158'), { kind: 'encounterDeck' })
        .start();

      const { state } = runFrom(context, started, [
        aliceDraws('Arcane Lock'),
        resolveRevelation('second_lock'),
      ]);

      expect(state.cards[first]?.zone).toEqual({ kind: 'attachedTo', hostId: northside });
      expect(state.cards[second]?.zone).toEqual({ kind: 'encounterDiscard' });
    });
  });

  describe('Flash Flood', () => {
    const flood = instanceId('flash_flood');

    it("gives alice's location (Northside, shroud 3) +4 shroud and is discarded as the round ends", () => {
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside })
        .withCard(flood, cardOf('12159'), { kind: 'encounterDeck' })
        .withTurnOf(alice)
        .start();
      const flooded = stateAfter(
        context,
        started,
        aliceDraws('Flash Flood'),
        resolveRevelation('flash_flood'),
      );

      const roundOver = stateAfter(
        context,
        flooded,
        { type: 'EndTurn', investigatorId: alice },
        { type: 'NextPhase' },
        { type: 'NextPhase' },
      );

      expect(flooded.cards[flood]?.zone).toEqual({ kind: 'attachedTo', hostId: northside });
      expect(effectiveValue(context, flooded, flooded.cards[northside]!, 'shroud')).toBe(7);
      expect(roundOver.cards[flood]?.zone).toEqual({ kind: 'encounterDiscard' });
    });
  });

  describe('the nearest enemy (Raising Suspicions, Aerial Pursuit)', () => {
    const southside = instanceId('southside');
    const whippoorwill = instanceId('whippoorwill');
    const batHorror = instanceId('bat_horror');
    const nextCard = instanceId('next_card');
    const plainTreachery = blankTreachery('plain_treachery');
    /** Northside, where alice draws, and Southside, connected; a plain treachery below the card. */
    const northAndSouthside = (card: string) =>
      newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withLocation(southside, cardOf('12153'), { revealed: true })
        .withConnection(northside, southside)
        .withInvestigator(alice, { locationId: northside })
        .withCard(instanceId('drawn'), cardOf(card), encounterDeck)
        .withCard(nextCard, plainTreachery, encounterDeck)
        .withCard(instanceId('bottom_card'), plainTreachery, encounterDeck);

    it("Raising Suspicions puts 1 doom on the Bat Horror in Southside, as the Whippoorwill at alice's location has doom", () => {
      const { context, state: started } = northAndSouthside('12160')
        .withCard(whippoorwill, cardOf('12166'), atLocation(northside), { tokens: { doom: 1 } })
        .withCard(batHorror, cardOf('12162'), atLocation(southside))
        .start();

      const state = stateAfter(
        context,
        started,
        aliceDraws('Raising Suspicions'),
        resolveRevelation('drawn'),
      );

      expect([whippoorwill, batHorror].map((id) => state.cards[id]?.tokens.doom ?? 0)).toEqual([
        1, 1,
      ]);
      expect(state.cards[nextCard]?.zone).toEqual(encounterDeck);
    });

    it('Raising Suspicions surges into the next card when every enemy has doom', () => {
      const { context, state: started } = northAndSouthside('12160')
        .withCard(batHorror, cardOf('12162'), atLocation(southside), { tokens: { doom: 1 } })
        .start();

      const state = stateAfter(
        context,
        started,
        aliceDraws('Raising Suspicions'),
        resolveRevelation('drawn'),
      );

      expect(state.cards[batHorror]?.tokens.doom).toBe(1);
      expect(state.cards[nextCard]?.zone).toEqual(encounterDiscard);
    });

    it('Aerial Pursuit moves the Bat Horror, not the Elite Servant of Flame, from Southside to alice, where it engages and attacks her', () => {
      const servant = instanceId('servant_of_flame');
      const { context, state: started } = northAndSouthside('12163')
        .withCard(servant, cardOf('12138'), atLocation(southside))
        .withCard(batHorror, cardOf('12162'), atLocation(southside))
        .start();

      const state = stateAfter(
        context,
        started,
        aliceDraws('Aerial Pursuit'),
        resolveRevelation('drawn'),
      );

      expect(state.cards[servant]?.zone).toEqual(atLocation(southside));
      expect(state.cards[batHorror]?.zone).toEqual(engagedWith(alice));
      expect(state.pending).toMatchObject([{ id: `cardAttack:${batHorror}:${alice}` }]);
    });

    it('Aerial Pursuit leaves the Bat Horror engaged with alice, the nearest, without an attack, and surges', () => {
      const { context, state: started } = northAndSouthside('12163')
        .withCard(batHorror, cardOf('12162'), engagedWith(alice))
        .start();

      const state = stateAfter(
        context,
        started,
        aliceDraws('Aerial Pursuit'),
        resolveRevelation('drawn'),
      );

      expect(state.cards[batHorror]?.zone).toEqual(engagedWith(alice));
      expect(state.pending).toEqual([]);
      expect(state.cards[nextCard]?.zone).toEqual(encounterDiscard);
    });
  });

  describe('Crossfire', () => {
    it.each([
      { result: 'pass', damage: 0 },
      { result: 'fail', damage: 1 },
    ])(
      'tests agility (3); a $result deals $damage damage to alice and bob at her location',
      ({ result, damage }) => {
        const southside = instanceId('southside');
        const carol = investigatorId('carol');
        const { context, state: started } = newGame()
          .withLocation(northside, cardOf('12149'), { revealed: true })
          .withLocation(southside, cardOf('12153'), { revealed: true })
          .withInvestigator(alice, { locationId: northside })
          .withInvestigator(bob, { locationId: northside })
          .withInvestigator(carol, { locationId: southside })
          .withCard(instanceId('crossfire'), cardOf('12165'), { kind: 'encounterDeck' })
          .start();
        const drawn = stateAfter(
          context,
          started,
          aliceDraws('Crossfire'),
          resolveRevelation('crossfire'),
        );

        const state = stateAfter(context, drawn, answer('test:crossfire', result));

        expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'agility', difficulty: 3 } }]);
        expect(requireInvestigator(state, alice).health.damage).toBe(damage);
        expect(requireInvestigator(state, bob).health.damage).toBe(damage);
        expect(requireInvestigator(state, carol).health.damage).toBe(0);
      },
    );
  });

  describe('Red Herring', () => {
    it.each([
      { clues: 1, difficulty: 2 },
      { clues: 2, difficulty: 4 },
    ])('tests intellect ($difficulty) when alice holds $clues clues', ({ clues, difficulty }) => {
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside, clues })
        .withCard(instanceId('red_herring'), cardOf('12161'), { kind: 'encounterDeck' })
        .start();

      const drawn = stateAfter(
        context,
        started,
        aliceDraws('Red Herring'),
        resolveRevelation('red_herring'),
      );

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'intellect', difficulty } }]);
    });

    it('gives alice 1 horror and places 1 of her clues on Northside (2 clues) on a fail', () => {
      const { context, state: started } = newGame()
        .withLocation(northside, cardOf('12149'), { revealed: true })
        .withInvestigator(alice, { locationId: northside, clues: 2 })
        .withCard(instanceId('red_herring'), cardOf('12161'), { kind: 'encounterDeck' })
        .start();

      const state = stateAfter(
        context,
        started,
        aliceDraws('Red Herring'),
        resolveRevelation('red_herring'),
        answer('test:red_herring', 'fail'),
      );

      expect(requireInvestigator(state, alice)).toMatchObject({ clues: 1, sanity: { horror: 1 } });
      expect(started.cards[northside]?.tokens.clue).toBe(2);
      expect(state.cards[northside]?.tokens.clue).toBe(3);
    });
  });

  describe('Eager for Death', () => {
    it.each([
      { damage: 0, difficulty: 2 },
      { damage: 3, difficulty: 5 },
    ])(
      'tests willpower ($difficulty) when alice has $damage damage, 2 horror on a fail',
      ({ damage, difficulty }) => {
        const { context, state: started } = newGame()
          .withLocation(northside, cardOf('12149'), { revealed: true })
          .withInvestigator(alice, { locationId: northside, health: { max: 8, damage } })
          .withCard(instanceId('eager_for_death'), cardOf('12167'), { kind: 'encounterDeck' })
          .start();
        const drawn = stateAfter(
          context,
          started,
          aliceDraws('Eager for Death'),
          resolveRevelation('eager_for_death'),
        );

        const state = stateAfter(context, drawn, answer('test:eager_for_death', 'fail'));

        expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty } }]);
        expect(requireInvestigator(state, alice).sanity.horror).toBe(2);
      },
    );
  });

  describe('Downpour', () => {
    it.each([
      { answers: ['action', 'action'], actions: 1, clues: 2, northsideClues: 2 },
      { answers: ['action', 'clue'], actions: 2, clues: 1, northsideClues: 3 },
    ])(
      'tests agility (3); failing by 2 asks twice: $answers',
      ({ answers, actions, clues, northsideClues }) => {
        const { context, state: started } = newGame()
          .withLocation(northside, cardOf('12149'), { revealed: true })
          .withInvestigator(alice, { locationId: northside, clues: 2 })
          .withCard(instanceId('downpour'), cardOf('12158'), { kind: 'encounterDeck' })
          .start();
        const drawn = stateAfter(
          context,
          started,
          aliceDraws('Downpour'),
          resolveRevelation('downpour'),
        );

        const state = stateAfter(
          context,
          drawn,
          { ...answer('test:downpour', 'fail'), margin: 2 },
          ...answers.map((option) => answer(DOWNPOUR_DECISION, option)),
        );

        expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'agility', difficulty: 3 } }]);
        expect(started.cards[northside]?.tokens.clue).toBe(2);
        expect(requireInvestigator(started, alice).actionsRemaining).toBe(3);
        expect(requireInvestigator(state, alice)).toMatchObject({
          actionsRemaining: actions,
          clues,
        });
        expect(state.cards[northside]?.tokens.clue).toBe(northsideClues);
      },
    );
  });
});
