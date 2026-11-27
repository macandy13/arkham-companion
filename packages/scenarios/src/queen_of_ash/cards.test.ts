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
import {
  answer,
  cardIn,
  rejectionFrom,
  resolveRevelation,
  runFrom,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  DISSONANCE_DECISION,
  QUEEN_OF_ASH_CODES,
  queenOfAshCardDefs,
  queenOfAshCards,
  TORMENT_DECISION,
  ASHEN_REBIRTH_DECISION,
  UNNATURAL_DECAY_DECISION,
} from './cards';
import { SPREADING_FLAMES_CODES } from '../spreading_flames/cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(queenOfAshCards, code);

describe('Queen of Ash card data', () => {
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
    type: 'DrawCard',
    investigatorId: alice,
    from: encounterDeck,
    pick: { match: { name: card } },
  });

  describe('A Gathering and A Ritual', () => {
    const zealot = instanceId('zealot');

    it.each([
      { agenda: 'A Gathering', code: QUEEN_OF_ASH_CODES.aGathering },
      { agenda: 'A Ritual', code: QUEEN_OF_ASH_CODES.aRitual },
    ])(
      'keep 1 damage off a Zealot at Sewer Culvert with Fire! attached while $agenda is current',
      ({ code }) => {
        const { context, state } = newGame()
          .withAgenda(instanceId('agenda'), cardOf(code))
          .withLocation(culvert, cardOf(QUEEN_OF_ASH_CODES.sewerCulvert), { revealed: true })
          .withCard(instanceId('fire'), cardOf(SPREADING_FLAMES_CODES.fire), {
            kind: 'attachedTo',
            hostId: culvert,
          })
          .withCard(zealot, cardOf(QUEEN_OF_ASH_CODES.zealot), atLocation(culvert))
          .start();

        const after = stateAfter(context, state, {
          type: 'DamageEnemy',
          enemyId: zealot,
          amount: 1,
        });

        expect(after.cards[zealot]?.tokens.damage).toBeUndefined();
      },
    );
  });

  describe('Elokoss', () => {
    const cistern = instanceId('underground_cistern');
    const elokoss = instanceId('elokoss');
    /** Alice at Underground Cistern in her turn, with Elokoss there; Sewer Culvert next to it. */
    const elokossAtCistern = () =>
      newGame()
        .withLocation(cistern, cardOf(QUEEN_OF_ASH_CODES.undergroundCistern), { revealed: true })
        .withLocation(culvert, cardOf(QUEEN_OF_ASH_CODES.sewerCulvert), { revealed: true })
        .withConnection(cistern, culvert)
        .withInvestigator(alice, { locationId: cistern })
        .withCard(elokoss, cardOf(QUEEN_OF_ASH_CODES.elokoss), atLocation(cistern))
        .withTurnOf(alice)
        .start();

    it('stays at Underground Cistern when a card effect moves her', () => {
      const { context, state } = elokossAtCistern();

      const after = stateAfter(context, state, {
        type: 'MoveEnemy',
        enemyId: elokoss,
        to: culvert,
        forced: true,
      });

      expect(after.cards[elokoss]?.zone).toEqual(atLocation(cistern));
    });

    it('makes no attack of opportunity when alice takes the resource action at her location', () => {
      const { context, state } = elokossAtCistern();

      const after = stateAfter(context, state, {
        type: 'GainResources',
        investigatorId: alice,
        amount: 1,
        asAction: true,
      });

      expect(after.pending).toEqual([]);
    });
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
      { answered: 'use', resources: 2 },
      { answered: 'pass', resources: 1 },
    ])(
      "offers alice Smuggler's Cache's reaction to gain 1 resource; answering $answered leaves her $resources",
      ({ answered, resources }) => {
        const { context, state: asked } = aliceEndsHerTurnIn(QUEEN_OF_ASH_CODES.smugglersCache);

        const state = stateAfter(context, asked, answer('reaction:sewer_tunnel:0', answered));

        expect(asked.pending).toMatchObject([
          {
            id: 'reaction:sewer_tunnel:0',
            prompt: 'decision.reaction',
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

  describe('the clues to enter Underground Cistern and Sluice Control', () => {
    const bob = investigatorId('bob');
    const cistern = instanceId('underground_cistern');
    const sluice = instanceId('sluice_control');

    it.each([
      { into: 'Sluice Control', from: cistern, to: sluice, cost: 2 },
      { into: 'Underground Cistern', from: sluice, to: cistern, cost: 6 },
    ])(
      'costs alice and bob $cost clues as a group for alice to enter the unrevealed $into',
      ({ from, to, cost }) => {
        const { context, state: started } = newGame()
          .withLocation(cistern, cardOf('12174'), { revealed: from === cistern })
          .withLocation(sluice, cardOf('12175'), { revealed: from === sluice })
          .withInvestigator(alice, { locationId: from, clues: 6 })
          .withInvestigator(bob, { locationId: from })
          .withTurnOf(alice)
          .start();

        const state = stateAfter(context, started, {
          type: 'MoveInvestigator',
          investigatorId: alice,
          to,
          asAction: true,
        });

        expect(requireInvestigator(state, alice)).toMatchObject({
          locationId: to,
          clues: 6 - cost,
        });
      },
    );
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

    it("refuses alice's spend when the 2 clues it costs 2 investigators need bob's clue beside her", () => {
      const bob = investigatorId('bob');
      const { context, state } = newGame()
        .withLocation(cistern, cardOf('12174'), { revealed: true })
        .withInvestigator(alice, { locationId: cistern, clues: 1 })
        .withInvestigator(bob, { locationId: cistern, clues: 1 })
        .withCard(elokoss, cardOf('12179'), atLocation(cistern))
        .withTurnOf(alice)
        .start();

      expect(
        rejectionFrom(context, state, {
          type: 'UseCardAction',
          investigatorId: alice,
          cardId: elokoss,
          action: 0,
        }).code,
      ).toBe('cardActionCostUnpaid');
    });

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

  describe('Ashen Rebirth', () => {
    const ashenRebirth = instanceId('ashen_rebirth');

    it.each([
      { damage: 1, horror: 0, damageAfter: 3, horrorAfter: 0 },
      { damage: 0, horror: 2, damageAfter: 0, horrorAfter: 4 },
    ])(
      'tests willpower (4); on a fail alice with $damage damage and $horror horror takes 2 more of the one she has more of',
      ({ damage, horror, damageAfter, horrorAfter }) => {
        const { context, state: started } = newGame()
          .withLocation(culvert, cardOf('12182'), { revealed: true })
          .withInvestigator(alice, {
            locationId: culvert,
            health: { max: 9, damage },
            sanity: { max: 9, horror },
          })
          .withCard(ashenRebirth, cardOf('12176'), { kind: 'encounterDeck' })
          .start();
        const drawn = stateAfter(
          context,
          started,
          aliceDraws('Ashen Rebirth'),
          resolveRevelation('ashen_rebirth'),
        );

        const state = stateAfter(context, drawn, answer('test:ashen_rebirth', 'fail'));

        expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty: 4 } }]);
        expect(state.pending).toEqual([]);
        expect(requireInvestigator(state, alice)).toMatchObject({
          health: { damage: damageAfter },
          sanity: { horror: horrorAfter },
        });
      },
    );

    it.each([
      { pick: 'damage', damageAfter: 3, horrorAfter: 1 },
      { pick: 'horror', damageAfter: 1, horrorAfter: 3 },
    ])(
      'lets alice with as much damage as horror pick $pick on a fail',
      ({ pick, damageAfter, horrorAfter }) => {
        const { context, state: started } = newGame()
          .withLocation(culvert, cardOf('12182'), { revealed: true })
          .withInvestigator(alice, {
            locationId: culvert,
            health: { max: 9, damage: 1 },
            sanity: { max: 9, horror: 1 },
          })
          .withCard(ashenRebirth, cardOf('12176'), { kind: 'encounterDeck' })
          .start();

        const state = stateAfter(
          context,
          started,
          aliceDraws('Ashen Rebirth'),
          resolveRevelation('ashen_rebirth'),
          answer('test:ashen_rebirth', 'fail'),
          answer(ASHEN_REBIRTH_DECISION, pick),
        );

        expect(requireInvestigator(state, alice)).toMatchObject({
          health: { damage: damageAfter },
          sanity: { horror: horrorAfter },
        });
      },
    );
  });

  describe('Unnatural Decay', () => {
    it.each([
      { pick: 'doom', doomOnAssets: 1, damage: 0 },
      { pick: 'damage', doomOnAssets: 0, damage: 2 },
    ])('tests willpower (4); on a fail alice picks $pick', ({ pick, doomOnAssets, damage }) => {
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(instanceId('unnatural_decay'), cardOf('12191'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(
        context,
        started,
        aliceDraws('Unnatural Decay'),
        resolveRevelation('unnatural_decay'),
      );

      const state = stateAfter(
        context,
        drawn,
        answer('test:unnatural_decay', 'fail'),
        answer(UNNATURAL_DECAY_DECISION, pick),
      );

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty: 4 } }]);
      expect(requireInvestigator(state, alice)).toMatchObject({
        doomOnPlayerCards: doomOnAssets,
        health: { damage },
      });
    });
  });

  describe('Blasphemous Invocation', () => {
    const zealot = instanceId('zealot');
    const invocation = instanceId('blasphemous_invocation');

    it.each([{ failedBy: 1 }, { failedBy: 3 }])(
      'places 1 doom on the one Zealot without doom when alice fails by $failedBy',
      ({ failedBy }) => {
        const { context, state: started } = newGame()
          .withLocation(culvert, cardOf('12182'), { revealed: true })
          .withInvestigator(alice, { locationId: culvert })
          .withCard(zealot, cardOf('12188'), atLocation(culvert))
          .withCard(invocation, cardOf('12190'), { kind: 'encounterDeck' })
          .start();
        const drawn = stateAfter(
          context,
          started,
          aliceDraws('Blasphemous Invocation'),
          resolveRevelation('blasphemous_invocation'),
        );

        const state = stateAfter(context, drawn, {
          ...answer('test:blasphemous_invocation', 'fail'),
          margin: failedBy,
        });

        expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty: 3 } }]);
        expect(state.cards[zealot]?.tokens.doom).toBe(1);
      },
    );

    it('draws a Cultist from the encounter deck when every Cultist in play has doom', () => {
      const deckZealot = instanceId('deck_zealot');
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(zealot, cardOf('12188'), atLocation(culvert), { tokens: { doom: 1 } })
        .withCard(invocation, cardOf('12190'), { kind: 'encounterDeck' })
        .withCard(deckZealot, cardOf('12188'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(
        context,
        started,
        aliceDraws('Blasphemous Invocation'),
        resolveRevelation('blasphemous_invocation'),
      );

      const state = stateAfter(context, drawn, answer('test:blasphemous_invocation', 'fail'));

      expect(state.cards[zealot]?.tokens.doom).toBe(1);
      expect(state.cards[deckZealot]?.zone).toEqual({ kind: 'atLocation', locationId: culvert });
    });
  });

  describe('Dissonance', () => {
    it('tests willpower (3); a fail costs alice 1 action and asks her for a card type', () => {
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(instanceId('dissonance'), cardOf('12194'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(
        context,
        started,
        aliceDraws('Dissonance'),
        resolveRevelation('dissonance'),
      );

      const failed = stateAfter(context, drawn, answer('test:dissonance', 'fail'));
      const answered = stateAfter(context, failed, answer(DISSONANCE_DECISION, 'event'));

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty: 3 } }]);
      expect(requireInvestigator(started, alice).actionsRemaining).toBe(3);
      expect(requireInvestigator(failed, alice).actionsRemaining).toBe(2);
      expect(failed.pending).toMatchObject([
        { id: DISSONANCE_DECISION, options: [{ id: 'asset' }, { id: 'event' }, { id: 'skill' }] },
      ]);
      expect(answered.pending).toEqual([]);
    });
  });

  describe('Torment', () => {
    it('tests willpower (3); a fail asks alice to name a card type', () => {
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(instanceId('torment'), cardOf('12195'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(
        context,
        started,
        aliceDraws('Torment'),
        resolveRevelation('torment'),
      );

      const failed = stateAfter(context, drawn, answer('test:torment', 'fail'));

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty: 3 } }]);
      expect(failed.pending).toMatchObject([
        { id: TORMENT_DECISION, options: [{ id: 'asset' }, { id: 'event' }, { id: 'skill' }] },
      ]);
    });

    it('asks nothing more on a pass', () => {
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(instanceId('torment'), cardOf('12195'), { kind: 'encounterDeck' })
        .start();

      const passed = stateAfter(
        context,
        started,
        aliceDraws('Torment'),
        resolveRevelation('torment'),
        answer('test:torment', 'pass'),
      );

      expect(passed.pending).toEqual([]);
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

    it('lets alice discard it with its two-action ability', () => {
      const languor = instanceId('languor');
      const { context, state: started } = newGame()
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert })
        .withCard(languor, cardOf('12193'), threatAreaOf(alice))
        .withTurnOf(alice)
        .start();

      const state = stateAfter(context, started, {
        type: 'UseCardAction',
        investigatorId: alice,
        cardId: languor,
        action: 0,
      });

      expect(state.cards[languor]?.zone).toEqual(encounterDiscard);
    });
  });

  describe('Stop the Rite', () => {
    const cistern = instanceId('underground_cistern');
    const fireHere = instanceId('fire_at_culvert');
    const fireElsewhere = instanceId('fire_at_cistern');
    /** Alice with 1 clue at Sewer Culvert, a Fire! attached to Underground Cistern, and one to `culvertHas`. */
    const aliceWithFireAt = (culvertHas: 'fire' | 'no fire') => {
      const builder = newGame()
        .withAct(instanceId('stop_the_rite'), cardOf('12173'))
        .withLocation(culvert, cardOf('12182'), { revealed: true })
        .withLocation(cistern, cardOf('12174'), { revealed: true })
        .withInvestigator(alice, { locationId: culvert, clues: 1 })
        .withCard(fireElsewhere, cardOf('12129'), { kind: 'attachedTo', hostId: cistern })
        .withTurnOf(alice);
      return (
        culvertHas === 'fire'
          ? builder.withCard(fireHere, cardOf('12129'), { kind: 'attachedTo', hostId: culvert })
          : builder
      ).start();
    };
    const aliceUsesStopTheRite: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: instanceId('stop_the_rite'),
      action: 0,
    };

    it("discards the Fire! at alice's location as a fast ability for 1 clue per investigator", () => {
      const { context, state: started } = aliceWithFireAt('fire');

      const { state } = execute(context, started, aliceUsesStopTheRite);

      expect(requireInvestigator(state, alice)).toMatchObject({ clues: 0, actionsRemaining: 3 });
      expect(state.cards[fireHere]?.zone).toEqual(encounterDiscard);
      expect(state.cards[fireElsewhere]?.zone).toEqual({ kind: 'attachedTo', hostId: cistern });
    });

    it("refuses the ability without a Fire! at alice's location", () => {
      const { context, state } = aliceWithFireAt('no fire');

      expect(rejectionFrom(context, state, aliceUsesStopTheRite).code).toBe('changesNothing');
    });
  });
});
