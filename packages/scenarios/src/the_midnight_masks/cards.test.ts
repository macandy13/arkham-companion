import { describe, expect, it } from 'vitest';
import {
  atLocation,
  byName,
  encounterSetCode,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  requireInvestigator,
  resolveValue,
  type CardStats,
  type Command,
} from '@arkham/engine';
import { answer, cardIn, rejectionFrom, stateAfter } from '@arkham/engine/test/utils';
import {
  GRAVEYARD_DECISION,
  HUNTING_SHADOW_DECISION,
  theMidnightMasksCardDefs,
  theMidnightMasksCards,
} from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(theMidnightMasksCards, code);

describe('The Midnight Masks card data', () => {
  it.each([
    {
      code: '01121a',
      name: 'Predator or Prey?',
      front: '/bundles/cards/01121a.png',
      back: '/bundles/cards/01121b.png',
    },
    {
      code: '01125',
      name: 'Rivertown',
      front: '/bundles/cards/01125.png',
      back: '/bundles/cards/01125b.png',
    },
    {
      code: '01121b',
      name: 'The Masked Hunter',
      front: '/bundles/cards/01121b.png',
      back: undefined,
    },
    { code: '01137', name: '"Wolf-Man" Drew', front: '/bundles/cards/01137.png', back: undefined },
  ])('names the ArkhamDB pictures of $name', ({ code, front, back }) => {
    const card = cardOf(code);

    expect(card.imageSrc).toBe(front);
    expect(card.backImageSrc).toBe(back);
  });

  it.each([
    { set: 'arkham', copies: 6, cards: '3 Hunting Shadow, 2 False Lead, The Masked Hunter' },
    { set: 'cultists', copies: 5, cards: 'the five unique cultists' },
    { set: 'pentagram', copies: 6, cards: '3 Acolyte, Wizard of the Order, 2 Mysterious Chanting' },
    { set: 'nightgaunts', copies: 4, cards: '2 Hunting Nightgaunt, 2 On Wings of Darkness' },
    { set: 'locked_doors', copies: 2, cards: '2 Locked Door' },
  ])('has $copies enemy and treachery copies in set $set: $cards', ({ set, copies }) => {
    const encounterCards = theMidnightMasksCardDefs.filter(
      (card) =>
        card.encounterCode === encounterSetCode(set) &&
        (card.typeCode === 'enemy' || card.typeCode === 'treachery'),
    );

    expect(encounterCards.reduce((sum, card) => sum + (card.quantity ?? 1), 0)).toBe(copies);
  });

  it.each([
    { code: '01121b', name: 'The Masked Hunter', keywords: ['spawn', 'prey', 'hunter'] },
    { code: '01135', name: 'Hunting Shadow', keywords: ['peril'] },
    { code: '01170', name: 'Wizard of the Order', keywords: ['spawn', 'retaliate'] },
    { code: '01172', name: 'Hunting Nightgaunt', keywords: ['hunter'] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    expect(cardOf(code).keywords?.map((keyword) => keyword.name)).toEqual(keywords);
  });

  it.each([
    { code: '01137', name: '"Wolf-Man" Drew', detail: 'Downtown' },
    { code: '01138', name: 'Herman Collins', detail: 'Graveyard' },
    { code: '01139', name: 'Peter Warren', detail: 'Miskatonic University' },
    { code: '01140', name: 'Victoria Devereux', detail: 'Northside' },
    { code: '01141', name: 'Ruth Turner', detail: "St. Mary's Hospital" },
  ])('names the spawn location of $name', ({ code, detail }) => {
    expect(cardOf(code).keywords?.find((keyword) => keyword.name === 'spawn')?.detail).toBe(detail);
  });

  it.each([
    { players: 1, health: 6 },
    { players: 4, health: 12 },
  ])(
    'gives The Masked Hunter $health health with $players investigator(s)',
    ({ players, health }) => {
      const printed = cardOf('01121b').health;

      expect(printed && resolveValue(printed, players)).toBe(health);
    },
  );
});

describe('The Midnight Masks card abilities', () => {
  const alice = investigatorId('alice');
  const rivertown = instanceId('rivertown');
  const graveyard = instanceId('graveyard');
  const nextPhase: Command = { type: 'NextPhase' };
  const aliceDraws: Command = { type: 'DrawEncounter', investigatorId: alice };

  describe('Graveyard', () => {
    /** Alice in Rivertown, next to the revealed Graveyard. */
    const graveyardTable = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withConnection(rivertown, graveyard)
      .withInvestigator(alice, { locationId: rivertown });
    const aliceEnters: Command = { type: 'MoveInvestigator', investigatorId: alice, to: graveyard };

    it('tests willpower (3) once alice enters it', () => {
      const { context, state: started } = graveyardTable.start();

      const { state } = execute(context, started, aliceEnters);

      expect(state.pending).toMatchObject([
        { id: 'test:graveyard', skillTest: { skill: 'willpower', difficulty: 3 } },
      ]);
    });

    it.each([
      { optionId: 'horror', horror: 2, at: graveyard },
      { optionId: 'rivertown', horror: 0, at: rivertown },
    ])('on a fail, $optionId leaves alice with $horror horror', ({ optionId, horror, at }) => {
      const { context, state: started } = graveyardTable.start();
      const testing = stateAfter(context, started, aliceEnters);
      const failed = stateAfter(context, testing, answer('test:graveyard', 'fail'));

      const state = stateAfter(context, failed, answer(GRAVEYARD_DECISION, optionId));

      expect(requireInvestigator(state, alice)).toMatchObject({
        locationId: at,
        sanity: { horror },
      });
    });
  });

  describe.each([
    { code: '01128', name: "St. Mary's Hospital", after: { health: { damage: 1 } } },
    { code: '01130', name: 'First Bank of Arkham', after: { resources: 8 } },
    { code: '01131', name: 'Arkham Asylum', after: { sanity: { horror: 0 } } },
  ])('$name', ({ code, after }) => {
    const location = instanceId('location');
    /** Alice there on her turn, with 4 damage, 3 horror and 5 resources. */
    const aliceThere = newGame()
      .withLocation(location, cardOf(code), { revealed: true })
      .withInvestigator(alice, {
        locationId: location,
        health: { max: 9, damage: 4 },
        sanity: { max: 9, horror: 3 },
        resources: 5,
      })
      .withTurnOf(alice);
    const useIt: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: location,
      action: 0,
    };

    it('does what its action says for alice, once per game', () => {
      const { context, state: started } = aliceThere.start();

      const state = stateAfter(context, started, useIt);

      expect(requireInvestigator(state, alice)).toMatchObject(after);
      expect(rejectionFrom(context, state, useIt)).toMatchObject({
        code: 'cardActionLimitReached',
      });
    });
  });

  describe.each([
    {
      code: '01124',
      name: 'Your House',
      deferred: { type: 'DrawCards', investigatorId: alice, amount: 1 },
      resources: 6,
    },
    {
      code: '01126',
      name: 'Southside (Historical Society)',
      deferred: { type: 'DrawCards', investigatorId: alice, amount: 3 },
      resources: 5,
    },
    {
      code: '01127',
      name: "Southside (Ma's Boarding House)",
      deferred: { type: 'SearchDeck', investigatorId: alice, traits: ['Ally'] },
      resources: 5,
    },
    {
      code: '01129',
      name: 'Miskatonic University',
      deferred: { type: 'SearchDeck', investigatorId: alice, traits: ['Tome', 'Spell'], top: 6 },
      resources: 5,
    },
  ])('$name: $deferred.type, $resources resources after', ({ code, deferred, resources }) => {
    const location = instanceId('location');
    /** Alice there on her turn, with 5 resources. */
    const aliceThere = newGame()
      .withLocation(location, cardOf(code), { revealed: true })
      .withInvestigator(alice, { locationId: location, resources: 5 })
      .withTurnOf(alice);
    const useIt: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: location,
      action: 0,
    };

    it('leaves the step on her deck to alice', () => {
      const { context, state: started } = aliceThere.start();

      const { events, state } = execute(context, started, useIt);

      expect(events).toContainEqual({ type: 'CommandDeferred', command: deferred });
      expect(requireInvestigator(state, alice)).toMatchObject({ resources });
    });
  });

  it.each([
    { code: '01124', name: 'Your House', limit: 'once per turn' },
    { code: '01126', name: 'Southside (Historical Society)', limit: 'once per game' },
    { code: '01127', name: "Southside (Ma's Boarding House)", limit: 'once per game' },
  ])('$name rejects a second use in the same turn ($limit)', ({ code }) => {
    const location = instanceId('location');
    const { context, state: started } = newGame()
      .withLocation(location, cardOf(code), { revealed: true })
      .withInvestigator(alice, { locationId: location })
      .withTurnOf(alice)
      .start();
    const useIt: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: location,
      action: 0,
    };

    const state = stateAfter(context, started, useIt);

    expect(rejectionFrom(context, state, useIt)).toMatchObject({ code: 'cardActionLimitReached' });
  });

  it('lets alice search at Miskatonic University twice in a turn: it has no limit', () => {
    const university = instanceId('miskatonic_university');
    const { context, state: started } = newGame()
      .withLocation(university, cardOf('01129'), { revealed: true })
      .withInvestigator(alice, { locationId: university })
      .withTurnOf(alice)
      .start();
    const searchThere: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: university,
      action: 0,
    };
    const searchedOnce = stateAfter(context, started, searchThere);

    const { events } = execute(context, searchedOnce, searchThere);

    expect(events).toContainEqual(expect.objectContaining({ type: 'CommandDeferred' }));
  });

  describe('Northside', () => {
    const northside = instanceId('northside');
    const bob = investigatorId('bob');
    /** Alice and bob at Northside with 5 resources each, in round 1's investigation phase. */
    const bothAtNorthside = () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(northside, cardOf('01134'), { revealed: true })
          .withInvestigator(alice, { locationId: northside, resources: 5 })
          .withInvestigator(bob, { locationId: northside, resources: 5 }),
      );
      table.nextPhase();
      return table;
    };

    it("trades alice's 5 resources for 2 clues, and its group limit leaves bob nothing", () => {
      const table = bothAtNorthside();
      table.startTurn(alice);

      table.useCardAction(alice, byName('Northside'));
      table.endTurn(alice);
      table.startTurn(bob);

      expect(table.board.investigator(alice)).toMatchObject({ resources: 0, clues: 2 });
      expect(table.board.cardActions(bob)).toEqual([]);
    });
  });

  describe('Uncovering the Conspiracy', () => {
    const act = instanceId('uncovering_the_conspiracy');
    const bob = investigatorId('bob');
    const cultistDeck = { kind: 'scenarioDeck', deck: 'cultist' } as const;
    const drawCultist: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: act,
      action: 0,
      spend: [
        { investigatorId: alice, amount: 1 },
        { investigatorId: bob, amount: 3 },
      ],
    };
    /** Alice and bob at Rivertown with 3 clues each on alice's turn, the act current. */
    const atRivertown = () =>
      newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown, clues: 3 })
        .withInvestigator(bob, { locationId: rivertown, clues: 3 })
        .withAct(act, cardOf('01123'))
        .withTurnOf(alice);

    it('spends 4 clues of the group and spawns the top cultist, Herman Collins, in the Graveyard', () => {
      const { context, state } = atRivertown()
        .withLocation(graveyard, cardOf('01133'), { revealed: true })
        .withCard(instanceId('herman'), cardOf('01138'), cultistDeck)
        .withCard(instanceId('peter'), cardOf('01139'), cultistDeck)
        .start();

      const after = stateAfter(context, state, drawCultist);

      expect(requireInvestigator(after, alice).clues + requireInvestigator(after, bob).clues).toBe(
        2,
      );
      expect(after.cards[instanceId('herman')]?.zone).toEqual(atLocation(graveyard));
      expect(after.cards[instanceId('peter')]?.zone).toEqual(cultistDeck);
    });

    it('is refused with the Cultist deck empty, and nobody pays', () => {
      const { context, state } = atRivertown().start();

      expect(rejectionFrom(context, state, drawCultist)).toMatchObject({
        code: 'triggeredCommandRejected',
      });
    });
  });

  describe.each([
    { code: '01139', name: 'Peter Warren', holds: { clues: 2 }, after: { clues: 0 } },
    { code: '01140', name: 'Victoria Devereux', holds: { resources: 5 }, after: { resources: 0 } },
  ])('$name', ({ code, name, holds, after }) => {
    const cultist = instanceId('cultist');
    /** Alice engaged with the cultist at Rivertown on her turn, holding `holds`. */
    const aliceEngaged = (holding: { clues?: number; resources?: number }) =>
      newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown, clues: 0, resources: 0, ...holding })
        .withCard(cultist, cardOf(code), engagedWith(alice))
        .withTurnOf(alice);
    const parley: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: cultist,
      action: 0,
    };

    it(`adds ${name} to the victory display for alice's payment, without an attack`, () => {
      const { context, state: started } = aliceEngaged(holds).start();

      const state = stateAfter(context, started, parley);

      expect(state.cards[cultist]?.zone).toEqual({ kind: 'victoryDisplay' });
      expect(requireInvestigator(state, alice)).toMatchObject({ ...after, health: { damage: 0 } });
    });

    it('is refused to alice with nothing to pay', () => {
      const { context, state } = aliceEngaged({}).start();

      expect(rejectionFrom(context, state, parley)).toMatchObject({ code: 'cardActionCostUnpaid' });
    });
  });

  it('adds Herman Collins to the victory display, leaving alice’s 4 discards to the players', () => {
    const herman = instanceId('herman');
    const { context, state } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(herman, cardOf('01138'), engagedWith(alice))
      .withTurnOf(alice)
      .start();

    const { state: after, events } = execute(context, state, {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: herman,
      action: 0,
    });

    expect(after.cards[herman]?.zone).toEqual({ kind: 'victoryDisplay' });
    expect(requireInvestigator(after, alice)).toMatchObject({ health: { damage: 0 } });
    expect(events).toContainEqual({
      type: 'CommandDeferred',
      command: { type: 'DiscardFromHand', investigatorId: alice, amount: 4 },
    });
  });

  describe('Hunting Shadow', () => {
    const shadow = instanceId('hunting_shadow');

    it.each([
      { optionId: 'clue', clues: 0, damage: 0 },
      { optionId: 'damage', clues: 1, damage: 2 },
    ])('makes alice with 1 clue answer $optionId', ({ optionId, clues, damage }) => {
      const { context, state: started } = newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown, clues: 1 })
        .withCard(shadow, cardOf('01135'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(context, started, aliceDraws);

      const state = stateAfter(context, drawn, answer(HUNTING_SHADOW_DECISION, optionId));

      expect(requireInvestigator(state, alice)).toMatchObject({ clues, health: { damage } });
    });
  });

  describe('False Lead', () => {
    const falseLead = instanceId('false_lead');
    const shadow = instanceId('hunting_shadow');

    it('surges when alice has no clues, so she draws the Hunting Shadow below it', () => {
      const { context, state: started } = newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown, clues: 0 })
        .withCard(falseLead, cardOf('01136'), { kind: 'encounterDeck' })
        .withCard(shadow, cardOf('01135'), { kind: 'encounterDeck' })
        .start();

      const { state } = execute(context, started, aliceDraws);

      expect(state.pending).toMatchObject([{ id: HUNTING_SHADOW_DECISION }]);
    });

    it('places 2 of her 3 clues on Rivertown for a failed intellect (4) test by 2', () => {
      const { context, state: started } = newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true, clues: 0 })
        .withInvestigator(alice, { locationId: rivertown, clues: 3 })
        .withCard(falseLead, cardOf('01136'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(context, started, aliceDraws);

      const state = stateAfter(context, drawn, { ...answer('test:false_lead', 'fail'), margin: 2 });

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'intellect', difficulty: 4 } }]);
      expect(requireInvestigator(state, alice).clues).toBe(1);
      expect(state.cards[rivertown]?.tokens.clue).toBe(2);
    });
  });

  it('heals 1 damage from "Wolf-Man" Drew when he attacks', () => {
    const drew = instanceId('wolf_man_drew');
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(drew, cardOf('01137'), engagedWith(alice), { tokens: { damage: 2 } })
      .withTurnOf(alice)
      .start();

    const state = stateAfter(context, started, {
      type: 'DealEnemyAttack',
      enemyId: drew,
      investigatorId: alice,
      damage: 2,
      horror: 0,
    });

    expect(state.cards[drew]?.tokens).toEqual({ damage: 1 });
  });

  it('places 1 doom on Wizard of the Order as the mythos phase ends', () => {
    const wizard = instanceId('wizard_of_the_order');
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(wizard, cardOf('01170'), atLocation(graveyard))
      .withTurnOf(alice)
      .start();
    let mythos = stateAfter(context, started, { type: 'EndTurn', investigatorId: alice });
    while (mythos.meta.phase !== 'mythos') mythos = stateAfter(context, mythos, nextPhase);

    const state = stateAfter(context, mythos, nextPhase);

    expect(mythos.cards[wizard]?.tokens.doom).toBeUndefined();
    expect(state.cards[wizard]?.tokens.doom).toBe(1);
  });

  it('places 2 doom on the nearest Cultist for Mysterious Chanting, not on a Nightgaunt', () => {
    const wizard = instanceId('wizard_of_the_order');
    const nightgaunt = instanceId('hunting_nightgaunt');
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withConnection(rivertown, graveyard)
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(nightgaunt, cardOf('01172'), atLocation(rivertown))
      .withCard(wizard, cardOf('01170'), atLocation(graveyard))
      .withCard(instanceId('mysterious_chanting'), cardOf('01171'), { kind: 'encounterDeck' })
      .start();

    const { state } = execute(context, started, aliceDraws);

    expect(state.cards[wizard]?.tokens.doom).toBe(2);
    expect(state.cards[nightgaunt]?.tokens.doom).toBeUndefined();
  });

  it('draws nothing for Mysterious Chanting with a Cultist in play, and shuffles the encounter deck', () => {
    const wizard = instanceId('wizard_of_the_order');
    const acolyte = instanceId('acolyte');
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withConnection(rivertown, graveyard)
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(wizard, cardOf('01170'), atLocation(graveyard))
      .withCard(instanceId('mysterious_chanting'), cardOf('01171'), { kind: 'encounterDeck' })
      .withCard(acolyte, cardOf('01169'), { kind: 'encounterDeck' })
      .start();

    const { state, events } = execute(context, started, aliceDraws);

    expect(state.cards[acolyte]?.zone.kind).toBe('encounterDeck');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'DeckShuffled', zone: { kind: 'encounterDeck' } }),
    );
  });

  it('draws Wizard of the Order for Mysterious Chanting with no Cultist in play', () => {
    const wizard = instanceId('wizard_of_the_order');
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withConnection(rivertown, graveyard)
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(instanceId('mysterious_chanting'), cardOf('01171'), { kind: 'encounterDeck' })
      .withCard(instanceId('hunting_nightgaunt'), cardOf('01172'), { kind: 'encounterDeck' })
      .withCard(wizard, cardOf('01170'), { kind: 'encounterDeck' })
      .start();

    const state = stateAfter(context, started, aliceDraws);

    // "Spawn - Any empty location": alice stands in Rivertown, so only the Graveyard is empty.
    expect(state.cards[wizard]?.zone).toEqual(atLocation(graveyard));
    expect(state.pending).toEqual([]);
  });

  it('deals the damage of a failed On Wings of Darkness too when its horror defeats alice', () => {
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withInvestigator(alice, {
        locationId: rivertown,
        health: { max: 8, damage: 0 },
        sanity: { max: 6, horror: 5 },
      })
      .withCard(instanceId('on_wings'), cardOf('01173'), { kind: 'encounterDeck' })
      .start();
    const drawn = stateAfter(context, started, aliceDraws);

    const state = stateAfter(context, drawn, answer('test:on_wings', 'fail'));

    expect(requireInvestigator(state, alice)).toMatchObject({
      status: 'defeated',
      health: { damage: 1 },
      sanity: { horror: 6 },
    });
  });

  it('deals 1 horror and 1 damage for a failed On Wings of Darkness, then moves alice to Rivertown without the Wizard but with the Nightgaunt', () => {
    const wizard = instanceId('wizard_of_the_order');
    const nightgaunt = instanceId('hunting_nightgaunt');
    const { context, state: started } = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withInvestigator(alice, { locationId: graveyard })
      .withCard(wizard, cardOf('01170'), engagedWith(alice))
      .withCard(nightgaunt, cardOf('01172'), engagedWith(alice))
      .withCard(instanceId('on_wings'), cardOf('01173'), { kind: 'encounterDeck' })
      .start();
    const drawn = stateAfter(context, started, aliceDraws);
    expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'agility', difficulty: 4 } }]);

    const state = stateAfter(context, drawn, answer('test:on_wings', 'fail'));

    expect(requireInvestigator(state, alice)).toMatchObject({
      locationId: rivertown,
      health: { damage: 1 },
      sanity: { horror: 1 },
    });
    expect(state.cards[wizard]?.zone).toEqual(atLocation(graveyard));
    expect(state.cards[nightgaunt]?.zone).toEqual(engagedWith(alice));
  });
});
