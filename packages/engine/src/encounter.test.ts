import { describe, expect, it } from 'vitest';
import {
  cardCode,
  checkInvariants,
  CommandRejected,
  confirmOptions,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  replay,
  trait,
  zoneKey,
  type Command,
  type EngineContext,
  type Event,
  type GameState,
  type InstanceId,
  type StartingCard,
  type Zone,
  type ScenarioHooks,
} from './index';
import {
  contextWith,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
  withScenario,
} from '../test/utils';

const hall = instanceId('hall');
const alice = investigatorId('alice');
const encounterDeck: Zone = { kind: 'encounterDeck' };
const encounterDiscard: Zone = { kind: 'encounterDiscard' };
const engagedWithAlice: Zone = { kind: 'engaged', investigatorId: alice };

/**
 * The encounter cards of these tests. A code says what the card is; every
 * card has no other property than the one in its name (a plain treachery has
 * no keyword and does not stay in play).
 */
const ctx = contextWith(
  makeCard({ code: 'hall_location', typeCode: 'location' }),
  makeCard({ code: 'foe', typeCode: 'enemy' }),
  makeCard({ code: 'plain_treachery', typeCode: 'treachery' }),
  makeCard({ code: 'surge_treachery', typeCode: 'treachery', keywords: [{ name: 'surge' }] }),
  makeCard({ code: 'surge_foe', typeCode: 'enemy', keywords: [{ name: 'surge' }] }),
  makeCard({ code: 'peril_treachery', typeCode: 'treachery', keywords: [{ name: 'peril' }] }),
  makeCard({ code: 'lingering_treachery', typeCode: 'treachery', entersThreatArea: true }),
  makeCard({
    code: 'one_per_location_attachment',
    typeCode: 'treachery',
    locationAttachment: { onePerLocation: true },
  }),
  makeCard({ code: 'relic', typeCode: 'asset' }),
);

/** A card to create: `code` as which kind of card, `id` as how the test refers to it. */
function card(code: string, id: string): { code: string; id: InstanceId } {
  return { code, id: instanceId(id) };
}

/** Where the cards of a test start; each list is top first. */
interface Cards {
  deck?: { code: string; id: InstanceId }[];
  discard?: { code: string; id: InstanceId }[];
  setAside?: { code: string; id: InstanceId }[];
}

/**
 * A started scenario with one map holding the `hall` location, alice standing
 * at `aliceAt` (or nowhere) and exactly the given cards, in the given order
 * (the encounter deck is not shuffled by setup).
 */
function startedWith(
  { deck = [], discard = [], setAside = [] }: Cards,
  { aliceAt, seed = 1 }: { aliceAt: InstanceId | undefined; seed?: number },
  context: EngineContext = ctx,
): GameState {
  const inZone = (cards: { code: string; id: InstanceId }[], zone: Zone): StartingCard[] =>
    cards.map(({ code, id }) => ({ code: cardCode(code), id, zone }));
  return startBoard(context, {
    maps: { main: { locations: { hall: 'hall_location' } } },
    investigators: [
      makeInvestigator({ id: 'alice', seat: 1, ...(aliceAt ? { locationId: aliceAt } : {}) }),
    ],
    cards: [
      ...inZone(deck, encounterDeck),
      ...inZone(discard, encounterDiscard),
      ...inZone(setAside, { kind: 'setAside' }),
    ],
    seed,
    shuffleEncounterDeck: false,
  });
}

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

/** Instance IDs in a zone, top first. */
function idsIn(state: GameState, zone: Zone): string[] {
  return state.order[zoneKey(zone)] ?? [];
}

describe('DrawEncounter', () => {
  it('reveals the top card and discards a plain treachery on top of the discard', () => {
    const state = startedWith(
      {
        deck: [card('plain_treachery', 'top_card'), card('foe', 'second_card')],
        discard: [card('relic', 'old_discard')],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, draw);

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
    const state = startedWith({ deck: [card('foe', 'drawn_foe')] }, { aliceAt: hall });

    const after = stateAfter(ctx, state, draw);

    expect(after.cards[instanceId('drawn_foe')]?.zone).toEqual({
      kind: 'engaged',
      investigatorId: alice,
    });
  });

  it('puts a treachery that stays in play into the threat area', () => {
    const state = startedWith(
      { deck: [card('lingering_treachery', 'lingering_card')] },
      { aliceAt: hall },
    );

    const after = stateAfter(ctx, state, draw);

    expect(after.cards[instanceId('lingering_card')]?.zone).toEqual({
      kind: 'threatArea',
      investigatorId: alice,
    });
  });

  describe('a treachery that attaches to the location, limit 1 per location', () => {
    const attachedToHall: Zone = { kind: 'attachedTo', hostId: hall };

    it('attaches to the drawing investigator`s location', () => {
      const state = startedWith(
        { deck: [card('one_per_location_attachment', 'fog_card')] },
        { aliceAt: hall },
      );

      const after = stateAfter(ctx, state, draw);

      expect(idsIn(after, attachedToHall)).toEqual(['fog_card']);
    });

    it('is discarded while another copy is attached there', () => {
      const state = startedWith(
        {
          deck: [
            card('one_per_location_attachment', 'first_fog'),
            card('one_per_location_attachment', 'second_fog'),
            // Keeps the deck from running out, which would shuffle the discard back.
            card('plain_treachery', 'bottom_card'),
          ],
        },
        { aliceAt: hall },
      );

      const after = stateAfter(ctx, stateAfter(ctx, state, draw), draw);

      expect(idsIn(after, attachedToHall)).toEqual(['first_fog']);
      expect(idsIn(after, encounterDiscard)).toEqual(['second_fog']);
    });

    it('is discarded when the drawer is at no location', () => {
      const state = startedWith(
        {
          deck: [
            card('one_per_location_attachment', 'fog_card'),
            // Keeps the deck from running out, which would shuffle the discard back.
            card('plain_treachery', 'bottom_card'),
          ],
        },
        { aliceAt: undefined },
      );

      const after = stateAfter(ctx, state, draw);

      expect(idsIn(after, encounterDiscard)).toEqual(['fog_card']);
    });
  });

  it('discards a card that is neither enemy nor treachery', () => {
    const state = startedWith(
      { deck: [card('relic', 'drawn_relic'), card('plain_treachery', 'second_card')] },
      { aliceAt: hall },
    );

    const after = stateAfter(ctx, state, draw);

    expect(after.cards[instanceId('drawn_relic')]?.zone).toEqual(encounterDiscard);
  });

  it('records peril on the draw', () => {
    const state = startedWith({ deck: [card('peril_treachery', 'peril_card')] }, { aliceAt: hall });

    const { events } = execute(ctx, state, draw);

    expect(events[0]).toMatchObject({
      type: 'EncounterCardDrawn',
      cardId: 'peril_card',
      peril: true,
      surge: false,
    });
  });

  it('draws again after a surge card', () => {
    const state = startedWith(
      {
        deck: [
          card('surge_treachery', 'surge_card'),
          card('plain_treachery', 'after_surge'),
          card('foe', 'untouched_foe'),
        ],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, draw);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['surge_card', 'after_surge']);
    expect(idsIn(after, encounterDeck)).toEqual(['untouched_foe']);
  });

  it('stops drawing when every encounter card has surge', () => {
    const state = startedWith(
      {
        deck: [card('surge_treachery', 'first_surge'), card('surge_treachery', 'second_surge')],
      },
      { aliceAt: hall },
    );

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
  });

  it('stops a surge when no card is left to draw', () => {
    const state = startedWith({ deck: [card('surge_foe', 'last_card')] }, { aliceAt: hall });

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(1);
  });

  it('reshuffles the discard as soon as the last card has left the deck', () => {
    const state = startedWith(
      {
        deck: [card('plain_treachery', 'last_deck_card')],
        discard: [card('foe', 'discarded_foe')],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, draw);

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
    const state = startedWith(
      {
        deck: [card('foe', 'last_deck_foe')],
        discard: [card('plain_treachery', 'discarded_treachery')],
      },
      { aliceAt: hall },
    );

    const after = stateAfter(ctx, state, draw);

    expect(idsIn(after, encounterDeck)).toEqual(['discarded_treachery']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('does not shuffle when the deck runs out with an empty discard', () => {
    const state = startedWith({ deck: [card('foe', 'last_deck_foe')] }, { aliceAt: hall });

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toEqual([]);
  });

  it('reshuffles the discard into a deck that was already empty before drawing', () => {
    const state = startedWith(
      {
        discard: [
          card('plain_treachery', 'discard_one'),
          card('plain_treachery', 'discard_two'),
          card('plain_treachery', 'discard_three'),
        ],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toHaveLength(1);
    expect(idsIn(after, encounterDeck)).toHaveLength(2);
    expect(idsIn(after, encounterDiscard)).toHaveLength(1);
  });

  describe('reshuffling with a seed', () => {
    const discard = [
      card('plain_treachery', 'plain_a'),
      card('foe', 'foe_a'),
      card('relic', 'relic_a'),
      card('peril_treachery', 'peril_a'),
      card('lingering_treachery', 'lingering_a'),
      card('plain_treachery', 'plain_b'),
      card('foe', 'foe_b'),
      card('relic', 'relic_b'),
    ];

    it('reshuffles the same way for the same seed and differently across seeds', () => {
      const seeded = (seed: number) =>
        idsIn(
          stateAfter(ctx, startedWith({ discard }, { aliceAt: hall, seed }), draw),
          encounterDeck,
        );

      expect(seeded(7)).toEqual(seeded(7));
      expect(seeded(8)).not.toEqual(seeded(7));
    });
  });

  it('reshuffles a surge card that was just discarded before the surge draw', () => {
    const state = startedWith(
      {
        deck: [card('surge_treachery', 'surge_card')],
        discard: [card('plain_treachery', 'discarded_treachery')],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, draw);

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
    const state = startedWith({}, { aliceAt: hall });

    expect(rejectionFrom(ctx, state, draw)).toEqual({ code: 'encounterDeckEmpty' });
  });

  it('rejects an enemy draw for an investigator without a location', () => {
    const state = startedWith({ deck: [card('foe', 'drawn_foe')] }, { aliceAt: undefined });

    expect(rejectionFrom(ctx, state, draw)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });

  it('rejects a draw for an unknown investigator', () => {
    const state = startedWith({ deck: [card('plain_treachery', 'top_card')] }, { aliceAt: hall });
    const command: Command = { type: 'DrawEncounter', investigatorId: investigatorId('nobody') };

    expect(rejectionFrom(ctx, state, command).code).toBe('unknownInvestigator');
  });

  it('feeds onCardEnters when an enemy enters play, but not for a discarded treachery', () => {
    const hooks: Partial<ScenarioHooks> = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };
    const withHooks = withScenario(ctx, { hooks });
    const enemyDeck = startedWith({ deck: [card('foe', 'drawn_foe')] }, { aliceAt: hall });
    const treacheryDeck = startedWith(
      { deck: [card('plain_treachery', 'drawn_treachery')] },
      { aliceAt: hall },
    );

    const enemy = stateAfter(withHooks, enemyDeck, draw);
    const treachery = stateAfter(withHooks, treacheryDeck, draw);

    expect(enemy.cards[instanceId('drawn_foe')]?.tokens.doom).toBe(1);
    expect(treachery.cards[instanceId('drawn_treachery')]?.tokens.doom).toBeUndefined();
  });
});

describe('DrawEncounter with a match', () => {
  const matchCtx = contextWith(
    makeCard({ code: 'hall_location', typeCode: 'location' }),
    makeCard({
      code: 'ghoul_foe',
      name: 'Ghoul Minion',
      typeCode: 'enemy',
      traits: [trait('Ghoul')],
    }),
    makeCard({
      code: 'other_foe',
      name: 'Other Foe',
      typeCode: 'enemy',
      traits: [trait('Monster')],
    }),
    makeCard({ code: 'ghoul_treachery', typeCode: 'treachery', traits: [trait('Ghoul')] }),
    makeCard({
      code: 'surge_ghoul_foe',
      typeCode: 'enemy',
      traits: [trait('Ghoul')],
      keywords: [{ name: 'surge' }],
    }),
    makeCard({ code: 'plain_treachery', typeCode: 'treachery' }),
  );
  const drawGhoulEnemy: Command = {
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { trait: trait('Ghoul'), typeCode: 'enemy' },
  };

  it('takes the first matching card of the deck and leaves the cards above it', () => {
    const state = startedWith(
      {
        deck: [
          card('plain_treachery', 'top_card'),
          card('ghoul_foe', 'first_ghoul'),
          card('ghoul_foe', 'second_ghoul'),
        ],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, drawGhoulEnemy);

    expect(after.cards[instanceId('first_ghoul')]).toMatchObject({
      faceUp: true,
      zone: engagedWithAlice,
    });
    expect(idsIn(after, encounterDeck)).toEqual(['top_card', 'second_ghoul']);
  });

  it('discards the cards above the match first when asked to', () => {
    const state = startedWith(
      {
        deck: [
          card('plain_treachery', 'skipped_treachery'),
          card('other_foe', 'skipped_foe'),
          card('ghoul_foe', 'drawn_ghoul'),
          card('plain_treachery', 'below_ghoul'),
        ],
        discard: [card('plain_treachery', 'old_discard')],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, { ...drawGhoulEnemy, discardSkipped: true });

    expect(idsIn(after, encounterDiscard)).toEqual([
      'skipped_foe',
      'skipped_treachery',
      'old_discard',
    ]);
    expect(idsIn(after, encounterDeck)).toEqual(['below_ghoul']);
    expect(after.cards[instanceId('drawn_ghoul')]?.zone).toEqual(engagedWithAlice);
  });

  it('takes the topmost matching card from the discard when drawing from the discard', () => {
    const state = startedWith(
      {
        deck: [card('ghoul_foe', 'ghoul_in_deck'), card('plain_treachery', 'deck_filler')],
        discard: [
          card('plain_treachery', 'discarded_treachery'),
          card('ghoul_foe', 'upper_discarded_ghoul'),
          card('ghoul_foe', 'lower_discarded_ghoul'),
        ],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, { ...drawGhoulEnemy, from: 'discard' });

    expect(after.cards[instanceId('upper_discarded_ghoul')]?.zone).toEqual(engagedWithAlice);
    expect(idsIn(after, encounterDiscard)).toEqual([
      'discarded_treachery',
      'lower_discarded_ghoul',
    ]);
    expect(idsIn(after, encounterDeck)).toEqual(['ghoul_in_deck', 'deck_filler']);
  });

  it('searches the deck before the discard when drawing from either', () => {
    const state = startedWith(
      {
        deck: [card('ghoul_foe', 'ghoul_in_deck'), card('plain_treachery', 'deck_filler')],
        discard: [card('ghoul_foe', 'ghoul_in_discard')],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, { ...drawGhoulEnemy, from: 'deckOrDiscard' });

    expect(after.cards[instanceId('ghoul_in_deck')]?.zone).toEqual(engagedWithAlice);
    expect(after.cards[instanceId('ghoul_in_discard')]?.zone).toEqual(encounterDiscard);
  });

  it('finds a card that is only in the discard when drawing from either', () => {
    const state = startedWith(
      {
        deck: [card('plain_treachery', 'deck_filler'), card('plain_treachery', 'second_filler')],
        discard: [card('ghoul_foe', 'ghoul_in_discard')],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, { ...drawGhoulEnemy, from: 'deckOrDiscard' });

    expect(after.cards[instanceId('ghoul_in_discard')]?.zone).toEqual(engagedWithAlice);
  });

  it('matches by name', () => {
    const state = startedWith(
      { deck: [card('ghoul_foe', 'ghoul_minion'), card('other_foe', 'other_foe_card')] },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, {
      type: 'DrawEncounter',
      investigatorId: alice,
      match: { name: 'Other Foe' },
    });

    expect(after.cards[instanceId('other_foe_card')]?.zone).toEqual(engagedWithAlice);
    expect(idsIn(after, encounterDeck)).toEqual(['ghoul_minion']);
  });

  it('requires every given field to match', () => {
    const state = startedWith(
      { deck: [card('ghoul_treachery', 'ghoul_treachery_card')] },
      { aliceAt: hall },
      matchCtx,
    );

    expect(rejectionFrom(matchCtx, state, drawGhoulEnemy)).toEqual({
      code: 'noMatchingCard',
      from: 'deck',
      match: drawGhoulEnemy.match,
    });
  });

  it('does not look in the discard unless told to', () => {
    const state = startedWith(
      { discard: [card('ghoul_foe', 'ghoul_in_discard')] },
      { aliceAt: hall },
      matchCtx,
    );

    expect(rejectionFrom(matchCtx, state, drawGhoulEnemy).code).toBe('noMatchingCard');
  });

  it('changes nothing when it rejects, even when asked to discard the cards above', () => {
    const state = startedWith(
      { deck: [card('plain_treachery', 'top_card')] },
      { aliceAt: hall },
      matchCtx,
    );

    const rejection = rejectionFrom(matchCtx, state, { ...drawGhoulEnemy, discardSkipped: true });

    expect(rejection.code).toBe('noMatchingCard');
    expect(idsIn(state, encounterDeck)).toEqual(['top_card']);
  });

  it('draws again from the top after a matched card with surge', () => {
    const state = startedWith(
      {
        deck: [card('plain_treachery', 'top_card'), card('surge_ghoul_foe', 'surging_ghoul')],
        discard: [card('plain_treachery', 'old_discard')],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const { state: after, events } = execute(matchCtx, state, drawGhoulEnemy);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['surging_ghoul', 'top_card']);
    expect(after.cards[instanceId('surging_ghoul')]?.zone).toEqual(engagedWithAlice);
  });

  it('reshuffles the discard when the matched card was the last one in the deck', () => {
    const state = startedWith(
      {
        deck: [card('ghoul_foe', 'last_deck_ghoul')],
        discard: [card('plain_treachery', 'discarded_treachery')],
      },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(matchCtx, state, drawGhoulEnemy);

    expect(idsIn(after, encounterDeck)).toEqual(['discarded_treachery']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('feeds onCardEnters for an enemy drawn from the discard', () => {
    const hooks: Partial<ScenarioHooks> = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };
    const state = startedWith(
      { discard: [card('ghoul_foe', 'discarded_ghoul')] },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter(withScenario(matchCtx, { hooks }), state, {
      ...drawGhoulEnemy,
      from: 'discard',
    });

    expect(after.cards[instanceId('discarded_ghoul')]?.tokens.doom).toBe(1);
  });
});

describe('FromSetAside', () => {
  it('moves one copy per listed code, taking two copies for a code listed twice', () => {
    const state = startedWith(
      {
        setAside: [
          card('foe', 'first_foe'),
          card('plain_treachery', 'set_aside_treachery'),
          card('foe', 'second_foe'),
        ],
      },
      { aliceAt: hall },
    );

    const after = stateAfter(ctx, state, {
      type: 'FromSetAside',
      codes: [cardCode('foe'), cardCode('foe')],
      to: { kind: 'victoryDisplay' },
    });

    expect(idsIn(after, { kind: 'victoryDisplay' })).toEqual(['first_foe', 'second_foe']);
    expect(idsIn(after, { kind: 'setAside' })).toEqual(['set_aside_treachery']);
  });

  it('rejects a code with no set-aside copy left', () => {
    const state = startedWith({ setAside: [card('foe', 'only_foe')] }, { aliceAt: hall });

    expect(
      rejectionFrom(ctx, state, {
        type: 'FromSetAside',
        codes: [cardCode('foe'), cardCode('foe')],
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
    const state = startedWith({ setAside: [card('foe', 'set_aside_foe')] }, { aliceAt: hall });

    const after = stateAfter(withScenario(ctx, { hooks }), state, {
      type: 'FromSetAside',
      codes: [cardCode('foe')],
      to: { kind: 'atLocation', locationId: hall },
    });

    expect(after.cards[instanceId('set_aside_foe')]?.tokens.doom).toBe(2);
  });
});

describe('ShuffleInto', () => {
  it('adds the set-aside cards to the deck and shuffles all of it', () => {
    const state = startedWith(
      {
        deck: [
          card('plain_treachery', 'deck_card_a'),
          card('plain_treachery', 'deck_card_b'),
          card('plain_treachery', 'deck_card_c'),
        ],
        setAside: [card('foe', 'set_aside_foe'), card('relic', 'set_aside_relic')],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, {
      type: 'ShuffleInto',
      codes: [cardCode('foe'), cardCode('relic')],
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
    expect(idsIn(after, { kind: 'setAside' })).toEqual([]);
  });

  it('rejects a code that is not set aside', () => {
    const state = startedWith({ deck: [card('foe', 'deck_foe')] }, { aliceAt: hall });

    expect(
      rejectionFrom(ctx, state, {
        type: 'ShuffleInto',
        codes: [cardCode('foe')],
        zone: encounterDeck,
      }).code,
    ).toBe('cardNotInZone');
  });
});

describe('ShuffleEncounterDiscard', () => {
  const shuffleDiscard: Command = { type: 'ShuffleEncounterDiscard' };

  it('moves the whole discard into the deck and shuffles all of it', () => {
    const state = startedWith(
      {
        deck: [card('plain_treachery', 'deck_card')],
        discard: [card('foe', 'discarded_foe'), card('plain_treachery', 'discarded_treachery')],
      },
      { aliceAt: hall },
    );

    const { state: after, events } = execute(ctx, state, shuffleDiscard);

    expect(events.at(-1)?.type).toBe('DeckShuffled');
    expect([...idsIn(after, encounterDeck)].sort()).toEqual([
      'deck_card',
      'discarded_foe',
      'discarded_treachery',
    ]);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('leaves the deck in its order when the discard is empty', () => {
    const state = startedWith(
      { deck: [card('plain_treachery', 'deck_card_a'), card('foe', 'deck_card_b')] },
      { aliceAt: hall },
    );

    const { events } = execute(ctx, state, shuffleDiscard);

    expect(events).toEqual([]);
  });
});

describe('encounter deck invariants', () => {
  const shuffleIn = (code: string): Command => ({
    type: 'ShuffleInto',
    codes: [cardCode(code)],
    zone: encounterDeck,
  });

  it.each([
    {
      name: 'plain draws',
      cards: {
        deck: [
          card('plain_treachery', 'plain_card'),
          card('foe', 'foe_card'),
          card('lingering_treachery', 'lingering_card'),
        ],
      },
      steps: [draw, draw, draw],
    },
    {
      name: 'draws through a reshuffle',
      cards: {
        deck: [card('plain_treachery', 'last_deck_card')],
        discard: [
          card('foe', 'discarded_foe'),
          card('relic', 'discarded_relic'),
          card('peril_treachery', 'discarded_peril'),
        ],
      },
      steps: [draw, draw, draw, draw, draw],
    },
    {
      name: 'a surge chain',
      cards: {
        deck: [
          card('surge_treachery', 'surge_treachery_card'),
          card('surge_foe', 'surge_foe_card'),
          card('plain_treachery', 'plain_card'),
        ],
        discard: [card('foe', 'discarded_foe')],
      },
      steps: [draw, draw],
    },
    {
      name: 'only surge cards',
      cards: {
        deck: [
          card('surge_treachery', 'surge_treachery_card'),
          card('surge_treachery', 'other_surge'),
        ],
        discard: [card('surge_foe', 'discarded_surge_foe')],
      },
      steps: [draw, draw],
    },
    {
      name: 'cards shuffled in between draws',
      cards: {
        deck: [card('plain_treachery', 'plain_card')],
        setAside: [
          card('foe', 'set_aside_foe'),
          card('lingering_treachery', 'set_aside_lingering'),
        ],
      },
      steps: [draw, shuffleIn('foe'), draw, shuffleIn('lingering_treachery'), draw, draw],
    },
    { name: 'a draw from nothing', cards: {}, steps: [draw] },
  ])(
    'keeps every card in exactly one zone and the card count constant: $name',
    ({ cards, steps }) => {
      let state = startedWith(cards, { aliceAt: hall });
      const cardCount = Object.keys(state.cards).length;

      for (const step of steps) {
        try {
          state = stateAfter(ctx, state, step);
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
        deck: [card('plain_treachery', 'deck_card')],
        discard: [card('foe', 'discarded_foe')],
      },
    },
    {
      name: 'a foe in the deck, two plain cards in the discard',
      cards: {
        deck: [card('foe', 'deck_foe')],
        discard: [card('plain_treachery', 'discard_a'), card('plain_treachery', 'discard_b')],
      },
    },
    {
      name: 'a lingering treachery in the deck, a relic in the discard',
      cards: {
        deck: [card('lingering_treachery', 'deck_lingering')],
        discard: [card('relic', 'discarded_relic')],
      },
    },
    {
      name: 'an empty deck, three cards in the discard',
      cards: {
        discard: [
          card('plain_treachery', 'discarded_treachery'),
          card('foe', 'discarded_foe'),
          card('relic', 'discarded_relic'),
        ],
      },
    },
    {
      name: 'a surge card in the deck, a peril card in the discard',
      cards: {
        deck: [card('surge_treachery', 'deck_surge')],
        discard: [card('peril_treachery', 'discarded_peril')],
      },
    },
    {
      name: 'two plain cards in the deck, an empty discard',
      cards: { deck: [card('plain_treachery', 'deck_a'), card('plain_treachery', 'deck_b')] },
    },
  ])('never leaves the deck empty while the discard has cards: $name', ({ cards }) => {
    for (const seed of [1, 2, 3]) {
      const after = stateAfter(ctx, startedWith(cards, { aliceAt: hall, seed }), draw);

      const deckSize = idsIn(after, encounterDeck).length;
      const discardSize = idsIn(after, encounterDiscard).length;
      expect(deckSize === 0 && discardSize > 0).toBe(false);
    }
  });
});

describe('surge after the drawn card has resolved', () => {
  const aliceDrawsAgain: Command = { type: 'DrawEncounter', investigatorId: alice };

  /**
   * The cards above plus four surge cards: `burning_surge`, whose script
   * deals alice 1 damage when it is revealed; `testing_surge`, which asks
   * for a willpower (3) test; `deadly_surge`, whose script asks alice to
   * confirm 8 damage (her whole health); and `choosy_foe`, an enemy whose
   * spawn text the engine cannot read, so the players choose its location.
   */
  const surgeCtx: EngineContext = {
    ...contextWith(
      makeCard({ code: 'hall_location', typeCode: 'location' }),
      makeCard({ code: 'plain_treachery', typeCode: 'treachery' }),
      makeCard({ code: 'burning_surge', keywords: [{ name: 'surge' }] }),
      makeCard({
        code: 'testing_surge',
        keywords: [{ name: 'surge' }],
        revelationTest: { skill: 'willpower', difficulty: 3 },
      }),
      makeCard({ code: 'deadly_surge', keywords: [{ name: 'surge' }] }),
      makeCard({
        code: 'choosy_foe',
        typeCode: 'enemy',
        keywords: [
          { name: 'surge' },
          { name: 'spawn', detail: 'the location with the most clues' },
        ],
      }),
    ),
    effects: {
      [cardCode('burning_surge')]: {
        onReveal: () => [
          { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 1 },
        ],
      },
      [cardCode('deadly_surge')]: {
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
    const state = startedWith(
      { deck: [card('burning_surge', 'burning_card'), card('plain_treachery', 'after_surge')] },
      { aliceAt: hall },
      surgeCtx,
    );

    const { events } = execute(surgeCtx, state, draw);

    expect(resolutionOrder(events)).toEqual([
      'draws burning_card',
      'alice damage +1',
      'discards burning_card',
      'draws after_surge',
      'discards after_surge',
    ]);
  });

  it('holds the surge draw while the card`s revelation test waits for its result', () => {
    const state = startedWith(
      { deck: [card('testing_surge', 'testing_card'), card('plain_treachery', 'after_surge')] },
      { aliceAt: hall },
      surgeCtx,
    );

    const asked = stateAfter(surgeCtx, state, draw);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['revelation:testing_card']);
    expect(asked.meta.heldAction).toEqual(aliceDrawsAgain);
    expect(idsIn(asked, encounterDeck)).toEqual(['after_surge']);
  });

  it('draws the surge card once the test is answered and the card discarded', () => {
    const state = startedWith(
      { deck: [card('testing_surge', 'testing_card'), card('plain_treachery', 'after_surge')] },
      { aliceAt: hall },
      surgeCtx,
    );
    const asked = stateAfter(surgeCtx, state, draw);

    const { state: answered, events } = execute(surgeCtx, asked, {
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
    const state = startedWith(
      { deck: [card('testing_surge', 'testing_card')] },
      { aliceAt: hall },
      surgeCtx,
    );

    const asked = stateAfter(surgeCtx, state, draw);

    expect(asked.meta.heldAction).toBeUndefined();
  });

  it('drops the held surge draw when the card`s effect defeated alice', () => {
    const state = startedWith(
      { deck: [card('deadly_surge', 'deadly_card'), card('plain_treachery', 'after_surge')] },
      { aliceAt: hall },
      surgeCtx,
    );
    const asked = stateAfter(surgeCtx, state, draw);

    const { events } = execute(surgeCtx, asked, {
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
    const state = startedWith(
      { deck: [card('choosy_foe', 'choosy_card'), card('plain_treachery', 'after_surge')] },
      { aliceAt: hall },
      surgeCtx,
    );
    const asked = stateAfter(surgeCtx, state, draw);

    const { events } = execute(surgeCtx, asked, {
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
  const revelationCtx: EngineContext = {
    ...contextWith(
      makeCard({ code: 'hall_location', typeCode: 'location' }),
      makeCard({ code: 'scorching_treachery', typeCode: 'treachery' }),
      makeCard({ code: 'scorching_foe', typeCode: 'enemy' }),
      makeCard({ code: 'scorching_lingering', typeCode: 'treachery', entersThreatArea: true }),
      makeCard({
        code: 'scorching_attachment',
        typeCode: 'treachery',
        locationAttachment: { onePerLocation: true },
      }),
      makeCard({ code: 'lethal_treachery', typeCode: 'treachery' }),
      makeCard({ code: 'lethal_foe', typeCode: 'enemy' }),
      makeCard({
        code: 'lethal_hall_foe',
        typeCode: 'enemy',
        keywords: [{ name: 'spawn', detail: 'hall_location' }],
      }),
      makeCard({ code: 'vanishing_treachery', typeCode: 'treachery' }),
    ),
    effects: {
      [cardCode('scorching_treachery')]: { onReveal: () => [hurtAlice(1)] },
      [cardCode('scorching_foe')]: { onReveal: () => [hurtAlice(1)] },
      [cardCode('scorching_lingering')]: { onReveal: () => [hurtAlice(1)] },
      [cardCode('scorching_attachment')]: { onReveal: () => [hurtAlice(1)] },
      [cardCode('lethal_treachery')]: { onReveal: () => [hurtAlice(8)] },
      [cardCode('lethal_foe')]: { onReveal: () => [hurtAlice(8)] },
      [cardCode('lethal_hall_foe')]: { onReveal: () => [hurtAlice(8)] },
      [cardCode('vanishing_treachery')]: {
        onReveal: (_ctx, _state, event) => [
          { type: 'MoveCard', cardId: event.cardId, to: { kind: 'setAside' } },
        ],
      },
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
    { code: 'scorching_treachery', placed: 'drawn_card to encounterDiscard' },
    { code: 'scorching_foe', placed: 'drawn_card to atLocation' },
    { code: 'scorching_lingering', placed: 'drawn_card to threatArea' },
    { code: 'scorching_attachment', placed: 'drawn_card to attachedTo' },
  ])('resolves the revelation of $code before placing it', ({ code, placed }) => {
    const state = startedWith(
      { deck: [card(code, 'drawn_card'), card('scorching_treachery', 'next_card')] },
      { aliceAt: hall },
      revelationCtx,
    );

    const { events } = execute(revelationCtx, state, draw);

    expect(resolutionOrder(events)).toEqual(['draws drawn_card', 'alice damage +1', placed]);
  });

  it('keeps the card in the resolving zone while its revelation resolves', () => {
    const state = startedWith(
      { deck: [card('scorching_foe', 'drawn_foe')] },
      { aliceAt: hall },
      revelationCtx,
    );

    const { events } = execute(revelationCtx, state, draw);

    const revelationAt = events.findIndex((e) => e.type === 'InvestigatorChanged');
    const beforeRevelation = replay(events.slice(0, revelationAt), state);
    expect(beforeRevelation.cards[instanceId('drawn_foe')]?.zone).toEqual({ kind: 'resolving' });
  });

  it('does not place a card its revelation has already moved', () => {
    const state = startedWith(
      { deck: [card('vanishing_treachery', 'vanishing_card')] },
      { aliceAt: hall },
      revelationCtx,
    );

    const after = stateAfter(revelationCtx, state, draw);

    expect(after.cards[instanceId('vanishing_card')]?.zone).toEqual({ kind: 'setAside' });
  });

  it.each([
    { code: 'lethal_treachery', placed: 'lethal_card to encounterDiscard' },
    { code: 'lethal_foe', placed: 'lethal_card to encounterDiscard' },
    { code: 'lethal_hall_foe', placed: 'lethal_card to atLocation' },
  ])('places $code without the drawer it defeated: $placed', ({ code, placed }) => {
    const state = startedWith(
      { deck: [card(code, 'lethal_card'), card('scorching_foe', 'next_foe')] },
      { aliceAt: hall },
      revelationCtx,
    );

    const { events } = execute(revelationCtx, state, draw);

    expect(resolutionOrder(events)).toEqual(['draws lethal_card', 'alice damage +8', placed]);
  });
});
