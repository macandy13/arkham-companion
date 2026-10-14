import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardDbFrom,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  zoneKey,
  type CardStats,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type Rejection,
  type StartingCard,
  type Zone,
} from './index';

const main = mapId('main');
const hall = instanceId('hall');
const alice = investigatorId('alice');

const cards: CardStats[] = [
  {
    code: 'LOC',
    name: 'Fake Hall',
    typeCode: 'location',
    traits: [],
    clues: { fixed: 0, perInvestigator: 1 },
  },
  { code: 'FOE', name: 'Fake Foe', typeCode: 'enemy', traits: [] },
  { code: 'DUL', name: 'Fake Dull', typeCode: 'treachery', traits: [] },
  {
    code: 'SUR',
    name: 'Fake Surge',
    typeCode: 'treachery',
    traits: [],
    keywords: [{ name: 'surge' }],
  },
  {
    code: 'PER',
    name: 'Fake Peril',
    typeCode: 'treachery',
    traits: [],
    keywords: [{ name: 'peril' }],
  },
  {
    code: 'LNG',
    name: 'Fake Lingering',
    typeCode: 'treachery',
    traits: [],
    entersThreatArea: true,
  },
  { code: 'REL', name: 'Fake Relic', typeCode: 'asset', traits: [] },
];
const ctx: EngineContext = { cards: cardDbFrom(cards) };

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
  return execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'encounter',
    difficulty: 'standard',
    seed,
    shuffleEncounterDeck: false,
    investigators: [
      {
        id: alice,
        code: 'inv',
        name: 'Alice',
        seat: 1,
        ...(layout.placed === false ? {} : { locationId: hall }),
        health: { max: 8, damage: 0 },
        sanity: { max: 8, horror: 0 },
        clues: 0,
        resources: 0,
        doomOnPlayerCards: 0,
        status: 'active',
      },
    ],
    maps: { [main]: { name: 'Main' } },
    cards: [
      { id: hall, code: 'LOC', zone: { kind: 'location', mapId: main }, faceUp: true },
      ...inZone('d', layout.deck, { kind: 'encounterDeck' }),
      ...inZone('x', layout.discard, { kind: 'encounterDiscard' }),
      ...inZone('s', layout.setAside, { kind: 'setAside' }),
    ],
  }).state;
}

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

function order(state: GameState, zone: Zone): InstanceId[] {
  return state.order[zoneKey(zone)] ?? [];
}

function rejectionOf(state: GameState, command: Command, context = ctx): Rejection {
  try {
    execute(context, state, command);
  } catch (error) {
    if (error instanceof CommandRejected) return error.rejection;
    throw error;
  }
  throw new Error('command was not rejected');
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

  it('places an enemy unengaged at the drawing investigator`s location', () => {
    const state = started({ deck: ['FOE'] });

    const { state: after } = execute(ctx, state, draw);

    expect(after.cards[instanceId('d0')]?.zone).toEqual({ kind: 'atLocation', locationId: hall });
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
    const state = started({ deck: ['REL'] });

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
    const state = started({ deck: ['SUR'] });

    const { events } = execute(ctx, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(1);
  });

  it('reshuffles the discard into an empty deck before drawing', () => {
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

  it('reshuffles a surge card that was just discarded when the deck runs out', () => {
    const state = started({ deck: ['SUR'], discard: ['DUL'] });

    const { state: after } = execute(ctx, state, draw);

    expect(
      order(after, { kind: 'encounterDeck' }).length +
        order(after, { kind: 'encounterDiscard' }).length,
    ).toBe(2);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('rejects a draw when the deck and the discard are empty', () => {
    expect(rejectionOf(started({}), draw)).toEqual({ code: 'encounterDeckEmpty' });
  });

  it('rejects an enemy draw for an investigator without a location', () => {
    const state = started({ deck: ['FOE'], placed: false });

    expect(rejectionOf(state, draw)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });

  it('rejects a draw for an unknown investigator', () => {
    const command: Command = { type: 'DrawEncounter', investigatorId: investigatorId('nobody') };

    expect(rejectionOf(started({ deck: ['DUL'] }), command).code).toBe('unknownInvestigator');
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

    expect(rejectionOf(state, command({ kind: 'setAside' }))).toEqual({
      code: 'cardNotInZone',
      zone: 'encounterDiscard',
      match: 'Fake Foe',
    });
  });

  it('rejects a destination that names an unknown map', () => {
    const state = started({ discard: ['FOE'] });

    expect(rejectionOf(state, command({ kind: 'location', mapId: mapId('nowhere') })).code).toBe(
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
      rejectionOf(state, {
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
      rejectionOf(state, { type: 'ShuffleInto', codes: ['FOE'], zone: { kind: 'encounterDeck' } })
        .code,
    ).toBe('cardNotInZone');
  });
});
