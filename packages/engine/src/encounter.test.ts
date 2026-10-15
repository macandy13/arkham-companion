import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  execute,
  instanceId,
  investigatorId,
  trait,
  zoneKey,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
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
    cards.map(({ code, id }) => ({ code, id, zone }));
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

    expect(events.map((e) => e.type)).toEqual(['EncounterCardDrawn', 'CardFlipped', 'CardMoved']);
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
    const hooks: EngineContext['hooks'] = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };
    const withHooks = { ...ctx, hooks };
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
    const hooks: EngineContext['hooks'] = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };
    const state = startedWith(
      { discard: [card('ghoul_foe', 'discarded_ghoul')] },
      { aliceAt: hall },
      matchCtx,
    );

    const after = stateAfter({ ...matchCtx, hooks }, state, { ...drawGhoulEnemy, from: 'discard' });

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
      codes: ['foe', 'foe'],
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
        codes: ['foe', 'foe'],
        to: { kind: 'outOfGame' },
      }),
    ).toEqual({ code: 'cardNotInZone', zone: 'setAside', match: 'foe' });
  });

  it('feeds onCardEnters when the card goes into play', () => {
    const hooks: EngineContext['hooks'] = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 2 },
      ],
    };
    const state = startedWith({ setAside: [card('foe', 'set_aside_foe')] }, { aliceAt: hall });

    const after = stateAfter({ ...ctx, hooks }, state, {
      type: 'FromSetAside',
      codes: ['foe'],
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
      codes: ['foe', 'relic'],
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
      rejectionFrom(ctx, state, { type: 'ShuffleInto', codes: ['foe'], zone: encounterDeck }).code,
    ).toBe('cardNotInZone');
  });
});

describe('encounter deck invariants', () => {
  const shuffleIn = (code: string): Command => ({
    type: 'ShuffleInto',
    codes: [code],
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
        } catch {
          // A rejected step leaves the state unchanged, which the checks below still cover.
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
