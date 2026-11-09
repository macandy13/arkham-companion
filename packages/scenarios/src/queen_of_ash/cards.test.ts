import { describe, expect, it } from 'vitest';
import {
  encounterSetCode,
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
import { queenOfAshCardDefs, queenOfAshCards } from './cards';

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
      cards: "2 Ashen Rebirth, Queen's Knight, Herald of Flame, Elokoss, Servant of Flame",
    },
    { set: 'cultists_ch2', copies: 6, cards: '3 Zealot, Dark Magician, 2 Blasphemous Invocation' },
    { set: 'reeking_decay', copies: 4, cards: '2 Unnatural Decay, 2 Putrid Vapors' },
    { set: 'torment', copies: 6, cards: '2 Languor, 2 Dissonance, 2 Torment' },
  ])('has $copies enemy and treachery copies in set $set: $cards', ({ set, copies }) => {
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
        aliceDraws('Langour'),
        resolveRevelation('languor'),
      ]);

      expect(state.cards[languor]?.zone).toEqual(threatAreaOf(alice));
    });
  });
});
