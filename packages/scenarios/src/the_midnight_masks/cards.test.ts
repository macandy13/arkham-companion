import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  byName,
  encounterDeck,
  encounterSetCode,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  requireInvestigator,
  resolveValue,
  victoryDisplay,
  type CardStats,
} from '@arkham/engine';
import { answer, cardIn, rejectionOf } from '@arkham/engine/test/utils';
import {
  GRAVEYARD_DECISION,
  HUNTING_SHADOW_DECISION,
  LOCKED_DOOR_DECISION,
  theMidnightMasksCardDefs,
  theMidnightMasksCards,
} from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(theMidnightMasksCards, code);

describe('The Midnight Masks card data', () => {
  it.each([
    { code: '01124', name: 'Your House', symbol: 'tilde' },
    { code: '01125', name: 'Rivertown', symbol: 'circle' },
    { code: '01126', name: 'Southside (1)', symbol: 'square' },
    { code: '01127', name: 'Southside (2)', symbol: 'square' },
    { code: '01128', name: "St. Mary's Hospital", symbol: 'plus' },
    { code: '01129', name: 'Miskatonic University', symbol: 'diamond' },
    { code: '01130', name: 'Downtown (1)', symbol: 'triangle' },
    { code: '01131', name: 'Downtown (2)', symbol: 'triangle' },
    { code: '01132', name: 'Easttown', symbol: 'moon' },
    { code: '01133', name: 'Graveyard', symbol: 'hourglass' },
    { code: '01134', name: 'Northside', symbol: 't' },
  ])('gives $name its printed connection symbol, the $symbol', ({ code, symbol }) => {
    expect(cardOf(code).symbol).toBe(symbol);
  });

  // The ArkhamDB check skips The Masked Hunter: ArkhamDB lists it only as the agenda's linked side.
  it('names the picture and keywords of The Masked Hunter, the reverse side of the first agenda', () => {
    const hunter = cardOf('01121b');

    expect(hunter.imageSrc).toBe('/bundles/cards/01121b.png');
    expect(hunter.keywords?.map((keyword) => keyword.name)).toEqual(['spawn', 'prey', 'hunter']);
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

  describe('Graveyard', () => {
    /** Alice in Rivertown, next to the revealed Graveyard. */
    const graveyardTable = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withConnection(rivertown, graveyard)
      .withInvestigator(alice, { locationId: rivertown });

    it('tests willpower (3) once alice enters it', () => {
      const table = PlayTable.start(graveyardTable);

      table.moveTo(alice, graveyard);

      expect(table.state.pending).toMatchObject([
        { id: 'test:graveyard', skillTest: { skill: 'willpower', difficulty: 3 } },
      ]);
    });

    it.each([
      { optionId: 'horror', horror: 2, at: graveyard },
      { optionId: 'rivertown', horror: 0, at: rivertown },
    ])('on a fail, $optionId leaves alice with $horror horror', ({ optionId, horror, at }) => {
      const table = PlayTable.start(graveyardTable);
      table.moveTo(alice, graveyard);
      table.resolveTest('fail');

      table.play(answer(GRAVEYARD_DECISION, optionId));

      expect(table.board.locationOf(alice)).toBe(at);
      expect(table.board.investigator(alice).horror).toBe(horror);
    });

    it("offers its choice under the test's fail, so the players answer both at once", () => {
      const table = PlayTable.start(graveyardTable);

      table.moveTo(alice, graveyard);

      expect(table.board.decisions[0]?.followUps).toEqual({
        fail: {
          prompt: 'scenario.theMidnightMasks.graveyard.prompt',
          options: [
            'scenario.theMidnightMasks.graveyard.horror',
            'scenario.theMidnightMasks.graveyard.rivertown',
          ],
        },
      });
    });
  });

  describe.each([
    { code: '01128', name: "St. Mary's Hospital", after: { damage: 1 } },
    { code: '01130', name: 'First Bank of Arkham', after: { resources: 8 } },
    { code: '01131', name: 'Arkham Asylum', after: { horror: 0 } },
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

    it('does what its action says for alice, once per game', () => {
      const table = PlayTable.start(aliceThere);

      table.useCardAction(alice, location);

      expect(table.board.investigator(alice)).toMatchObject(after);
      expect(rejectionOf(() => table.useCardAction(alice, location))).toMatchObject({
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

    it('leaves the step on her deck to alice', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(location, cardOf(code), { revealed: true })
          .withInvestigator(alice, { locationId: location, resources: 5 })
          .withTurnOf(alice),
      );

      table.useCardAction(alice, location);

      expect(table.events).toContainEqual({
        type: 'CommandDeferred',
        command: { ...deferred, source: { cardId: location, window: 'action' } },
      });
      expect(table.board.investigator(alice)).toMatchObject({ resources });
    });
  });

  it.each([
    { code: '01124', name: 'Your House', limit: 'once per turn' },
    { code: '01126', name: 'Southside (Historical Society)', limit: 'once per game' },
    { code: '01127', name: "Southside (Ma's Boarding House)", limit: 'once per game' },
  ])('$name rejects a second use in the same turn ($limit)', ({ code }) => {
    const location = instanceId('location');
    const table = PlayTable.start(
      newGame()
        .withLocation(location, cardOf(code), { revealed: true })
        .withInvestigator(alice, { locationId: location })
        .withTurnOf(alice),
    );

    table.useCardAction(alice, location);

    expect(rejectionOf(() => table.useCardAction(alice, location))).toMatchObject({
      code: 'cardActionLimitReached',
    });
  });

  it('lets alice search at Miskatonic University twice in a turn: it has no limit', () => {
    const university = instanceId('miskatonic_university');
    const table = PlayTable.start(
      newGame()
        .withLocation(university, cardOf('01129'), { revealed: true })
        .withInvestigator(alice, { locationId: university })
        .withTurnOf(alice),
    );
    table.useCardAction(alice, university);

    table.useCardAction(alice, university);

    expect(table.events.filter((event) => event.type === 'CommandDeferred')).toHaveLength(2);
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
    /** Alice and bob at Rivertown with 3 clues each on alice's turn, the act current. */
    const atRivertown = () =>
      newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown, clues: 3 })
        .withInvestigator(bob, { locationId: rivertown, clues: 3 })
        .withAct(act, cardOf('01123'))
        .withTurnOf(alice);
    /** Alice draws a cultist with the act's action, paying 1 clue and bob 3. */
    const drawCultist = (table: PlayTable) =>
      table.useCardAction(alice, act, 0, [
        [alice, 1],
        [bob, 3],
      ]);

    it('spends 4 clues of the group and spawns the top cultist, Herman Collins, in the Graveyard', () => {
      const table = PlayTable.start(
        atRivertown()
          .withLocation(graveyard, cardOf('01133'), { revealed: true })
          .withCard(instanceId('herman'), cardOf('01138'), cultistDeck)
          .withCard(instanceId('peter'), cardOf('01139'), cultistDeck),
      );

      drawCultist(table);

      expect(table.board.perInvestigator('clues')).toEqual({ alice: 2, bob: 0 });
      expect(table.state.cards[instanceId('herman')]?.zone).toEqual(atLocation(graveyard));
      expect(table.state.cards[instanceId('peter')]?.zone).toEqual(cultistDeck);
    });

    it('is refused with the Cultist deck empty, and nobody pays', () => {
      const table = PlayTable.start(atRivertown());

      expect(rejectionOf(() => drawCultist(table))).toMatchObject({
        code: 'triggeredCommandRejected',
      });
      expect(table.board.perInvestigator('clues')).toEqual({ alice: 3, bob: 3 });
    });

    const maskedHunter = { id: instanceId('masked_hunter'), code: '01121b' };
    const drew = { id: instanceId('wolf_man_drew'), code: '01137' };
    const peter = { id: instanceId('peter_warren'), code: '01139' };
    const victoria = { id: instanceId('victoria_devereux'), code: '01140' };
    const ruth = { id: instanceId('ruth_turner'), code: '01141' };
    const acolyte = { id: instanceId('acolyte'), code: '01169' };

    it.each([
      {
        inDisplay: 'The Masked Hunter, Drew, Peter, Victoria and Ruth',
        shown: [maskedHunter, drew, peter, victoria, ruth],
        resolution: 'R1',
      },
      {
        inDisplay: 'The Masked Hunter, Drew, Peter, Victoria and an Acolyte',
        shown: [maskedHunter, drew, peter, victoria, acolyte],
        resolution: undefined,
      },
    ])(
      'with $inDisplay in the victory display, interrogating Herman Collins ends in $resolution',
      ({ shown, resolution }) => {
        const herman = instanceId('herman');
        const withDisplay = shown.reduce(
          (game, { id, code }) => game.withCard(id, cardOf(code), victoryDisplay),
          atRivertown(),
        );
        const table = PlayTable.start(
          withDisplay.withCard(herman, cardOf('01138'), engagedWith(alice)),
        );

        table.useCardAction(alice, herman);

        expect(table.state.cards[herman]?.zone).toEqual(victoryDisplay);
        expect(table.board.resolution).toBe(resolution);
      },
    );

    it('ends in R1 once alice evades Ruth Turner as the sixth unique Cultist', () => {
      const herman = { id: instanceId('herman_collins'), code: '01138' };
      const withDisplay = [maskedHunter, drew, peter, victoria, herman].reduce(
        (game, { id, code }) => game.withCard(id, cardOf(code), victoryDisplay),
        atRivertown(),
      );
      const table = PlayTable.start(
        withDisplay.withCard(ruth.id, cardOf(ruth.code), engagedWith(alice)),
      );

      table.evade(alice, ruth.id, { result: 'pass' });

      expect(table.state.cards[ruth.id]?.zone).toEqual(victoryDisplay);
      expect(table.board.resolution).toBe('R1');
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

    it(`adds ${name} to the victory display for alice's payment, without an attack`, () => {
      const table = PlayTable.start(aliceEngaged(holds));

      table.useCardAction(alice, cultist);

      expect(table.state.cards[cultist]?.zone).toEqual(victoryDisplay);
      expect(table.board.investigator(alice)).toMatchObject({ ...after, damage: 0 });
    });

    it('is refused to alice with nothing to pay', () => {
      const table = PlayTable.start(aliceEngaged({}));

      expect(rejectionOf(() => table.useCardAction(alice, cultist))).toMatchObject({
        code: 'cardActionCostUnpaid',
      });
    });
  });

  it('adds Herman Collins to the victory display, leaving alice’s 4 discards to the players', () => {
    const herman = instanceId('herman');
    const table = PlayTable.start(
      newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown })
        .withCard(herman, cardOf('01138'), engagedWith(alice))
        .withTurnOf(alice),
    );

    table.useCardAction(alice, herman);

    expect(table.state.cards[herman]?.zone).toEqual(victoryDisplay);
    expect(table.board.investigator(alice)).toMatchObject({ damage: 0 });
    expect(table.events).toContainEqual({
      type: 'CommandDeferred',
      command: {
        type: 'DiscardFromHand',
        investigatorId: alice,
        amount: 4,
        source: { cardId: herman, window: 'action' },
      },
    });
  });

  it.each([
    { optionId: 'clue', clues: 0, damage: 0 },
    { optionId: 'damage', clues: 1, damage: 2 },
  ])(
    'makes alice with 1 clue answer $optionId to Hunting Shadow',
    ({ optionId, clues, damage }) => {
      const shadow = instanceId('hunting_shadow');
      const table = PlayTable.start(
        newGame()
          .withLocation(rivertown, cardOf('01125'), { revealed: true })
          .withInvestigator(alice, { locationId: rivertown, clues: 1 })
          .withCard(shadow, cardOf('01135'), encounterDeck),
      );
      table.drawEncounterCard(alice);
      table.resolveRevelation(shadow);

      table.play(answer(HUNTING_SHADOW_DECISION, optionId));

      expect(table.board.investigator(alice)).toMatchObject({ clues, damage });
    },
  );

  it.each([
    { skill: 'combat', outcome: 'pass', zone: { kind: 'encounterDiscard' } },
    { skill: 'agility', outcome: 'fail', zone: attachedTo(rivertown) },
  ] as const)(
    'tests $skill (4) for alice under the Locked Door in Rivertown and is $zone.kind after a $outcome',
    ({ skill, outcome, zone }) => {
      const door = instanceId('locked_door');
      const table = PlayTable.start(
        newGame()
          .withLocation(rivertown, cardOf('01125'), { revealed: true })
          .withInvestigator(alice, { locationId: rivertown })
          .withCard(door, cardOf('01174'), attachedTo(rivertown))
          .withTurnOf(alice),
      );
      table.useCardAction(alice, door);
      table.play(answer(LOCKED_DOOR_DECISION, skill));
      expect(table.state.pending).toMatchObject([{ skillTest: { skill, difficulty: 4 } }]);

      table.resolveTest(outcome);

      expect(table.state.cards[door]?.zone).toEqual(zone);
    },
  );

  describe('False Lead', () => {
    const falseLead = instanceId('false_lead');
    const shadow = instanceId('hunting_shadow');

    it('surges when alice has no clues, so she draws the Hunting Shadow below it', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(rivertown, cardOf('01125'), { revealed: true })
          .withInvestigator(alice, { locationId: rivertown, clues: 0 })
          .withCard(falseLead, cardOf('01136'), encounterDeck)
          .withCard(shadow, cardOf('01135'), encounterDeck),
      );
      table.drawEncounterCard(alice);

      table.resolveRevelation(falseLead);

      expect(table.state.pending).toMatchObject([{ id: 'revelation:hunting_shadow' }]);
    });

    it('places 2 of her 3 clues on Rivertown for a failed intellect (4) test by 2', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(rivertown, cardOf('01125'), { revealed: true, clues: 0 })
          .withInvestigator(alice, { locationId: rivertown, clues: 3 })
          .withCard(falseLead, cardOf('01136'), encounterDeck),
      );
      table.drawEncounterCard(alice);
      table.resolveRevelation(falseLead);
      expect(table.state.pending).toMatchObject([
        { skillTest: { skill: 'intellect', difficulty: 4 } },
      ]);

      table.play({ ...answer('test:false_lead', 'fail'), margin: 2 });

      expect(table.board.investigator(alice).clues).toBe(1);
      expect(table.board.location(rivertown).clues).toBe(2);
    });
  });

  it('heals 1 damage from "Wolf-Man" Drew when he attacks', () => {
    const drew = instanceId('wolf_man_drew');
    const table = PlayTable.start(
      newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown })
        .withCard(drew, cardOf('01137'), engagedWith(alice), { tokens: { damage: 2 } })
        .withTurnOf(alice),
    );

    table.play({
      type: 'DealEnemyAttack',
      kind: 'cardAttack',
      enemyId: drew,
      investigatorId: alice,
      damage: 2,
      horror: 0,
    });

    expect(table.state.cards[drew]?.tokens).toEqual({ damage: 1 });
  });

  it('places 1 doom on Wizard of the Order as the mythos phase ends', () => {
    const wizard = instanceId('wizard_of_the_order');
    const table = PlayTable.start(
      newGame()
        .withLocation(rivertown, cardOf('01125'), { revealed: true })
        .withLocation(graveyard, cardOf('01133'), { revealed: true })
        .withInvestigator(alice, { locationId: rivertown })
        .withCard(wizard, cardOf('01170'), atLocation(graveyard))
        .withTurnOf(alice),
    );
    table.endTurn(alice);
    while (table.board.phase !== 'mythos') table.nextPhase();
    expect(table.state.cards[wizard]?.tokens.doom).toBeUndefined();

    table.nextPhase();

    expect(table.state.cards[wizard]?.tokens.doom).toBe(1);
  });

  describe('Mysterious Chanting', () => {
    const chanting = instanceId('mysterious_chanting');
    const wizard = instanceId('wizard_of_the_order');
    /** Alice in Rivertown next to the Graveyard, Mysterious Chanting on top of the encounter deck. */
    const chantingOnTop = newGame()
      .withLocation(rivertown, cardOf('01125'), { revealed: true })
      .withLocation(graveyard, cardOf('01133'), { revealed: true })
      .withConnection(rivertown, graveyard)
      .withInvestigator(alice, { locationId: rivertown })
      .withCard(chanting, cardOf('01171'), encounterDeck);

    it('places 2 doom on the nearest Cultist, not on a Nightgaunt', () => {
      const nightgaunt = instanceId('hunting_nightgaunt');
      const table = PlayTable.start(
        chantingOnTop
          .withCard(nightgaunt, cardOf('01172'), atLocation(rivertown))
          .withCard(wizard, cardOf('01170'), atLocation(graveyard)),
      );
      table.drawEncounterCard(alice);

      table.resolveRevelation(chanting);

      expect(table.state.cards[wizard]?.tokens.doom).toBe(2);
      expect(table.state.cards[nightgaunt]?.tokens.doom).toBeUndefined();
    });

    it('draws nothing with a Cultist in play, and shuffles the encounter deck', () => {
      const acolyte = instanceId('acolyte');
      const table = PlayTable.start(
        chantingOnTop
          .withCard(wizard, cardOf('01170'), atLocation(graveyard))
          .withCard(acolyte, cardOf('01169'), encounterDeck),
      );
      table.drawEncounterCard(alice);

      table.resolveRevelation(chanting);

      expect(table.state.cards[acolyte]?.zone).toEqual(encounterDeck);
      expect(table.events).toContainEqual(
        expect.objectContaining({ type: 'DeckShuffled', zone: encounterDeck }),
      );
    });

    it('draws Wizard of the Order with no Cultist in play', () => {
      const table = PlayTable.start(
        chantingOnTop
          .withCard(instanceId('hunting_nightgaunt'), cardOf('01172'), encounterDeck)
          .withCard(wizard, cardOf('01170'), encounterDeck),
      );
      table.drawEncounterCard(alice);

      table.resolveRevelation(chanting);

      // "Spawn - Any empty location": alice stands in Rivertown, so only the Graveyard is empty.
      expect(table.state.cards[wizard]?.zone).toEqual(atLocation(graveyard));
      expect(table.state.pending).toEqual([]);
    });
  });

  describe('On Wings of Darkness', () => {
    const onWings = instanceId('on_wings');

    it('deals the damage of a failed test too when its horror defeats alice', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(rivertown, cardOf('01125'), { revealed: true })
          .withInvestigator(alice, {
            locationId: rivertown,
            health: { max: 8, damage: 0 },
            sanity: { max: 6, horror: 5 },
          })
          .withCard(onWings, cardOf('01173'), encounterDeck),
      );
      table.drawEncounterCard(alice);
      table.resolveRevelation(onWings);

      table.resolveTest('fail');

      expect(requireInvestigator(table.state, alice)).toMatchObject({
        status: 'defeated',
        health: { damage: 1 },
        sanity: { horror: 6 },
      });
    });

    it('deals 1 horror and 1 damage for a failed test, then moves alice to Rivertown without the Wizard but with the Nightgaunt', () => {
      const wizard = instanceId('wizard_of_the_order');
      const nightgaunt = instanceId('hunting_nightgaunt');
      const table = PlayTable.start(
        newGame()
          .withLocation(rivertown, cardOf('01125'), { revealed: true })
          .withLocation(graveyard, cardOf('01133'), { revealed: true })
          .withInvestigator(alice, { locationId: graveyard })
          .withCard(wizard, cardOf('01170'), engagedWith(alice))
          .withCard(nightgaunt, cardOf('01172'), engagedWith(alice))
          .withCard(onWings, cardOf('01173'), encounterDeck),
      );
      table.drawEncounterCard(alice);
      table.resolveRevelation(onWings);
      expect(table.state.pending).toMatchObject([
        { skillTest: { skill: 'agility', difficulty: 4 } },
      ]);

      table.resolveTest('fail');

      expect(requireInvestigator(table.state, alice)).toMatchObject({
        locationId: rivertown,
        health: { damage: 1 },
        sanity: { horror: 1 },
      });
      expect(table.state.cards[wizard]?.zone).toEqual(atLocation(graveyard));
      expect(table.state.cards[nightgaunt]?.zone).toEqual(engagedWith(alice));
    });
  });
});
