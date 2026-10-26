import { describe, expect, it } from 'vitest';
import {
  atLocation,
  encounterSetCode,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  requireInvestigator,
  threatAreaOf,
  resolveValue,
  type CardStats,
  type Command,
} from '@arkham/engine';
import { answer, cardIn, rejectionFrom, stateAfter } from '@arkham/engine/test/utils';
import {
  DEVOURER_BELOW_RESOLUTIONS,
  OFFER_OF_POWER_DECISION,
  QUIET_GLADE_DECISION,
  theDevourerBelowCardDefs,
  theDevourerBelowCards,
} from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(theDevourerBelowCards, code);

describe('The Devourer Below card data', () => {
  it.each([
    {
      code: '01143',
      name: 'The Arkham Woods',
      front: '/bundles/cards/01143.png',
      back: '/bundles/cards/01143b.png',
    },
    {
      code: '01150',
      name: 'Arkham Woods',
      front: '/bundles/cards/01150.png',
      back: '/bundles/cards/01150b.png',
    },
    { code: '01157', name: 'Umôrdhoth', front: '/bundles/cards/01157.png', back: undefined },
  ])('names the ArkhamDB pictures of $name', ({ code, front, back }) => {
    const card = cardOf(code);

    expect(card.imageSrc).toBe(front);
    expect(card.backImageSrc).toBe(back);
  });

  it.each([
    { set: 'tentacles', copies: 3, cards: "Umôrdhoth, 2 Umôrdhoth's Wrath" },
    { set: 'agents_of_yog', copies: 4, cards: '2 Yithian Observer, 2 Offer of Power' },
    { set: 'agents_of_shub', copies: 4, cards: 'Relentless Dark Young, 3 Goat Spawn' },
    { set: 'agents_of_cthulhu', copies: 4, cards: "2 Young Deep One, 2 Dreams of R'lyeh" },
    { set: 'agents_of_hastur', copies: 4, cards: '2 Screeching Byakhee, 2 The Yellow Sign' },
  ])('has $copies enemy and treachery copies in set $set: $cards', ({ set, copies }) => {
    const encounterCards = theDevourerBelowCardDefs.filter(
      (card) =>
        card.encounterCode === encounterSetCode(set) &&
        (card.typeCode === 'enemy' || card.typeCode === 'treachery'),
    );

    expect(encounterCards.reduce((sum, card) => sum + (card.quantity ?? 1), 0)).toBe(copies);
  });

  it('has the Main Path, six Arkham Woods and the Ritual Site', () => {
    const locations = theDevourerBelowCardDefs.filter((card) => card.typeCode === 'location');

    expect(locations.map((card) => card.name)).toEqual([
      'Main Path',
      ...Array<string>(6).fill('Arkham Woods'),
      'Ritual Site',
    ]);
  });

  it.each([
    { code: '01157', name: 'Umôrdhoth', keywords: ['hunter', 'massive'] },
    { code: '01175', name: 'Screeching Byakhee', keywords: ['prey', 'hunter'] },
    { code: '01178', name: 'Offer of Power', keywords: ['peril'] },
    { code: '01180', name: 'Goat Spawn', keywords: ['hunter', 'retaliate'] },
    { code: '01181', name: 'Young Deep One', keywords: ['prey', 'hunter'] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    expect(cardOf(code).keywords?.map((keyword) => keyword.name)).toEqual(keywords);
  });

  it.each([
    { players: 1, health: 10 },
    { players: 4, health: 22 },
  ])('gives Umôrdhoth $health health with $players investigator(s)', ({ players, health }) => {
    const printed = cardOf('01157').health;

    expect(printed && resolveValue(printed, players)).toBe(health);
  });
});

describe('The Devourer Below card abilities', () => {
  const alice = investigatorId('alice');
  const mainPath = instanceId('main_path');
  const nextPhase: Command = { type: 'NextPhase' };
  const aliceDraws = (card: string): Command => ({
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { name: card },
  });

  describe('Arkham Woods (Unhallowed Ground)', () => {
    const unhallowedGround = instanceId('unhallowed_ground');

    it.each([
      { result: 'pass', damage: 0, horror: 0 },
      { result: 'fail', damage: 1, horror: 1 },
    ])(
      'tests willpower (4) as alice enters; a $result costs $damage damage and $horror horror',
      ({ result, damage, horror }) => {
        const { context, state: started } = newGame()
          .withLocation(mainPath, cardOf('01149'), { revealed: true })
          .withLocation(unhallowedGround, cardOf('01150'), { revealed: true })
          .withConnection(mainPath, unhallowedGround)
          .withInvestigator(alice, { locationId: mainPath })
          .start();
        const entered = stateAfter(context, started, {
          type: 'MoveInvestigator',
          investigatorId: alice,
          to: unhallowedGround,
        });

        const state = stateAfter(context, entered, answer('test:unhallowed_ground', result));

        expect(entered.pending).toMatchObject([
          { skillTest: { skill: 'willpower', difficulty: 4 } },
        ]);
        expect(requireInvestigator(state, alice)).toMatchObject({
          health: { damage },
          sanity: { horror },
        });
      },
    );
  });

  describe('Arkham Woods (Quiet Glade)', () => {
    const quietGlade = instanceId('quiet_glade');
    /** Alice in the Quiet Glade on her turn, with 2 damage and 2 horror. */
    const aliceInTheGlade = newGame()
      .withLocation(quietGlade, cardOf('01155'), { revealed: true })
      .withInvestigator(alice, {
        locationId: quietGlade,
        health: { max: 9, damage: 2 },
        sanity: { max: 9, horror: 2 },
      })
      .withTurnOf(alice);
    const useIt: Command = {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: quietGlade,
      action: 0,
      asAction: true,
    };

    it.each([
      { optionId: 'damage', left: { health: { damage: 1 }, sanity: { horror: 2 } } },
      { optionId: 'horror', left: { health: { damage: 2 }, sanity: { horror: 1 } } },
    ])('heals the 1 $optionId alice picks, once per turn', ({ optionId, left }) => {
      const { context, state: started } = aliceInTheGlade.start();

      const state = stateAfter(context, started, useIt, answer(QUIET_GLADE_DECISION, optionId));

      expect(requireInvestigator(state, alice)).toMatchObject(left);
      expect(rejectionFrom(context, state, useIt)).toMatchObject({
        code: 'cardActionLimitReached',
      });
    });
  });

  describe('Offer of Power', () => {
    const offer = instanceId('offer_of_power');
    const agenda = instanceId('the_arkham_woods');

    it.each([
      { optionId: 'doom', doom: 2, horror: 0 },
      { optionId: 'horror', doom: 0, horror: 2 },
    ])('makes alice answer $optionId', ({ optionId, doom, horror }) => {
      const { context, state: started } = newGame()
        .withLocation(mainPath, cardOf('01149'), { revealed: true })
        .withInvestigator(alice, { locationId: mainPath })
        .withAgenda(agenda, cardOf('01143'))
        .withCard(offer, cardOf('01178'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(context, started, aliceDraws('Offer of Power'));

      const state = stateAfter(context, drawn, answer(OFFER_OF_POWER_DECISION, optionId));

      expect(state.cards[agenda]?.tokens.doom ?? 0).toBe(doom);
      expect(requireInvestigator(state, alice).sanity.horror).toBe(horror);
    });
  });

  describe('The Yellow Sign', () => {
    it.each([
      { result: 'pass', horror: 0 },
      { result: 'fail', horror: 2 },
    ])('tests willpower (4); a $result costs alice $horror horror', ({ result, horror }) => {
      const { context, state: started } = newGame()
        .withLocation(mainPath, cardOf('01149'), { revealed: true })
        .withInvestigator(alice, { locationId: mainPath })
        .withCard(instanceId('yellow_sign'), cardOf('01176'), { kind: 'encounterDeck' })
        .start();
      const drawn = stateAfter(context, started, aliceDraws('The Yellow Sign'));

      const state = stateAfter(context, drawn, answer('test:yellow_sign', result));

      expect(drawn.pending).toMatchObject([{ skillTest: { skill: 'willpower', difficulty: 4 } }]);
      expect(requireInvestigator(state, alice).sanity.horror).toBe(horror);
    });
  });

  it("puts Dreams of R'lyeh into alice's threat area", () => {
    const dreams = instanceId('dreams_of_rlyeh');
    const { context, state: started } = newGame()
      .withLocation(mainPath, cardOf('01149'), { revealed: true })
      .withInvestigator(alice, { locationId: mainPath })
      .withCard(dreams, cardOf('01182'), { kind: 'encounterDeck' })
      .start();

    const { state } = execute(context, started, aliceDraws("Dreams of R'lyeh"));

    expect(state.cards[dreams]?.zone).toEqual(threatAreaOf(alice));
  });

  it('ends the scenario with R1 (the ritual is broken) when Disrupting the Ritual advances', () => {
    const { context, state: started } = newGame()
      .withLocation(mainPath, cardOf('01149'), { revealed: true })
      .withInvestigator(alice, { locationId: mainPath })
      .withAct(instanceId('disrupting_the_ritual'), cardOf('01148'))
      .start();

    const { state } = execute(context, started, { type: 'AdvanceAct' });

    expect(state.meta.resolution).toBe(DEVOURER_BELOW_RESOLUTIONS.ritualBroken);
  });

  describe('Goat Spawn', () => {
    const goatSpawn = instanceId('goat_spawn');
    const bob = investigatorId('bob');

    it('gives each investigator at its location 1 horror when it is defeated', () => {
      const { context, state: started } = newGame()
        .withLocation(mainPath, cardOf('01149'), { revealed: true })
        .withInvestigator(alice, { locationId: mainPath })
        .withInvestigator(bob, { locationId: mainPath })
        .withCard(goatSpawn, cardOf('01180'), engagedWith(alice))
        .start();

      const { state } = execute(context, started, { type: 'DefeatEnemy', enemyId: goatSpawn });

      expect([alice, bob].map((id) => requireInvestigator(state, id).sanity.horror)).toEqual([
        1, 1,
      ]);
    });
  });

  describe('Young Deep One', () => {
    const deepOne = instanceId('young_deep_one');

    it('gives alice 1 horror after it engages her', () => {
      const { context, state: started } = newGame()
        .withLocation(mainPath, cardOf('01149'), { revealed: true })
        .withInvestigator(alice, { locationId: mainPath })
        .withCard(deepOne, cardOf('01181'), { kind: 'encounterDeck' })
        .start();

      const { state } = execute(context, started, aliceDraws('Young Deep One'));

      expect(state.cards[deepOne]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
      expect(requireInvestigator(state, alice).sanity.horror).toBe(1);
    });
  });

  describe('Relentless Dark Young', () => {
    const darkYoung = instanceId('relentless_dark_young');

    const quietGlade = instanceId('quiet_glade');

    it('heals 2 of its 3 damage at the end of the round', () => {
      const { context, state: started } = newGame()
        .withLocation(mainPath, cardOf('01149'), { revealed: true })
        .withLocation(quietGlade, cardOf('01155'), { revealed: true })
        .withInvestigator(alice, { locationId: mainPath })
        .withCard(darkYoung, cardOf('01179'), atLocation(quietGlade), { tokens: { damage: 3 } })
        .withTurnOf(alice)
        .start();
      let state = stateAfter(context, started, { type: 'EndTurn', investigatorId: alice });
      const roundBefore = state.meta.round;
      while (state.meta.round === roundBefore) state = stateAfter(context, state, nextPhase);

      expect(state.cards[darkYoung]?.tokens.damage).toBe(1);
    });
  });

  describe('Umôrdhoth', () => {
    const umordhoth = instanceId('umordhoth');

    it('readies at the end of alice’s turn', () => {
      const { context, state: started } = newGame()
        .withLocation(mainPath, cardOf('01149'), { revealed: true })
        .withInvestigator(alice, { locationId: mainPath })
        .withCard(umordhoth, cardOf('01157'), atLocation(mainPath))
        .withTurnOf(alice)
        .start();
      const exhausted = stateAfter(context, started, { type: 'ExhaustEnemy', enemyId: umordhoth });

      const state = stateAfter(context, exhausted, { type: 'EndTurn', investigatorId: alice });

      expect(exhausted.cards[umordhoth]?.exhausted).toBe(true);
      expect(state.cards[umordhoth]?.exhausted).toBe(false);
    });
  });
});
