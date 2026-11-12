import { describe, expect, it } from 'vitest';
import {
  atLocation,
  encounterDeck,
  encounterDiscard,
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
import { answer, cardIn, resolveRevelation, runFrom, stateAfter } from '@arkham/engine/test/utils';
import {
  QUEEN_OF_ASH_CODES,
  queenOfAshCardDefs,
  queenOfAshCards,
  SMUGGLERS_CACHE_DECISION,
} from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(queenOfAshCards, code);

describe('Queen of Ash card data', () => {
  it.each([
    {
      code: '12172',
      name: 'Search the Sewers',
      front: '/bundles/cards/12172.jpg',
      back: '/bundles/cards/12172b.jpg',
    },
    {
      code: '12171',
      name: 'Brethren of Ash',
      front: '/bundles/cards/12171.jpg',
      back: '/bundles/cards/12171b.jpg',
    },
    { code: '12179', name: 'Elokoss', front: '/bundles/cards/12179.jpg', back: undefined },
    { code: '12181', name: 'Collector', front: '/bundles/cards/12181.jpg', back: undefined },
  ])('names the ArkhamDB pictures of $name, which are JPEGs', ({ code, front, back }) => {
    const card = cardOf(code);

    expect(card.imageSrc).toBe(front);
    expect(card.backImageSrc).toBe(back);
  });

  it.each([
    {
      code: '12174',
      name: 'Underground Cistern',
      symbol: 'circle',
      connectsTo: ['triangle', 'plus', 'spade', 'star', 'double_slash'],
    },
    { code: '12175', name: 'Sluice Control', symbol: 'plus', connectsTo: ['circle'] },
    { code: '12182', name: 'Sewer Culvert', symbol: 'hourglass', connectsTo: ['triangle'] },
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
    { code: '12183', name: 'Infested Pipes', symbol: 'spade', connectsTo: ['hourglass', 'circle'] },
    { code: '12184', name: 'Overgrown Tunnels', symbol: 'square', connectsTo: ['hourglass'] },
    { code: '12185', name: 'Flooded Crypt', symbol: 'star', connectsTo: ['hourglass', 'circle'] },
    {
      code: '12186',
      name: "Smuggler's Cache",
      symbol: 'clover',
      connectsTo: ['hourglass', 'circle'],
    },
    {
      code: '12187',
      name: 'Toxic Waste Pit',
      symbol: 'double_slash',
      connectsTo: ['hourglass', 'circle'],
    },
  ])(
    'prints the triangle on the unrevealed side of Sewer Tunnels ($name), and $symbol revealed, connecting to $connectsTo',
    ({ code, symbol, connectsTo }) => {
      const card = cardOf(code);

      expect(card.name).toBe('Sewer Tunnels');
      expect(card.unrevealedSymbol).toBe('triangle');
      expect(card.unrevealedConnectsTo).toEqual(['hourglass', 'circle']);
      expect(card.symbol).toBe(symbol);
      expect(card.connectsTo).toEqual(connectsTo);
    },
  );

  it.each([
    {
      set: 'queen_of_ash',
      copies: 6,
    },
    { set: 'cultists_ch2', copies: 6 },
    { set: 'reeking_decay', copies: 4 },
    { set: 'torment', copies: 6 },
  ])('has $copies enemy and treachery copies in set $set', ({ set, copies }) => {
    const encounterCards = queenOfAshCardDefs.filter(
      (card) =>
        card.encounterCode === encounterSetCode(set) &&
        (card.typeCode === 'enemy' || card.typeCode === 'treachery'),
    );

    const total = encounterCards.reduce((sum, card) => sum + (card.quantity ?? 1), 0);

    expect(total).toBe(copies);
  });

  it.each([
    { code: '12121', name: 'Cantor of Flame', set: 'ashen_pilgrims' },
    { code: '12124', name: 'Cosmic Evils', set: 'cosmic_evils' },
    { code: '12127', name: 'Extraplanar Visions', set: 'hallucinations' },
    { code: '12129', name: 'Fire!', set: 'fire_ch2' },
  ])("reuses Spreading Flames' $name from the shared set $set", ({ code, name, set }) => {
    expect(cardOf(code)).toMatchObject({ name, encounterCode: set });
  });

  it.each([
    { code: '12177', name: "Queen's Knight", keywords: ['hunter'] },
    { code: '12178', name: 'Herald of Flame', keywords: ['hunter'] },
    { code: '12179', name: 'Elokoss', keywords: ['massive', 'retaliate'] },
    { code: '12180', name: 'Servant of Flame', keywords: ['hunter', 'retaliate'] },
    { code: '12188', name: 'Zealot', keywords: ['aloof'] },
    { code: '12189', name: 'Dark Magician', keywords: ['hunter', 'retaliate'] },
    { code: '12195', name: 'Torment', keywords: ['peril'] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    expect(cardOf(code).keywords?.map((keyword) => keyword.name)).toEqual(keywords);
  });

  it.each([
    { name: 'Elokoss', code: '12179', players: 1, health: 10 },
    { name: 'Elokoss', code: '12179', players: 4, health: 25 },
    { name: 'the Servant of Flame', code: '12180', players: 1, health: 5 },
    { name: 'the Servant of Flame', code: '12180', players: 4, health: 20 },
  ])('gives $name $health health with $players investigator(s)', ({ code, players, health }) => {
    const printed = cardOf(code).health;

    expect(printed && resolveValue(printed, players)).toBe(health);
  });

  it('prints no doom threshold on special agenda 3a, Brethren of Ash', () => {
    expect(cardOf('12171')).toMatchObject({ typeCode: 'agenda', stage: { number: 3 } });
    expect(cardOf('12171').doom).toBeUndefined();
  });

  it('lets the investigators resign at Sewer Culvert', () => {
    expect(cardOf('12182').actions).toEqual([resignAction()]);
  });
});

describe('Queen of Ash card abilities', () => {
  const alice = investigatorId('alice');
  const culvert = instanceId('sewer_culvert');
  /** Alice draws the encounter card named `card`. */
  const aliceDraws = (card: string): Command => ({
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { name: card },
  });

  describe('Sewer Tunnels (Overgrown Tunnels)', () => {
    it('takes 1 of the 3 actions alice has left as she enters its unrevealed triangle', () => {
      const tunnels = instanceId('overgrown_tunnels');
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withLocation(tunnels, cardOf('12184'), { revealed: false })
        .withInvestigator(alice, { locationId: culvert })
        .withTurnOf(alice)
        .start();

      const state = stateAfter(context, started, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: tunnels,
      });

      expect(requireInvestigator(state, alice).actionsRemaining).toBe(2);
    });
  });

  describe('Sewer Tunnels (Infested Pipes)', () => {
    it('discards Putrid Vapors from the encounter deck as alice enters and draws the Zealot below it', () => {
      const pipes = instanceId('infested_pipes');
      const putridVapors = instanceId('putrid_vapors');
      const zealot = instanceId('zealot');
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withLocation(pipes, cardOf('12183'), { revealed: true })
        .withConnection(culvert, pipes)
        .withInvestigator(alice, { locationId: culvert })
        .withCard(putridVapors, cardOf('12192'), encounterDeck)
        .withCard(zealot, cardOf('12188'), encounterDeck)
        .withCard(instanceId('bottom_card'), cardOf('12192'), encounterDeck)
        .withTurnOf(alice)
        .start();

      const state = stateAfter(context, started, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: pipes,
      });

      expect(state.cards[putridVapors]?.zone).toEqual(encounterDiscard);
      expect(state.cards[zealot]?.zone).toEqual(atLocation(pipes));
    });
  });

  describe('Sewer Tunnels as alice ends her turn there', () => {
    const tunnel = instanceId('sewer_tunnel');
    /** Alice's turn in the tunnel with code `code`, with 1 resource; bob waits in the culvert. */
    const aliceEndsHerTurnIn = (code: string) => {
      const bob = investigatorId('bob');
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withLocation(tunnel, cardOf(code), { revealed: true })
        .withInvestigator(alice, { locationId: tunnel, resources: 1 })
        .withInvestigator(bob, { locationId: culvert })
        .withTurnOf(alice)
        .start();
      return {
        context,
        bob,
        ...execute(context, started, { type: 'EndTurn', investigatorId: alice }),
      };
    };

    it('gives alice, not bob in the culvert, 1 horror in Flooded Crypt', () => {
      const { state, bob } = aliceEndsHerTurnIn(QUEEN_OF_ASH_CODES.floodedCrypt);

      expect([alice, bob].map((id) => requireInvestigator(state, id).sanity.horror)).toEqual([
        1, 0,
      ]);
    });

    it('leaves the discard of 1 card of her choice to alice in Toxic Waste Pit', () => {
      const { events } = aliceEndsHerTurnIn(QUEEN_OF_ASH_CODES.toxicWastePit);

      expect(events).toContainEqual({
        type: 'CommandDeferred',
        command: {
          type: 'DiscardFromHand',
          investigatorId: alice,
          amount: 1,
          source: { cardId: tunnel, window: 'turnEnds' },
        },
      });
    });

    it.each([
      { answered: 'gain', resources: 2 },
      { answered: 'decline', resources: 1 },
    ])(
      "lets alice gain 1 resource in Smuggler's Cache; answering $answered leaves her $resources",
      ({ answered, resources }) => {
        const { context, state: asked } = aliceEndsHerTurnIn(QUEEN_OF_ASH_CODES.smugglersCache);

        const state = stateAfter(context, asked, answer(SMUGGLERS_CACHE_DECISION, answered));

        expect(asked.pending).toMatchObject([
          {
            id: SMUGGLERS_CACHE_DECISION,
            decider: { kind: 'investigator', investigatorId: alice },
          },
        ]);
        expect(requireInvestigator(state, alice).resources).toBe(resources);
      },
    );
  });

  describe('Underground Cistern', () => {
    const cistern = instanceId('underground_cistern');

    it.each([
      { before: 2, after: 1 },
      { before: 1, after: 2 },
    ])(
      'places its 2 clues again once alice discovers the last one: $before clues leave $after',
      ({ before, after }) => {
        const { context, state: started } = newGame()
          .withLocation(cistern, cardOf('12174'), { revealed: true, clues: before })
          .withInvestigator(alice, { locationId: cistern })
          .withTurnOf(alice)
          .start();

        const state = stateAfter(context, started, {
          type: 'DiscoverClues',
          investigatorId: alice,
          locationId: cistern,
          amount: 1,
        });

        expect(state.cards[cistern]?.tokens.clue).toBe(after);
      },
    );

    it('discards each ready non-Elite Cultist there as the investigation phase ends, with 1 doom on the agenda for each', () => {
      const agenda = instanceId('a_gathering');
      const readyZealot = instanceId('ready_zealot');
      const engagedZealot = instanceId('engaged_zealot');
      const exhaustedMagician = instanceId('exhausted_dark_magician');
      const eliteServant = instanceId('elite_servant_of_flame');
      const zealotInCulvert = instanceId('zealot_in_culvert');
      const { context, state: started } = newGame()
        .withLocation(cistern, cardOf('12174'), { revealed: true })
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withAgenda(agenda, cardOf('12169'))
        .withInvestigator(alice, { locationId: cistern })
        .withCard(readyZealot, cardOf('12188'), atLocation(cistern))
        .withCard(engagedZealot, cardOf('12188'), engagedWith(alice))
        .withCard(exhaustedMagician, cardOf('12189'), atLocation(cistern))
        .withCard(eliteServant, cardOf('12180'), atLocation(cistern))
        .withCard(zealotInCulvert, cardOf('12188'), atLocation(culvert))
        .withTurnOf(alice)
        .start();

      const state = stateAfter(
        context,
        started,
        { type: 'ExhaustEnemy', enemyId: exhaustedMagician },
        { type: 'EndTurn', investigatorId: alice },
        { type: 'NextPhase' },
      );

      expect(
        [readyZealot, engagedZealot, exhaustedMagician, eliteServant, zealotInCulvert].map(
          (id) => state.cards[id]?.zone.kind === 'encounterDiscard',
        ),
      ).toEqual([true, true, false, false, false]);
      expect(state.cards[agenda]?.tokens.doom).toBe(2);
    });
  });

  describe('Elokoss', () => {
    const elokoss = instanceId('elokoss');
    const cistern = instanceId('underground_cistern');
    /** Alice with 1 clue spends it on Elokoss, who has `onElokoss` clues already. */
    const aliceSpendsAClueOn = (onElokoss: number) => {
      const { context, state: started } = newGame()
        .withLocation(cistern, cardOf('12174'), { revealed: true })
        .withInvestigator(alice, { locationId: cistern, clues: 1 })
        .withCard(elokoss, cardOf('12179'), atLocation(cistern), { tokens: { clue: onElokoss } })
        .withTurnOf(alice)
        .start();
      return execute(context, started, {
        type: 'UseCardAction',
        investigatorId: alice,
        cardId: elokoss,
        action: 0,
      });
    };

    it('takes 1 clue per investigator from alice as a fast ability and places 1 clue on Elokoss', () => {
      const { state } = aliceSpendsAClueOn(0);

      expect(requireInvestigator(state, alice)).toMatchObject({ clues: 0, actionsRemaining: 3 });
      expect(state.cards[elokoss]?.tokens.clue).toBe(1);
    });

    it.each([
      { onElokoss: 3, resolution: undefined },
      { onElokoss: 4, resolution: 'R2' },
    ])(
      'ends the scenario in Resolution 2 once she has 5 clues: with $onElokoss before, $resolution',
      ({ onElokoss, resolution }) => {
        const { state } = aliceSpendsAClueOn(onElokoss);

        expect(state.meta.resolution).toBe(resolution);
      },
    );
  });

  describe('Putrid Vapors', () => {
    it.each([
      { result: 'pass', horror: 0 },
      { result: 'fail', horror: 1 },
    ])('tests agility (3); a $result gives alice $horror horror', ({ result, horror }) => {
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(instanceId('putrid_vapors'), cardOf('12192'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(
        context,
        started,
        aliceDraws('Putrid Vapors'),
        resolveRevelation('putrid_vapors'),
      );

      const state = stateAfter(context, drawn, answer('test:putrid_vapors', result));

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'agility', difficulty: 3 } }]);
      expect(requireInvestigator(state, alice).sanity.horror).toBe(horror);
    });
  });

  describe('Languor', () => {
    it("puts Languor into alice's threat area", () => {
      const languor = instanceId('languor');
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(languor, cardOf('12193'), { kind: 'encounterDeck' })
        .start();

      const { state } = runFrom(context, started, [
        // ArkhamDB spells the card's name "Langour".
        aliceDraws('Langour'),
        resolveRevelation('languor'),
      ]);

      expect(state.cards[languor]?.zone).toEqual(threatAreaOf(alice));
    });
  });
});
