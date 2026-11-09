import { describe, expect, it } from 'vitest';
import {
  effectiveValue,
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
  type LocationSymbol,
} from '@arkham/engine';
import { answer, cardIn, resolveRevelation, runFrom, stateAfter } from '@arkham/engine/test/utils';
import { ARCANE_LOCK_DECISION, smokeAndMirrorsCardDefs, smokeAndMirrorsCards } from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(smokeAndMirrorsCards, code);

describe('Smoke and Mirrors card data', () => {
  it.each([
    {
      code: '12134',
      name: 'Arkham Alive',
      front: '/bundles/cards/12134.jpg',
      back: '/bundles/cards/12134b.jpg',
    },
    {
      code: '12136',
      name: 'Augurs of Flame',
      front: '/bundles/cards/12136.jpg',
      back: '/bundles/cards/12136b.jpg',
    },
    { code: '12139', name: 'David Renfield', front: '/bundles/cards/12139.jpg', back: undefined },
    { code: '12157', name: 'Arcane Lock', front: '/bundles/cards/12157.jpg', back: undefined },
  ])('names the ArkhamDB pictures of $name, which are JPEGs', ({ code, front, back }) => {
    const card = cardOf(code);

    expect(card.imageSrc).toBe(front);
    expect(card.backImageSrc).toBe(back);
  });

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
    { code: '12138', name: 'Servant of Flame', keywords: ['hunter', 'retaliate'] },
    { code: '12139', name: 'David Renfield', keywords: ['aloof'] },
    { code: '12140', name: 'Cornelia Akely', keywords: ['alert'] },
    { code: '12141', name: "Naomi O'Bannion", keywords: ['retaliate'] },
    { code: '12142', name: 'Sgt. Earl Monroe', keywords: undefined },
    { code: '12143', name: 'Abigail Foreman', keywords: ['aloof'] },
    { code: '12144', name: 'Margaret Liu', keywords: ['aloof'] },
    { code: '12162', name: 'Bat Horror', keywords: ['hunter'] },
    { code: '12163', name: 'Aerial Pursuit', keywords: ['surge'] },
    { code: '12164', name: 'Rogue Gangster', keywords: ['hunter', 'prey', 'retaliate'] },
    { code: '12166', name: 'Whippoorwill', keywords: ['aloof', 'hunter'] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    expect(cardOf(code).keywords?.map((keyword) => keyword.name)).toEqual(keywords);
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
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { name: card },
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
});
