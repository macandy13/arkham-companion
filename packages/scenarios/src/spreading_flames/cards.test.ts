import { describe, expect, it } from 'vitest';
import {
  encounterSetCode,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  requireInvestigator,
  resignAction,
  resolveValue,
  threatAreaOf,
  type CardStats,
  type Command,
} from '@arkham/engine';
import { answer, cardIn, rejectionFrom, stateAfter } from '@arkham/engine/test/utils';
import {
  COSMIC_EVILS_DECISION,
  NOXIOUS_SMOKE_DECISION,
  spreadingFlamesCardDefs,
  spreadingFlamesCards,
} from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(spreadingFlamesCards, code);

describe('Spreading Flames card data', () => {
  it.each([
    {
      code: '12106',
      name: 'Past Curfew',
      front: '/bundles/cards/12106.jpg',
      back: '/bundles/cards/12106b.jpg',
    },
    {
      code: '12116',
      name: 'Miskatonic Quad',
      front: '/bundles/cards/12116.jpg',
      back: '/bundles/cards/12116b.jpg',
    },
    { code: '12114', name: 'Servant of Flame', front: '/bundles/cards/12114.jpg', back: undefined },
    {
      code: '12115',
      name: 'Dr. Henry Armitage',
      front: '/bundles/cards/12115.jpg',
      back: undefined,
    },
    { code: '12129', name: 'Fire!', front: '/bundles/cards/12129.jpg', back: undefined },
  ])('names the ArkhamDB pictures of $name, which are JPEGs', ({ code, front, back }) => {
    const card = cardOf(code);

    expect(card.imageSrc).toBe(front);
    expect(card.backImageSrc).toBe(back);
  });

  it.each([
    { code: '12113', name: "Your Friend's Room", symbol: 'spade', connectsTo: ['triangle'] },
    {
      code: '12116',
      name: 'Miskatonic Quad',
      symbol: 'plus',
      connectsTo: ['triangle', 'hourglass', 'circle', 'heart', 'square', 'diamond'],
    },
    { code: '12117', name: 'Dormitories', symbol: 'triangle', connectsTo: ['spade', 'plus'] },
    { code: '12118', name: 'Science Hall', symbol: 'hourglass', connectsTo: ['plus'] },
    { code: '12119', name: 'Warren Observatory', symbol: 'square', connectsTo: ['plus'] },
    { code: '12120', name: 'Orne Library', symbol: 'diamond', connectsTo: ['plus'] },
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

  it.each([
    { set: 'spreading_flames', copies: 1, cards: 'Servant of Flame' },
    { set: 'ashen_pilgrims', copies: 4, cards: '2 Cantor of Flame, 2 Hellhound' },
    { set: 'bystanders', copies: 3, cards: '3 Bystander' },
    { set: 'cosmic_evils', copies: 3, cards: '3 Cosmic Evils' },
    { set: 'eldritch_lore', copies: 4, cards: '2 Unspeakable Truths, 2 Forbidden Secrets' },
    { set: 'hallucinations', copies: 4, cards: '2 Extraplanar Visions, 2 Wild Compulsion' },
    { set: 'fire_ch2', copies: 7, cards: '5 Fire!, 2 Noxious Smoke' },
    { set: 'mad_science', copies: 4, cards: '2 Mutated!, 2 Mutated Experiment' },
  ])('has $copies enemy and treachery copies in set $set: $cards', ({ set, copies }) => {
    const encounterCards = spreadingFlamesCardDefs.filter(
      (card) =>
        card.encounterCode === encounterSetCode(set) &&
        (card.typeCode === 'enemy' || card.typeCode === 'treachery'),
    );

    expect(encounterCards.reduce((sum, card) => sum + (card.quantity ?? 1), 0)).toBe(copies);
  });

  it("has Your Friend's Room and the five Miskatonic University locations", () => {
    const locations = spreadingFlamesCardDefs.filter((card) => card.typeCode === 'location');

    expect(locations.map((card) => card.name)).toEqual([
      "Your Friend's Room",
      'Miskatonic Quad',
      'Dormitories',
      'Science Hall',
      'Warren Observatory',
      'Orne Library',
    ]);
  });

  it.each([
    { code: '12114', name: 'Servant of Flame', keywords: ['hunter', 'prey', 'retaliate'] },
    { code: '12121', name: 'Cantor of Flame', keywords: ['retaliate'] },
    { code: '12122', name: 'Hellhound', keywords: ['hunter'] },
    { code: '12124', name: 'Cosmic Evils', keywords: ['peril'] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    expect(cardOf(code).keywords?.map((keyword) => keyword.name)).toEqual(keywords);
  });

  it('lets the investigators resign at Blaze of Glory, act 4', () => {
    expect(cardOf('12112').actions).toEqual([resignAction()]);
  });

  it.each([
    { players: 1, health: 5 },
    { players: 4, health: 20 },
  ])(
    'gives the Servant of Flame $health health with $players investigator(s)',
    ({ players, health }) => {
      const printed = cardOf('12114').health;

      expect(printed && resolveValue(printed, players)).toBe(health);
    },
  );
});

describe('Spreading Flames card abilities', () => {
  const alice = investigatorId('alice');
  const quad = instanceId('miskatonic_quad');
  /** Alice draws the encounter card named `card`. */
  const aliceDraws = (card: string): Command => ({
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { name: card },
  });

  describe('Dormitories', () => {
    const dormitories = instanceId('dormitories');
    const useIt: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: dormitories,
      action: 0,
    };

    it('heals 1 damage and 1 horror from alice, once per game', () => {
      const { context, state: started } = newGame()
        .withLocation(dormitories, cardOf('12117'), { revealed: true })
        .withInvestigator(alice, {
          locationId: dormitories,
          health: { max: 9, damage: 2 },
          sanity: { max: 9, horror: 2 },
        })
        .withTurnOf(alice)
        .start();

      const state = stateAfter(context, started, useIt);

      expect(requireInvestigator(state, alice)).toMatchObject({
        health: { damage: 1 },
        sanity: { horror: 1 },
      });
      expect(rejectionFrom(context, state, useIt)).toMatchObject({
        code: 'cardActionLimitReached',
      });
    });
  });

  describe('Science Hall', () => {
    const scienceHall = instanceId('science_hall');

    it('leaves the discard of 1 card of her choice to alice after she discovers a clue there', () => {
      const { context, state: started } = newGame()
        .withLocation(scienceHall, cardOf('12118'), { revealed: true, clues: 1 })
        .withInvestigator(alice, { locationId: scienceHall })
        .start();

      const { events } = execute(context, started, {
        type: 'DiscoverClues',
        investigatorId: alice,
        locationId: scienceHall,
        amount: 1,
      });

      expect(events).toContainEqual({
        type: 'CommandDeferred',
        command: {
          type: 'DiscardFromHand',
          investigatorId: alice,
          amount: 1,
          source: { cardId: scienceHall, window: 'cluesDiscovered' },
        },
      });
    });
  });

  describe('Cosmic Evils', () => {
    const agenda = instanceId('past_curfew');
    const cosmicEvils = instanceId('cosmic_evils');
    const noxiousSmoke = instanceId('noxious_smoke');
    /** Alice at Miskatonic Quad with Past Curfew (doom 3), Cosmic Evils on top of Noxious Smoke. */
    const aliceDrawsCosmicEvils = newGame()
      .withLocation(quad, cardOf('12116'), { revealed: true })
      .withInvestigator(alice, { locationId: quad })
      .withAgenda(agenda, cardOf('12106'))
      .withCard(cosmicEvils, cardOf('12124'), { kind: 'encounterDeck' })
      .withCard(noxiousSmoke, cardOf('12130'), { kind: 'encounterDeck' });

    it('places 1 doom on the agenda when alice picks the doom', () => {
      const { context, state: started } = aliceDrawsCosmicEvils.start();
      const drawn = stateAfter(context, started, aliceDraws('Cosmic Evils'));

      const state = stateAfter(context, drawn, answer(COSMIC_EVILS_DECISION, 'doom'));

      expect(state.cards[agenda]?.tokens.doom).toBe(1);
      expect(state.cards[noxiousSmoke]?.zone).toEqual({ kind: 'encounterDeck' });
    });

    it('lets the doom advance the agenda when it reaches the threshold', () => {
      const { context, state: started } = aliceDrawsCosmicEvils.start();
      const atTwoDoom = stateAfter(context, started, { type: 'PlaceDoom', amount: 2 });
      const drawn = stateAfter(context, atTwoDoom, aliceDraws('Cosmic Evils'));

      const state = stateAfter(context, drawn, answer(COSMIC_EVILS_DECISION, 'doom'));

      expect(state.cards[agenda]?.tokens.doom).toBe(3);
      expect(state.pending.map((decision) => decision.id)).toEqual(['advanceAgenda:past_curfew']);
    });

    it('gives alice 1 damage and 1 horror, then surges into Noxious Smoke, when she picks the wounds', () => {
      const { context, state: started } = aliceDrawsCosmicEvils.start();
      const drawn = stateAfter(context, started, aliceDraws('Cosmic Evils'));

      const state = stateAfter(context, drawn, answer(COSMIC_EVILS_DECISION, 'wounds'));

      expect(requireInvestigator(state, alice)).toMatchObject({
        health: { damage: 1 },
        sanity: { horror: 1 },
      });
      expect(state.cards[agenda]?.tokens.doom ?? 0).toBe(0);
      expect(state.pending).toMatchObject([{ id: NOXIOUS_SMOKE_DECISION }]);
    });
  });

  describe('Noxious Smoke', () => {
    it('makes alice pick willpower or agility (3) and deals 1 damage per point she fails by', () => {
      const { context, state: started } = newGame()
        .withLocation(quad, cardOf('12116'), { revealed: true })
        .withInvestigator(alice, { locationId: quad })
        .withCard(instanceId('noxious_smoke'), cardOf('12130'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(context, started, aliceDraws('Noxious Smoke'));
      const chosen = stateAfter(context, drawn, answer(NOXIOUS_SMOKE_DECISION, 'agility'));

      const state = stateAfter(context, chosen, {
        ...answer('test:noxious_smoke', 'fail'),
        margin: 2,
      });

      expect(chosen.pending).toMatchObject([{ skillTest: { skill: 'agility', difficulty: 3 } }]);
      expect(requireInvestigator(state, alice).health.damage).toBe(2);
    });
  });

  describe('Forbidden Secrets', () => {
    const forbiddenSecrets = instanceId('forbidden_secrets');
    const noxiousSmoke = instanceId('noxious_smoke');

    it.each([
      { clues: 0, surges: true },
      { clues: 1, surges: false },
    ])('surges into Noxious Smoke when alice has $clues clues: $surges', ({ clues, surges }) => {
      const { context, state: started } = newGame()
        .withLocation(quad, cardOf('12116'), { revealed: true })
        .withInvestigator(alice, { locationId: quad, clues })
        .withCard(forbiddenSecrets, cardOf('12126'), { kind: 'encounterDeck' })
        .withCard(noxiousSmoke, cardOf('12130'), { kind: 'encounterDeck' })
        .start();

      const { state } = execute(context, started, aliceDraws('Forbidden Secrets'));

      expect(state.pending.some((decision) => decision.id === NOXIOUS_SMOKE_DECISION)).toBe(surges);
    });
  });

  describe('Unspeakable Truths', () => {
    it("puts Unspeakable Truths into alice's threat area", () => {
      const truths = instanceId('unspeakable_truths');
      const { context, state: started } = newGame()
        .withLocation(quad, cardOf('12116'), { revealed: true })
        .withInvestigator(alice, { locationId: quad })
        .withCard(truths, cardOf('12125'), { kind: 'encounterDeck' })
        .start();

      const { state } = execute(context, started, aliceDraws('Unspeakable Truths'));

      expect(state.cards[truths]?.zone).toEqual(threatAreaOf(alice));
    });
  });

  describe('Fire!', () => {
    const fire = instanceId('fire');

    it.each([
      { result: 'pass', zone: { kind: 'encounterDiscard' } },
      { result: 'fail', zone: { kind: 'attachedTo', hostId: quad } },
    ])(
      'tests agility (3) as an action at its location; a $result leaves it in $zone.kind',
      ({ result, zone }) => {
        const { context, state: started } = newGame()
          .withLocation(quad, cardOf('12116'), { revealed: true })
          .withInvestigator(alice, { locationId: quad })
          .withCard(fire, cardOf('12129'), { kind: 'attachedTo', hostId: quad })
          .withTurnOf(alice)
          .start();
        const tested = stateAfter(context, started, {
          type: 'UseCardAction',
          investigatorId: alice,
          cardId: fire,
          action: 0,
        });

        const state = stateAfter(context, tested, answer('test:fire', result));

        expect(tested.pending).toMatchObject([{ skillTest: { skill: 'agility', difficulty: 3 } }]);
        expect(state.cards[fire]?.zone).toEqual(zone);
      },
    );
  });

  describe('Mutated Experiment', () => {
    it('gives each investigator at its location 1 horror when it is defeated', () => {
      const bob = investigatorId('bob');
      const experiment = instanceId('mutated_experiment');
      const { context, state: started } = newGame()
        .withLocation(quad, cardOf('12116'), { revealed: true })
        .withInvestigator(alice, { locationId: quad })
        .withInvestigator(bob, { locationId: quad })
        .withCard(experiment, cardOf('12132'), engagedWith(alice))
        .start();

      const { state } = execute(context, started, { type: 'DefeatEnemy', enemyId: experiment });

      expect([alice, bob].map((id) => requireInvestigator(state, id).sanity.horror)).toEqual([
        1, 1,
      ]);
    });
  });

  describe('Wild Flames', () => {
    it('defeats alice with 1 physical trauma as it advances', () => {
      const wildFlames = instanceId('wild_flames');
      const { context, state: started } = newGame()
        .withLocation(quad, cardOf('12116'), { revealed: true })
        .withInvestigator(alice, { locationId: quad })
        .withAgenda(wildFlames, cardOf('12108'))
        .start();

      const { state } = execute(context, started, { type: 'AdvanceAgenda' });

      expect(requireInvestigator(state, alice)).toMatchObject({
        status: 'defeated',
        defeat: { cause: 'cardEffect', trauma: 'physical' },
      });
    });
  });
});
