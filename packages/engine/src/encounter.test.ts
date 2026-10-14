import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  execute,
  instanceId,
  investigatorId,
  mapId,
  zoneKey,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type StartingCard,
  type Zone,
} from './index';
import { contextWith, makeCard, makeInvestigator, rejectionOf, run } from '../test/utils';

const main = mapId('main');
const hall = instanceId('hall');
const alice = investigatorId('alice');

const ctx = contextWith(
  makeCard({ code: 'LOC', name: 'Fake Hall', typeCode: 'location' }),
  makeCard({ code: 'FOE', name: 'Fake Foe', typeCode: 'enemy' }),
  makeCard({ code: 'DUL', name: 'Fake Dull', typeCode: 'treachery' }),
  makeCard({ code: 'SUR', name: 'Fake Surge', keywords: [{ name: 'surge' }] }),
  makeCard({
    code: 'SUF',
    name: 'Fake Surging Foe',
    typeCode: 'enemy',
    keywords: [{ name: 'surge' }],
  }),
  makeCard({ code: 'PER', name: 'Fake Peril', keywords: [{ name: 'peril' }] }),
  makeCard({ code: 'LNG', name: 'Fake Lingering', entersThreatArea: true }),
  makeCard({ code: 'REL', name: 'Fake Relic', typeCode: 'asset' }),
);

interface Layout {
  /** Codes in the encounter deck, top first; instance IDs are `d0`, `d1`, … */
  deck?: string[];
  /** Codes in the encounter discard, top first; IDs `x0`, `x1`, … */
  discard?: string[];
  /** Codes set aside; IDs `s0`, `s1`, … */
  setAside?: string[];
  /** Whether alice stands at the hall (default true). */
  placed?: boolean;
}

/** A scenario with a revealed hall, alice and the cards of `layout`. */
function started(layout: Layout, seed = 1): GameState {
  const inZone = (prefix: string, codes: string[] | undefined, zone: Zone): StartingCard[] =>
    (codes ?? []).map((code, i) => ({ id: instanceId(`${prefix}${i}`), code, zone }));
  return run(ctx, [
    {
      type: 'StartScenario',
      scenarioId: 'encounter',
      difficulty: 'standard',
      seed,
      shuffleEncounterDeck: false,
      investigators: [
        makeInvestigator({
          id: 'alice',
          seat: 1,
          ...(layout.placed === false ? {} : { locationId: hall }),
        }),
      ],
      maps: { [main]: { name: 'Main' } },
      cards: [
        { id: hall, code: 'LOC', zone: { kind: 'location', mapId: main }, faceUp: true },
        ...inZone('d', layout.deck, { kind: 'encounterDeck' }),
        ...inZone('x', layout.discard, { kind: 'encounterDiscard' }),
        ...inZone('s', layout.setAside, { kind: 'setAside' }),
      ],
    },
  ]).state;
}

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

function order(state: GameState, zone: Zone): InstanceId[] {
  return state.order[zoneKey(zone)] ?? [];
}

/** The rejection `command` causes in `state`. */
function rejection(state: GameState, command: Command) {
  return rejectionOf(() => execute(ctx, state, command));
}

describe('DrawEncounter', () => {
  it('reveals the top card and discards a plain treachery on top of the discard', () => {
    const state = started({ deck: ['DUL', 'FOE'], discard: ['REL'] });

    const { state: after, events } = execute(ctx, state, draw);

    expect(events.map((e) => e.type)).toEqual(['EncounterCardDrawn', 'CardFlipped', 'CardMoved']);
    expect(after.cards[instanceId('d0')]).toMatchObject({
      faceUp: true,
      zone: { kind: 'encounterDiscard' },
    });
    expect(order(after, { kind: 'encounterDiscard' })).toEqual(['d0', 'x0']);
    expect(order(after, { kind: 'encounterDeck' })).toEqual(['d1']);
  });

  it('spawns an enemy at the drawing investigator`s location and engages them', () => {
    const state = started({ deck: ['FOE'] });

    const { state: after } = execute(ctx, state, draw);

    expect(after.cards[instanceId('d0')]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
  });

  it('puts a treachery that stays in play into the threat area', () => {
    const state = started({ deck: ['LNG'] });

    const { state: after } = execute(ctx, state, draw);

    expect(after.cards[instanceId('d0')]?.zone).toEqual({
      kind: 'threatArea',
      investigatorId: alice,
    });
  });

  it('discards a card that is neither enemy nor treachery', () => {
    const state = started({ deck: ['REL', 'DUL'] });

    const { state: after } = execute(ctx, state, draw);

    expect(after.cards[instanceId('d0')]?.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('records peril on the draw', () => {
    const state = started({ deck: ['PER'] });

    const { events } = execute(ctx, state, draw);

    expect(events[0]).toMatchObject({
      type: 'EncounterCardDrawn',
      cardId: 'd0',
      peril: true,
      surge: false,
    });
  });

  it('draws again after a surge card', () => {
    const state = started({ deck: ['SUR', 'DUL', 'FOE'] });

    const { state: after, events } = execute(ctx, state, draw);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['d0', 'd1']);
    expect(order(after, { kind: 'encounterDeck' })).toEqual(['d2']);
  });

  it('stops drawing when every encounter card has surge', () => {
    const state = started({ deck: ['SUR', 'SUR'] });

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
  });

  it('stops a surge when no card is left to draw', () => {
    const state = started({ deck: ['SUF'] });

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(1);
  });

  it('reshuffles the discard as soon as the last card has left the deck', () => {
    const state = started({ deck: ['DUL'], discard: ['FOE'] });

    const { state: after, events } = execute(ctx, state, draw);

    expect(events.map((e) => e.type)).toEqual([
      'EncounterCardDrawn',
      'CardFlipped',
      'CardMoved',
      'CardMoved',
      'CardMoved',
      'DeckShuffled',
    ]);
    expect([...order(after, { kind: 'encounterDeck' })].sort()).toEqual(['d0', 'x0']);
    expect(order(after, { kind: 'encounterDiscard' })).toEqual([]);
  });

  it('reshuffles the discard when the last card of the deck is an enemy that stays in play', () => {
    const state = started({ deck: ['FOE'], discard: ['DUL'] });

    const { state: after } = execute(ctx, state, draw);

    expect(order(after, { kind: 'encounterDeck' })).toEqual(['x0']);
    expect(order(after, { kind: 'encounterDiscard' })).toEqual([]);
  });

  it('does not shuffle when the deck runs out with an empty discard', () => {
    const state = started({ deck: ['FOE'] });

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toEqual([]);
  });

  it('reshuffles the discard into a deck that was already empty before drawing', () => {
    const state = started({ discard: ['DUL', 'DUL', 'DUL'] });

    const { state: after, events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toHaveLength(1);
    expect(order(after, { kind: 'encounterDeck' })).toHaveLength(2);
    expect(order(after, { kind: 'encounterDiscard' })).toHaveLength(1);
  });

  it('reshuffles the same way for the same seed and differently across seeds', () => {
    const discard = ['DUL', 'FOE', 'REL', 'PER', 'LNG', 'DUL', 'FOE', 'REL'];

    const first = execute(ctx, started({ discard }, 7), draw).state;
    const again = execute(ctx, started({ discard }, 7), draw).state;
    const other = execute(ctx, started({ discard }, 8), draw).state;

    expect(order(again, { kind: 'encounterDeck' })).toEqual(
      order(first, { kind: 'encounterDeck' }),
    );
    expect(order(other, { kind: 'encounterDeck' })).not.toEqual(
      order(first, { kind: 'encounterDeck' }),
    );
  });

  it('reshuffles a surge card that was just discarded before the surge draw', () => {
    const state = started({ deck: ['SUR'], discard: ['DUL'] });

    const { state: after, events } = execute(ctx, state, draw);

    const types = events.map((e) => e.type);
    const shuffled = events.find((e) => e.type === 'DeckShuffled');
    expect(types.indexOf('DeckShuffled')).toBeLessThan(types.lastIndexOf('EncounterCardDrawn'));
    expect(shuffled?.type === 'DeckShuffled' && [...shuffled.order].sort()).toEqual(['d0', 'x0']);
    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('rejects a draw when the deck and the discard are empty', () => {
    expect(rejection(started({}), draw)).toEqual({ code: 'encounterDeckEmpty' });
  });

  it('rejects an enemy draw for an investigator without a location', () => {
    const state = started({ deck: ['FOE'], placed: false });

    expect(rejection(state, draw)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });

  it('rejects a draw for an unknown investigator', () => {
    const command: Command = { type: 'DrawEncounter', investigatorId: investigatorId('nobody') };

    expect(rejection(started({ deck: ['DUL'] }), command).code).toBe('unknownInvestigator');
  });

  it('feeds onCardEnters when an enemy enters play, but not for a discarded treachery', () => {
    const hooks: EngineContext['hooks'] = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
      ],
    };

    const enemy = execute({ ...ctx, hooks }, started({ deck: ['FOE'] }), draw).state;
    const treachery = execute({ ...ctx, hooks }, started({ deck: ['DUL'] }), draw).state;

    expect(enemy.cards[instanceId('d0')]?.tokens.doom).toBe(1);
    expect(treachery.cards[instanceId('d0')]?.tokens.doom).toBeUndefined();
  });
});

describe('DrawTopmostFromDiscard', () => {
  const command = (to: Zone): Command => ({ type: 'DrawTopmostFromDiscard', name: 'Fake Foe', to });

  it('moves the topmost card with that name', () => {
    const state = started({ discard: ['DUL', 'FOE', 'FOE'] });

    const { state: after } = execute(ctx, state, command({ kind: 'atLocation', locationId: hall }));

    expect(after.cards[instanceId('x1')]?.zone).toEqual({ kind: 'atLocation', locationId: hall });
    expect(after.cards[instanceId('x2')]?.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('rejects when no card in the discard has that name', () => {
    const state = started({ discard: ['DUL'], deck: ['FOE'] });

    expect(rejection(state, command({ kind: 'setAside' }))).toEqual({
      code: 'cardNotInZone',
      zone: 'encounterDiscard',
      match: 'Fake Foe',
    });
  });

  it('rejects a destination that names an unknown map', () => {
    const state = started({ discard: ['FOE'] });

    expect(rejection(state, command({ kind: 'location', mapId: mapId('nowhere') })).code).toBe(
      'unknownMap',
    );
  });
});

describe('FromSetAside', () => {
  it('moves one copy per listed code, taking two copies for a code listed twice', () => {
    const state = started({ setAside: ['FOE', 'DUL', 'FOE'] });

    const { state: after } = execute(ctx, state, {
      type: 'FromSetAside',
      codes: ['FOE', 'FOE'],
      to: { kind: 'victoryDisplay' },
    });

    expect(order(after, { kind: 'victoryDisplay' })).toEqual(['s0', 's2']);
    expect(order(after, { kind: 'setAside' })).toEqual(['s1']);
  });

  it('rejects a code with no set-aside copy left', () => {
    const state = started({ setAside: ['FOE'] });

    expect(
      rejection(state, {
        type: 'FromSetAside',
        codes: ['FOE', 'FOE'],
        to: { kind: 'outOfGame' },
      }),
    ).toEqual({ code: 'cardNotInZone', zone: 'setAside', match: 'FOE' });
  });

  it('feeds onCardEnters when the card goes into play', () => {
    const hooks: EngineContext['hooks'] = {
      onCardEnters: (_ctx, _state, event) => [
        { type: 'PlaceDoom', cardId: event.cardId, amount: 2 },
      ],
    };
    const state = started({ setAside: ['FOE'] });

    const { state: after } = execute({ ...ctx, hooks }, state, {
      type: 'FromSetAside',
      codes: ['FOE'],
      to: { kind: 'atLocation', locationId: hall },
    });

    expect(after.cards[instanceId('s0')]?.tokens.doom).toBe(2);
  });
});

describe('ShuffleInto', () => {
  it('adds the set-aside cards to the deck and shuffles all of it', () => {
    const state = started({ deck: ['DUL', 'DUL', 'DUL'], setAside: ['FOE', 'REL'] });

    const { state: after, events } = execute(ctx, state, {
      type: 'ShuffleInto',
      codes: ['FOE', 'REL'],
      zone: { kind: 'encounterDeck' },
    });

    expect(events.at(-1)?.type).toBe('DeckShuffled');
    expect([...order(after, { kind: 'encounterDeck' })].sort()).toEqual([
      'd0',
      'd1',
      'd2',
      's0',
      's1',
    ]);
    expect(order(after, { kind: 'setAside' })).toEqual([]);
  });

  it('rejects a code that is not set aside', () => {
    const state = started({ deck: ['FOE'] });

    expect(
      rejection(state, { type: 'ShuffleInto', codes: ['FOE'], zone: { kind: 'encounterDeck' } })
        .code,
    ).toBe('cardNotInZone');
  });
});

describe('encounter deck invariants', () => {
  const shuffleIn = (code: string): Command => ({
    type: 'ShuffleInto',
    codes: [code],
    zone: { kind: 'encounterDeck' },
  });

  it.each([
    { name: 'plain draws', layout: { deck: ['DUL', 'FOE', 'LNG'] }, steps: [draw, draw, draw] },
    {
      name: 'draws through a reshuffle',
      layout: { deck: ['DUL'], discard: ['FOE', 'REL', 'PER'] },
      steps: [draw, draw, draw, draw, draw],
    },
    {
      name: 'a surge chain',
      layout: { deck: ['SUR', 'SUF', 'DUL'], discard: ['FOE'] },
      steps: [draw, draw],
    },
    {
      name: 'only surge cards',
      layout: { deck: ['SUR', 'SUR'], discard: ['SUF'] },
      steps: [draw, draw],
    },
    {
      name: 'cards shuffled in between draws',
      layout: { deck: ['DUL'], setAside: ['FOE', 'LNG'] },
      steps: [draw, shuffleIn('FOE'), draw, shuffleIn('LNG'), draw, draw],
    },
    { name: 'a draw from nothing', layout: {}, steps: [draw] },
  ])('keeps every card in exactly one zone and the card count constant: $name', (testCase) => {
    let state = started(testCase.layout);
    const cardCount = Object.keys(state.cards).length;

    for (const step of testCase.steps) {
      try {
        state = execute(ctx, state, step).state;
      } catch {
        // A rejected step leaves the state unchanged, which the checks below still cover.
      }

      const placed = Object.values(state.order).reduce((sum, ids) => sum + ids.length, 0);
      expect(checkInvariants(state)).toEqual([]);
      expect(Object.keys(state.cards)).toHaveLength(cardCount);
      expect(placed).toBe(cardCount);
    }
  });

  it.each([
    { deck: ['DUL'], discard: ['FOE'] },
    { deck: ['FOE'], discard: ['DUL', 'DUL'] },
    { deck: ['LNG'], discard: ['REL'] },
    { deck: [], discard: ['DUL', 'FOE', 'REL'] },
    { deck: ['SUR'], discard: ['PER'] },
    { deck: ['DUL', 'DUL'], discard: [] },
  ])('never leaves the deck empty while the discard has cards: $deck / $discard', (layout) => {
    for (const seed of [1, 2, 3]) {
      const after = execute(ctx, started(layout, seed), draw).state;

      const deckSize = order(after, { kind: 'encounterDeck' }).length;
      const discardSize = order(after, { kind: 'encounterDiscard' }).length;
      expect(deckSize === 0 && discardSize > 0).toBe(false);
    }
  });
});
