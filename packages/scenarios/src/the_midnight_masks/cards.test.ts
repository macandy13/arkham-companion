import { describe, expect, it } from 'vitest';
import {
  atLocation,
  cardCode,
  encounterSetCode,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  requireInvestigator,
  resolveValue,
  type CardStats,
  type Command,
} from '@arkham/engine';
import { answer, stateAfter } from '@arkham/engine/test/utils';
import {
  GRAVEYARD_DECISION,
  HUNTING_SHADOW_DECISION,
  theMidnightMasksCardDefs,
  theMidnightMasksCards,
} from './cards';

/** The card with `code`, failing the test if the data has none. */
function cardOf(code: string): CardStats {
  const card = theMidnightMasksCards.get(cardCode(code));
  if (!card) throw new Error(`no card ${code}`);
  return card;
}

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

    const drawn = stateAfter(context, started, aliceDraws);
    expect(drawn.pending).toMatchObject([{ id: 'spawn:wizard_of_the_order' }]);

    const state = stateAfter(context, drawn, answer('spawn:wizard_of_the_order', graveyard));

    expect(state.cards[wizard]?.zone).toEqual(atLocation(graveyard));
  });

  it('deals 1 horror and 1 damage for a failed On Wings of Darkness, then moves alice to Rivertown', () => {
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
