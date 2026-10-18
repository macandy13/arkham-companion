import { describe, expect, it } from 'vitest';
import {
  attachedTo,
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  CommandRejected,
  confirmOptions,
  decisionId,
  emptyState,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  replay,
  threatAreaOf,
  trait,
  zoneKey,
  type BuiltGame,
  type CardStats,
  type Command,
  type EffectsRegistry,
  type Event,
  type GameBuilder,
  type GameState,
  type InstanceId,
  type Zone,
  type ScenarioHooks,
} from './index';
import { rejectionFrom, stateAfter, withScenario } from '../test/utils';

const hall = instanceId('hall');
const alice = investigatorId('alice');
const encounterDeck: Zone = { kind: 'encounterDeck' };
const encounterDiscard: Zone = { kind: 'encounterDiscard' };
const setAsideZone: Zone = { kind: 'setAside' };
const hallCard = blankLocation('hall');

/**
 * The encounter cards of these tests. A name says what the card is; every
 * card has no other property than the one in its name (a plain treachery has
 * no keyword and does not stay in play).
 */
const foeCard = blankEnemy('foe');
const plainTreachery = blankTreachery('plain_treachery');
const surgeTreachery = blankTreachery('surge_treachery', { keywords: [{ name: 'surge' }] });
const surgeFoe = blankEnemy('surge_foe', { keywords: [{ name: 'surge' }] });
const perilTreachery = blankTreachery('peril_treachery', { keywords: [{ name: 'peril' }] });
const lingeringTreachery = blankTreachery('lingering_treachery', { entersThreatArea: true });
const onePerLocationAttachment = blankTreachery('one_per_location_attachment', {
  locationAttachment: { onePerLocation: true },
});
const relicCard = blankAsset('relic');

/** An encounter card to create: `card` as which card, `id` as how the test refers to it. */
interface EncounterCard {
  card: CardStats;
  id: InstanceId;
}

function card(definition: CardStats, id: string): EncounterCard {
  return { card: definition, id: instanceId(id) };
}

/** Where the cards of a test start; each list is top first. */
interface Cards {
  deck?: EncounterCard[];
  discard?: EncounterCard[];
  setAside?: EncounterCard[];
}

/** The hall, with alice standing in it. */
const aliceInHall = newGame()
  .withLocation(hall, hallCard)
  .withInvestigator(alice, { locationId: hall });

/** The hall, with alice at no location. */
const aliceNowhere = newGame().withLocation(hall, hallCard).withInvestigator(alice);

/** `table` with exactly the given cards, in the given order (the encounter deck is not shuffled by setup). */
function withCards(table: GameBuilder, { deck = [], discard = [], setAside = [] }: Cards) {
  return [
    ...deck.map((entry) => ({ ...entry, zone: encounterDeck })),
    ...discard.map((entry) => ({ ...entry, zone: encounterDiscard })),
    ...setAside.map((entry) => ({ ...entry, zone: setAsideZone })),
  ].reduce((built, { id, card, zone }) => built.withCard(id, card, zone), table);
}

/** `table` started with exactly the given cards and the card scripts in `effects`. */
function startedWith(table: GameBuilder, cards: Cards, effects?: EffectsRegistry): BuiltGame {
  const { context, state } = withCards(table, cards).start();
  return { context: effects ? { ...context, effects } : context, state };
}

/** Like `startedWith(aliceInHall, cards)`, but with `seed` for the shuffles. */
function startedWithSeed(cards: Cards, seed: number): BuiltGame {
  const table = withCards(aliceInHall, cards);
  const context = table.context();
  return {
    context,
    state: execute(context, emptyState(), { ...table.startCommand(), seed }).state,
  };
}

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

/** Instance IDs in a zone, top first. */
function idsIn(state: GameState, zone: Zone): string[] {
  return state.order[zoneKey(zone)] ?? [];
}

describe('DrawEncounter', () => {
  it('reveals the top card and discards a plain treachery on top of the discard', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'top_card'), card(foeCard, 'second_card')],
      discard: [card(relicCard, 'old_discard')],
    });

    const { state: after, events } = execute(context, state, draw);

    expect(events.map((e) => e.type)).toEqual([
      'EncounterCardDrawn',
      'CardMoved',
      'CardFlipped',
      'CardMoved',
    ]);
    expect(after.cards[instanceId('top_card')]).toMatchObject({
      faceUp: true,
      zone: encounterDiscard,
    });
    expect(idsIn(after, encounterDiscard)).toEqual(['top_card', 'old_discard']);
    expect(idsIn(after, encounterDeck)).toEqual(['second_card']);
  });

  it('spawns an enemy at the drawing investigator`s location and engages them', () => {
    const { context, state } = startedWith(aliceInHall, { deck: [card(foeCard, 'drawn_foe')] });

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('drawn_foe')]?.zone).toEqual(engagedWith(alice));
  });

  it('puts a treachery that stays in play into the threat area', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(lingeringTreachery, 'lingering_card')],
    });

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('lingering_card')]?.zone).toEqual(threatAreaOf(alice));
  });

  describe('a treachery that attaches to the location, limit 1 per location', () => {
    it('attaches to the drawing investigator`s location', () => {
      const { context, state } = startedWith(aliceInHall, {
        deck: [card(onePerLocationAttachment, 'fog_card')],
      });

      const after = stateAfter(context, state, draw);

      expect(idsIn(after, attachedTo(hall))).toEqual(['fog_card']);
    });

    it('is discarded while another copy is attached there', () => {
      const { context, state } = startedWith(aliceInHall, {
        deck: [
          card(onePerLocationAttachment, 'first_fog'),
          card(onePerLocationAttachment, 'second_fog'),
          // Keeps the deck from running out, which would shuffle the discard back.
          card(plainTreachery, 'bottom_card'),
        ],
      });

      const after = stateAfter(context, stateAfter(context, state, draw), draw);

      expect(idsIn(after, attachedTo(hall))).toEqual(['first_fog']);
      expect(idsIn(after, encounterDiscard)).toEqual(['second_fog']);
    });

    it('is discarded when the drawer is at no location', () => {
      const { context, state } = startedWith(aliceNowhere, {
        deck: [
          card(onePerLocationAttachment, 'fog_card'),
          // Keeps the deck from running out, which would shuffle the discard back.
          card(plainTreachery, 'bottom_card'),
        ],
      });

      const after = stateAfter(context, state, draw);

      expect(idsIn(after, encounterDiscard)).toEqual(['fog_card']);
    });
  });

  it('discards a card that is neither enemy nor treachery', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(relicCard, 'drawn_relic'), card(plainTreachery, 'second_card')],
    });

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('drawn_relic')]?.zone).toEqual(encounterDiscard);
  });

  it('records peril on the draw', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(perilTreachery, 'peril_card')],
    });

    const { events } = execute(context, state, draw);

    expect(events[0]).toMatchObject({
      type: 'EncounterCardDrawn',
      cardId: 'peril_card',
      peril: true,
      surge: false,
    });
  });

  it('draws again after a surge card', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [
        card(surgeTreachery, 'surge_card'),
        card(plainTreachery, 'after_surge'),
        card(foeCard, 'untouched_foe'),
      ],
    });

    const { state: after, events } = execute(context, state, draw);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['surge_card', 'after_surge']);
    expect(idsIn(after, encounterDeck)).toEqual(['untouched_foe']);
  });

  it('stops drawing when every encounter card has surge', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(surgeTreachery, 'first_surge'), card(surgeTreachery, 'second_surge')],
    });

    const { events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
  });

  it('stops a surge when no card is left to draw', () => {
    const { context, state } = startedWith(aliceInHall, { deck: [card(surgeFoe, 'last_card')] });

    const { events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(1);
  });

  it('reshuffles the discard as soon as the last card has left the deck', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'last_deck_card')],
      discard: [card(foeCard, 'discarded_foe')],
    });

    const { state: after, events } = execute(context, state, draw);

    expect(events.map((e) => e.type)).toEqual([
      'EncounterCardDrawn',
      'CardMoved',
      'CardFlipped',
      'CardMoved',
      'CardMoved',
      'CardMoved',
      'DeckShuffled',
    ]);
    expect([...idsIn(after, encounterDeck)].sort()).toEqual(['discarded_foe', 'last_deck_card']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('reshuffles the discard when the last card of the deck is an enemy that stays in play', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(foeCard, 'last_deck_foe')],
      discard: [card(plainTreachery, 'discarded_treachery')],
    });

    const after = stateAfter(context, state, draw);

    expect(idsIn(after, encounterDeck)).toEqual(['discarded_treachery']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('does not shuffle when the deck runs out with an empty discard', () => {
    const { context, state } = startedWith(aliceInHall, { deck: [card(foeCard, 'last_deck_foe')] });

    const { events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toEqual([]);
  });

  it('reshuffles the discard into a deck that was already empty before drawing', () => {
    const { context, state } = startedWith(aliceInHall, {
      discard: [
        card(plainTreachery, 'discard_one'),
        card(plainTreachery, 'discard_two'),
        card(plainTreachery, 'discard_three'),
      ],
    });

    const { state: after, events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toHaveLength(1);
    expect(idsIn(after, encounterDeck)).toHaveLength(2);
    expect(idsIn(after, encounterDiscard)).toHaveLength(1);
  });

  describe('reshuffling with a seed', () => {
    const discard = [
      card(plainTreachery, 'plain_a'),
      card(foeCard, 'foe_a'),
      card(relicCard, 'relic_a'),
      card(perilTreachery, 'peril_a'),
      card(lingeringTreachery, 'lingering_a'),
      card(plainTreachery, 'plain_b'),
      card(foeCard, 'foe_b'),
      card(relicCard, 'relic_b'),
    ];

    it('reshuffles the same way for the same seed and differently across seeds', () => {
      const seeded = (seed: number) => {
        const { context, state } = startedWithSeed({ discard }, seed);
        return idsIn(stateAfter(context, state, draw), encounterDeck);
      };

      expect(seeded(7)).toEqual(seeded(7));
      expect(seeded(8)).not.toEqual(seeded(7));
    });
  });

  it('reshuffles a surge card that was just discarded before the surge draw', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(surgeTreachery, 'surge_card')],
      discard: [card(plainTreachery, 'discarded_treachery')],
    });

    const { state: after, events } = execute(context, state, draw);

    const types = events.map((e) => e.type);
    const shuffled = events.find((e) => e.type === 'DeckShuffled');
    expect(types.indexOf('DeckShuffled')).toBeLessThan(types.lastIndexOf('EncounterCardDrawn'));
    expect(shuffled?.type === 'DeckShuffled' && [...shuffled.order].sort()).toEqual([
      'discarded_treachery',
      'surge_card',
    ]);
    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('rejects a draw when the deck and the discard are empty', () => {
    const { context, state } = startedWith(aliceInHall, {});

    expect(rejectionFrom(context, state, draw)).toEqual({ code: 'encounterDeckEmpty' });
  });

  it('rejects an enemy draw for an investigator without a location', () => {
    const { context, state } = startedWith(aliceNowhere, { deck: [card(foeCard, 'drawn_foe')] });

    expect(rejectionFrom(context, state, draw)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });

  it('rejects a draw for an unknown investigator', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'top_card')],
    });
    const command: Command = { type: 'DrawEncounter', investigatorId: investigatorId('nobody') };

    expect(rejectionFrom(context, state, command).code).toBe('unknownInvestigator');
  });

  it('feeds onCardEnters when an enemy enters play, but not for a discarded treachery', () => {
    const hooks: Partial<ScenarioHooks> = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };
    const enemyDeck = startedWith(aliceInHall, { deck: [card(foeCard, 'drawn_foe')] });
    const treacheryDeck = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'drawn_treachery')],
    });

    const enemy = stateAfter(withScenario(enemyDeck.context, { hooks }), enemyDeck.state, draw);
    const treachery = stateAfter(
      withScenario(treacheryDeck.context, { hooks }),
      treacheryDeck.state,
      draw,
    );

    expect(enemy.cards[instanceId('drawn_foe')]?.tokens.doom).toBe(1);
    expect(treachery.cards[instanceId('drawn_treachery')]?.tokens.doom).toBeUndefined();
  });
});

describe('DrawEncounter with a match', () => {
  const ghoulFoe = blankEnemy('ghoul_foe', { name: 'Ghoul Minion', traits: [trait('Ghoul')] });
  const otherFoe = blankEnemy('other_foe', { name: 'Other Foe', traits: [trait('Monster')] });
  const ghoulTreachery = blankTreachery('ghoul_treachery', { traits: [trait('Ghoul')] });
  const surgeGhoulFoe = blankEnemy('surge_ghoul_foe', {
    traits: [trait('Ghoul')],
    keywords: [{ name: 'surge' }],
  });
  const drawGhoulEnemy: Command = {
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { trait: trait('Ghoul'), typeCode: 'enemy' },
  };

  it('takes the first matching card of the deck and leaves the cards above it', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [
        card(plainTreachery, 'top_card'),
        card(ghoulFoe, 'first_ghoul'),
        card(ghoulFoe, 'second_ghoul'),
      ],
    });

    const after = stateAfter(context, state, drawGhoulEnemy);

    expect(after.cards[instanceId('first_ghoul')]).toMatchObject({
      faceUp: true,
      zone: engagedWith(alice),
    });
    expect(idsIn(after, encounterDeck)).toEqual(['top_card', 'second_ghoul']);
  });

  it('discards the cards above the match first when asked to', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [
        card(plainTreachery, 'skipped_treachery'),
        card(otherFoe, 'skipped_foe'),
        card(ghoulFoe, 'drawn_ghoul'),
        card(plainTreachery, 'below_ghoul'),
      ],
      discard: [card(plainTreachery, 'old_discard')],
    });

    const after = stateAfter(context, state, { ...drawGhoulEnemy, discardSkipped: true });

    expect(idsIn(after, encounterDiscard)).toEqual([
      'skipped_foe',
      'skipped_treachery',
      'old_discard',
    ]);
    expect(idsIn(after, encounterDeck)).toEqual(['below_ghoul']);
    expect(after.cards[instanceId('drawn_ghoul')]?.zone).toEqual(engagedWith(alice));
  });

  it('takes the topmost matching card from the discard when drawing from the discard', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(ghoulFoe, 'ghoul_in_deck'), card(plainTreachery, 'deck_filler')],
      discard: [
        card(plainTreachery, 'discarded_treachery'),
        card(ghoulFoe, 'upper_discarded_ghoul'),
        card(ghoulFoe, 'lower_discarded_ghoul'),
      ],
    });

    const after = stateAfter(context, state, { ...drawGhoulEnemy, from: 'discard' });

    expect(after.cards[instanceId('upper_discarded_ghoul')]?.zone).toEqual(engagedWith(alice));
    expect(idsIn(after, encounterDiscard)).toEqual([
      'discarded_treachery',
      'lower_discarded_ghoul',
    ]);
    expect(idsIn(after, encounterDeck)).toEqual(['ghoul_in_deck', 'deck_filler']);
  });

  it('searches the deck before the discard when drawing from either', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(ghoulFoe, 'ghoul_in_deck'), card(plainTreachery, 'deck_filler')],
      discard: [card(ghoulFoe, 'ghoul_in_discard')],
    });

    const after = stateAfter(context, state, { ...drawGhoulEnemy, from: 'deckOrDiscard' });

    expect(after.cards[instanceId('ghoul_in_deck')]?.zone).toEqual(engagedWith(alice));
    expect(after.cards[instanceId('ghoul_in_discard')]?.zone).toEqual(encounterDiscard);
  });

  it('finds a card that is only in the discard when drawing from either', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'deck_filler'), card(plainTreachery, 'second_filler')],
      discard: [card(ghoulFoe, 'ghoul_in_discard')],
    });

    const after = stateAfter(context, state, { ...drawGhoulEnemy, from: 'deckOrDiscard' });

    expect(after.cards[instanceId('ghoul_in_discard')]?.zone).toEqual(engagedWith(alice));
  });

  it('matches by name', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(ghoulFoe, 'ghoul_minion'), card(otherFoe, 'other_foe_card')],
    });

    const after = stateAfter(context, state, {
      type: 'DrawEncounter',
      investigatorId: alice,
      match: { name: 'Other Foe' },
    });

    expect(after.cards[instanceId('other_foe_card')]?.zone).toEqual(engagedWith(alice));
    expect(idsIn(after, encounterDeck)).toEqual(['ghoul_minion']);
  });

  it('requires every given field to match', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(ghoulTreachery, 'ghoul_treachery_card')],
    });

    expect(rejectionFrom(context, state, drawGhoulEnemy)).toEqual({
      code: 'noMatchingCard',
      from: 'deck',
      match: drawGhoulEnemy.match,
    });
  });

  it('does not look in the discard unless told to', () => {
    const { context, state } = startedWith(aliceInHall, {
      discard: [card(ghoulFoe, 'ghoul_in_discard')],
    });

    expect(rejectionFrom(context, state, drawGhoulEnemy).code).toBe('noMatchingCard');
  });

  it('changes nothing when it rejects, even when asked to discard the cards above', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'top_card')],
    });

    const rejection = rejectionFrom(context, state, { ...drawGhoulEnemy, discardSkipped: true });

    expect(rejection.code).toBe('noMatchingCard');
    expect(idsIn(state, encounterDeck)).toEqual(['top_card']);
  });

  it('draws again from the top after a matched card with surge', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'top_card'), card(surgeGhoulFoe, 'surging_ghoul')],
      discard: [card(plainTreachery, 'old_discard')],
    });

    const { state: after, events } = execute(context, state, drawGhoulEnemy);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['surging_ghoul', 'top_card']);
    expect(after.cards[instanceId('surging_ghoul')]?.zone).toEqual(engagedWith(alice));
  });

  it('reshuffles the discard when the matched card was the last one in the deck', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(ghoulFoe, 'last_deck_ghoul')],
      discard: [card(plainTreachery, 'discarded_treachery')],
    });

    const after = stateAfter(context, state, drawGhoulEnemy);

    expect(idsIn(after, encounterDeck)).toEqual(['discarded_treachery']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('feeds onCardEnters for an enemy drawn from the discard', () => {
    const hooks: Partial<ScenarioHooks> = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };
    const { context, state } = startedWith(aliceInHall, {
      discard: [card(ghoulFoe, 'discarded_ghoul')],
    });

    const after = stateAfter(withScenario(context, { hooks }), state, {
      ...drawGhoulEnemy,
      from: 'discard',
    });

    expect(after.cards[instanceId('discarded_ghoul')]?.tokens.doom).toBe(1);
  });
});

describe('FromSetAside', () => {
  it('moves one copy per listed code, taking two copies for a code listed twice', () => {
    const { context, state } = startedWith(aliceInHall, {
      setAside: [
        card(foeCard, 'first_foe'),
        card(plainTreachery, 'set_aside_treachery'),
        card(foeCard, 'second_foe'),
      ],
    });

    const after = stateAfter(context, state, {
      type: 'FromSetAside',
      codes: [foeCard.code, foeCard.code],
      to: { kind: 'victoryDisplay' },
    });

    expect(idsIn(after, { kind: 'victoryDisplay' })).toEqual(['first_foe', 'second_foe']);
    expect(idsIn(after, setAsideZone)).toEqual(['set_aside_treachery']);
  });

  it('rejects a code with no set-aside copy left', () => {
    const { context, state } = startedWith(aliceInHall, { setAside: [card(foeCard, 'only_foe')] });

    expect(
      rejectionFrom(context, state, {
        type: 'FromSetAside',
        codes: [foeCard.code, foeCard.code],
        to: { kind: 'outOfGame' },
      }),
    ).toEqual({ code: 'cardNotInZone', zone: 'setAside', match: 'foe' });
  });

  it('feeds onCardEnters when the card goes into play', () => {
    const hooks: Partial<ScenarioHooks> = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 2 },
      ],
    };
    const { context, state } = startedWith(aliceInHall, {
      setAside: [card(foeCard, 'set_aside_foe')],
    });

    const after = stateAfter(withScenario(context, { hooks }), state, {
      type: 'FromSetAside',
      codes: [foeCard.code],
      to: { kind: 'atLocation', locationId: hall },
    });

    expect(after.cards[instanceId('set_aside_foe')]?.tokens.doom).toBe(2);
  });
});

describe('ShuffleInto', () => {
  it('adds the set-aside cards to the deck and shuffles all of it', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [
        card(plainTreachery, 'deck_card_a'),
        card(plainTreachery, 'deck_card_b'),
        card(plainTreachery, 'deck_card_c'),
      ],
      setAside: [card(foeCard, 'set_aside_foe'), card(relicCard, 'set_aside_relic')],
    });

    const { state: after, events } = execute(context, state, {
      type: 'ShuffleInto',
      codes: [foeCard.code, relicCard.code],
      zone: encounterDeck,
    });

    expect(events.at(-1)?.type).toBe('DeckShuffled');
    expect([...idsIn(after, encounterDeck)].sort()).toEqual([
      'deck_card_a',
      'deck_card_b',
      'deck_card_c',
      'set_aside_foe',
      'set_aside_relic',
    ]);
    expect(idsIn(after, setAsideZone)).toEqual([]);
  });

  it('rejects a code that is not set aside', () => {
    const { context, state } = startedWith(aliceInHall, { deck: [card(foeCard, 'deck_foe')] });

    expect(
      rejectionFrom(context, state, {
        type: 'ShuffleInto',
        codes: [foeCard.code],
        zone: encounterDeck,
      }).code,
    ).toBe('cardNotInZone');
  });
});

describe('ShuffleEncounterDiscard', () => {
  const shuffleDiscard: Command = { type: 'ShuffleEncounterDiscard' };

  it('moves the whole discard into the deck and shuffles all of it', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'deck_card')],
      discard: [card(foeCard, 'discarded_foe'), card(plainTreachery, 'discarded_treachery')],
    });

    const { state: after, events } = execute(context, state, shuffleDiscard);

    expect(events.at(-1)?.type).toBe('DeckShuffled');
    expect([...idsIn(after, encounterDeck)].sort()).toEqual([
      'deck_card',
      'discarded_foe',
      'discarded_treachery',
    ]);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('leaves the deck in its order when the discard is empty', () => {
    const { context, state } = startedWith(aliceInHall, {
      deck: [card(plainTreachery, 'deck_card_a'), card(foeCard, 'deck_card_b')],
    });

    const { events } = execute(context, state, shuffleDiscard);

    expect(events).toEqual([]);
  });
});

describe('encounter deck invariants', () => {
  const shuffleIn = (shuffled: CardStats): Command => ({
    type: 'ShuffleInto',
    codes: [shuffled.code],
    zone: encounterDeck,
  });

  it.each([
    {
      name: 'plain draws',
      cards: {
        deck: [
          card(plainTreachery, 'plain_card'),
          card(foeCard, 'foe_card'),
          card(lingeringTreachery, 'lingering_card'),
        ],
      },
      steps: [draw, draw, draw],
    },
    {
      name: 'draws through a reshuffle',
      cards: {
        deck: [card(plainTreachery, 'last_deck_card')],
        discard: [
          card(foeCard, 'discarded_foe'),
          card(relicCard, 'discarded_relic'),
          card(perilTreachery, 'discarded_peril'),
        ],
      },
      steps: [draw, draw, draw, draw, draw],
    },
    {
      name: 'a surge chain',
      cards: {
        deck: [
          card(surgeTreachery, 'surge_treachery_card'),
          card(surgeFoe, 'surge_foe_card'),
          card(plainTreachery, 'plain_card'),
        ],
        discard: [card(foeCard, 'discarded_foe')],
      },
      steps: [draw, draw],
    },
    {
      name: 'only surge cards',
      cards: {
        deck: [card(surgeTreachery, 'surge_treachery_card'), card(surgeTreachery, 'other_surge')],
        discard: [card(surgeFoe, 'discarded_surge_foe')],
      },
      steps: [draw, draw],
    },
    {
      name: 'cards shuffled in between draws',
      cards: {
        deck: [card(plainTreachery, 'plain_card')],
        setAside: [card(foeCard, 'set_aside_foe'), card(lingeringTreachery, 'set_aside_lingering')],
      },
      steps: [draw, shuffleIn(foeCard), draw, shuffleIn(lingeringTreachery), draw, draw],
    },
    { name: 'a draw from nothing', cards: {}, steps: [draw] },
  ])(
    'keeps every card in exactly one zone and the card count constant: $name',
    ({ cards, steps }) => {
      const { context, state: started } = startedWith(aliceInHall, cards);
      let state = started;
      const cardCount = Object.keys(state.cards).length;

      for (const step of steps) {
        try {
          state = stateAfter(context, state, step);
        } catch (error) {
          // A rejected step leaves the state unchanged, which the checks below still cover.
          if (!(error instanceof CommandRejected)) throw error;
        }

        const placed = Object.values(state.order).reduce((sum, ids) => sum + ids.length, 0);
        expect(checkInvariants(state)).toEqual([]);
        expect(Object.keys(state.cards)).toHaveLength(cardCount);
        expect(placed).toBe(cardCount);
      }
    },
  );

  it.each([
    {
      name: 'one plain card in the deck, a foe in the discard',
      cards: {
        deck: [card(plainTreachery, 'deck_card')],
        discard: [card(foeCard, 'discarded_foe')],
      },
    },
    {
      name: 'a foe in the deck, two plain cards in the discard',
      cards: {
        deck: [card(foeCard, 'deck_foe')],
        discard: [card(plainTreachery, 'discard_a'), card(plainTreachery, 'discard_b')],
      },
    },
    {
      name: 'a lingering treachery in the deck, a relic in the discard',
      cards: {
        deck: [card(lingeringTreachery, 'deck_lingering')],
        discard: [card(relicCard, 'discarded_relic')],
      },
    },
    {
      name: 'an empty deck, three cards in the discard',
      cards: {
        discard: [
          card(plainTreachery, 'discarded_treachery'),
          card(foeCard, 'discarded_foe'),
          card(relicCard, 'discarded_relic'),
        ],
      },
    },
    {
      name: 'a surge card in the deck, a peril card in the discard',
      cards: {
        deck: [card(surgeTreachery, 'deck_surge')],
        discard: [card(perilTreachery, 'discarded_peril')],
      },
    },
    {
      name: 'two plain cards in the deck, an empty discard',
      cards: { deck: [card(plainTreachery, 'deck_a'), card(plainTreachery, 'deck_b')] },
    },
  ])('never leaves the deck empty while the discard has cards: $name', ({ cards }) => {
    for (const seed of [1, 2, 3]) {
      const { context, state } = startedWithSeed(cards, seed);
      const after = stateAfter(context, state, draw);

      const deckSize = idsIn(after, encounterDeck).length;
      const discardSize = idsIn(after, encounterDiscard).length;
      expect(deckSize === 0 && discardSize > 0).toBe(false);
    }
  });
});

describe('surge after the drawn card has resolved', () => {
  const aliceDrawsAgain: Command = { type: 'DrawEncounter', investigatorId: alice };

  /**
   * The plain treachery above plus four surge cards: `burning_surge`, whose script
   * deals alice 1 damage when it is revealed; `testing_surge`, which asks
   * for a willpower (3) test; `deadly_surge`, whose script asks alice to
   * confirm 8 damage (her whole health); and `choosy_foe`, an enemy whose
   * spawn text the engine cannot read, so the players choose its location.
   */
  const burningSurge = blankTreachery('burning_surge', { keywords: [{ name: 'surge' }] });
  const testingSurge = blankTreachery('testing_surge', {
    keywords: [{ name: 'surge' }],
    revelationTest: { skill: 'willpower', difficulty: 3 },
  });
  const deadlySurge = blankTreachery('deadly_surge', { keywords: [{ name: 'surge' }] });
  const choosyFoe = blankEnemy('choosy_foe', {
    keywords: [{ name: 'surge' }, { name: 'spawn', detail: 'the location with the most clues' }],
  });
  const surgeEffects: EffectsRegistry = {
    [burningSurge.code]: {
      onReveal: () => [
        { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 1 },
      ],
    },
    [deadlySurge.code]: {
      onReveal: () => [
        {
          type: 'RequestDecision',
          decision: {
            id: decisionId('deadly'),
            kind: 'confirm',
            prompt: 'decision.deadly',
            decider: { kind: 'investigator', investigatorId: alice },
            options: confirmOptions([
              { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 8 },
            ]),
          },
        },
      ],
    },
  };

  /**
   * What happened, in order, as far as these tests look: draws, damage,
   * drawn cards discarded after resolving, engagements, dropped draws.
   */
  function resolutionOrder(events: readonly Event[]): string[] {
    return events.flatMap((e) => {
      switch (e.type) {
        case 'EncounterCardDrawn':
          return [`draws ${e.cardId}`];
        case 'InvestigatorChanged':
          return [`alice ${e.stat} +${e.delta}`];
        case 'CardMoved':
          return e.from.kind === 'resolving' && e.to.kind === 'encounterDiscard'
            ? [`discards ${e.cardId}`]
            : [];
        case 'EnemyEngaged':
          return [`${e.enemyId} engages ${e.investigatorId}`];
        case 'ActionDropped':
          return [`drops ${e.command.type} (${e.reason.code})`];
        default:
          return [];
      }
    });
  }

  it('resolves the revealed card`s effect before the surge draw', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(burningSurge, 'burning_card'), card(plainTreachery, 'after_surge')] },
      surgeEffects,
    );

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual([
      'draws burning_card',
      'alice damage +1',
      'discards burning_card',
      'draws after_surge',
      'discards after_surge',
    ]);
  });

  it('holds the surge draw while the card`s revelation test waits for its result', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(testingSurge, 'testing_card'), card(plainTreachery, 'after_surge')] },
      surgeEffects,
    );

    const asked = stateAfter(context, state, draw);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['revelation:testing_card']);
    expect(asked.meta.heldAction).toEqual(aliceDrawsAgain);
    expect(idsIn(asked, encounterDeck)).toEqual(['after_surge']);
  });

  it('draws the surge card once the test is answered and the card discarded', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(testingSurge, 'testing_card'), card(plainTreachery, 'after_surge')] },
      surgeEffects,
    );
    const asked = stateAfter(context, state, draw);

    const { state: answered, events } = execute(context, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('revelation:testing_card'),
      optionId: 'fail',
    });

    expect(resolutionOrder(events)).toEqual([
      'discards testing_card',
      'draws after_surge',
      'discards after_surge',
    ]);
    expect(answered.meta.heldAction).toBeUndefined();
  });

  it('holds no surge draw when the surging card was the last one', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(testingSurge, 'testing_card')] },
      surgeEffects,
    );

    const asked = stateAfter(context, state, draw);

    expect(asked.meta.heldAction).toBeUndefined();
  });

  it('drops the held surge draw when the card`s effect defeated alice', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(deadlySurge, 'deadly_card'), card(plainTreachery, 'after_surge')] },
      surgeEffects,
    );
    const asked = stateAfter(context, state, draw);

    const { events } = execute(context, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('deadly'),
      optionId: 'yes',
    });

    expect(asked.meta.heldAction).toEqual(aliceDrawsAgain);
    expect(resolutionOrder(events)).toEqual([
      'alice damage +8',
      'drops DrawEncounter (investigatorNotActive)',
    ]);
  });

  it('draws the surge card only after the players chose where the enemy spawns', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(choosyFoe, 'choosy_card'), card(plainTreachery, 'after_surge')] },
      surgeEffects,
    );
    const asked = stateAfter(context, state, draw);

    const { events } = execute(context, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('spawn:choosy_card'),
      optionId: hall,
    });

    expect(asked.meta.heldAction).toEqual(aliceDrawsAgain);
    expect(resolutionOrder(events)).toEqual([
      'choosy_card engages alice',
      'draws after_surge',
      'discards after_surge',
    ]);
  });
});

describe('revelation before the drawn card is placed', () => {
  const hurtAlice = (delta: number): Command => ({
    type: 'AdjustInvestigator',
    investigatorId: alice,
    stat: 'damage',
    delta,
  });

  /**
   * Every card here has a revelation script. `scorching_*` cards deal alice 1
   * damage; `lethal_*` cards deal her 8 (her whole health);
   * `vanishing_treachery` sets itself aside. `lethal_hall_foe` spawns at
   * the Hall.
   */
  const scorchingTreachery = blankTreachery('scorching_treachery');
  const scorchingFoe = blankEnemy('scorching_foe');
  const scorchingLingering = blankTreachery('scorching_lingering', { entersThreatArea: true });
  const scorchingAttachment = blankTreachery('scorching_attachment', {
    locationAttachment: { onePerLocation: true },
  });
  const lethalTreachery = blankTreachery('lethal_treachery');
  const lethalFoe = blankEnemy('lethal_foe');
  const lethalHallFoe = blankEnemy('lethal_hall_foe', {
    keywords: [{ name: 'spawn', detail: 'hall' }],
  });
  const vanishingTreachery = blankTreachery('vanishing_treachery');
  const revelationEffects: EffectsRegistry = {
    [scorchingTreachery.code]: { onReveal: () => [hurtAlice(1)] },
    [scorchingFoe.code]: { onReveal: () => [hurtAlice(1)] },
    [scorchingLingering.code]: { onReveal: () => [hurtAlice(1)] },
    [scorchingAttachment.code]: { onReveal: () => [hurtAlice(1)] },
    [lethalTreachery.code]: { onReveal: () => [hurtAlice(8)] },
    [lethalFoe.code]: { onReveal: () => [hurtAlice(8)] },
    [lethalHallFoe.code]: { onReveal: () => [hurtAlice(8)] },
    [vanishingTreachery.code]: {
      onReveal: (_ctx, _state, event) => [
        { type: 'MoveCard', cardId: event.cardId, to: { kind: 'setAside' } },
      ],
    },
  };

  /** What happened, in order: draws, damage, and where the drawn card went. */
  function resolutionOrder(events: readonly Event[]): string[] {
    return events.flatMap((e) => {
      switch (e.type) {
        case 'EncounterCardDrawn':
          return [`draws ${e.cardId}`];
        case 'InvestigatorChanged':
          return [`alice ${e.stat} +${e.delta}`];
        case 'CardMoved':
          return e.from.kind === 'resolving' ? [`${e.cardId} to ${e.to.kind}`] : [];
        default:
          return [];
      }
    });
  }

  it.each([
    { drawn: scorchingTreachery, placed: 'drawn_card to encounterDiscard' },
    { drawn: scorchingFoe, placed: 'drawn_card to atLocation' },
    { drawn: scorchingLingering, placed: 'drawn_card to threatArea' },
    { drawn: scorchingAttachment, placed: 'drawn_card to attachedTo' },
  ])('resolves the revelation of $drawn.code before placing it', ({ drawn, placed }) => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(drawn, 'drawn_card'), card(scorchingTreachery, 'next_card')] },
      revelationEffects,
    );

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual(['draws drawn_card', 'alice damage +1', placed]);
  });

  it('keeps the card in the resolving zone while its revelation resolves', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(scorchingFoe, 'drawn_foe')] },
      revelationEffects,
    );

    const { events } = execute(context, state, draw);

    const revelationAt = events.findIndex((e) => e.type === 'InvestigatorChanged');
    const beforeRevelation = replay(events.slice(0, revelationAt), state);
    expect(beforeRevelation.cards[instanceId('drawn_foe')]?.zone).toEqual({ kind: 'resolving' });
  });

  it('does not place a card its revelation has already moved', () => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(vanishingTreachery, 'vanishing_card')] },
      revelationEffects,
    );

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('vanishing_card')]?.zone).toEqual(setAsideZone);
  });

  it.each([
    { drawn: lethalTreachery, placed: 'lethal_card to encounterDiscard' },
    { drawn: lethalFoe, placed: 'lethal_card to encounterDiscard' },
    { drawn: lethalHallFoe, placed: 'lethal_card to atLocation' },
  ])('places $drawn.code without the drawer it defeated: $placed', ({ drawn, placed }) => {
    const { context, state } = startedWith(
      aliceInHall,
      { deck: [card(drawn, 'lethal_card'), card(scorchingFoe, 'next_foe')] },
      revelationEffects,
    );

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual(['draws lethal_card', 'alice damage +8', placed]);
  });
});
