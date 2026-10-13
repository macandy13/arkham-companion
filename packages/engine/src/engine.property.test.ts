import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  TOKEN_KINDS,
  checkInvariants,
  emptyState,
  handle,
  instanceId,
  investigatorId,
  mapId,
  replay,
  type Adjustment,
  type Event,
  type GameState,
  type StartScenario,
  type Zone,
} from './index';

const investigators = [investigatorId('a'), investigatorId('b')];
const maps = [mapId('m1'), mapId('m2')];
const CARD_COUNT = 12;
const cardIds = Array.from({ length: CARD_COUNT }, (_, i) => instanceId(`c${i}`));

const zoneArb: fc.Arbitrary<Zone> = fc.oneof(
  fc.constantFrom<Zone>(
    { kind: 'encounterDeck' },
    { kind: 'encounterDiscard' },
    { kind: 'setAside' },
    { kind: 'victoryDisplay' },
    { kind: 'outOfGame' },
    { kind: 'agendaDeck' },
    { kind: 'actDeck' },
  ),
  fc.constantFrom(...maps).map((m): Zone => ({ kind: 'location', mapId: m })),
  fc.constantFrom(...investigators).map((i): Zone => ({ kind: 'engaged', investigatorId: i })),
  fc.constantFrom(...investigators).map((i): Zone => ({ kind: 'threatArea', investigatorId: i })),
  // May reference unknown cards or create cycles: the handler must reject those.
  fc
    .constantFrom(...cardIds, instanceId('ghost'))
    .map((h): Zone => ({ kind: 'atLocation', locationId: h })),
  fc.constantFrom(...cardIds).map((h): Zone => ({ kind: 'attachedTo', hostId: h })),
);

const adjustmentArb: fc.Arbitrary<Adjustment> = fc.oneof(
  fc.record({
    kind: fc.constant('moveCard' as const),
    cardId: fc.constantFrom(...cardIds),
    to: zoneArb,
    index: fc.option(fc.integer({ min: -1, max: CARD_COUNT }), { nil: undefined }),
  }),
  fc.record({
    kind: fc.constant('tokens' as const),
    cardId: fc.constantFrom(...cardIds),
    token: fc.constantFrom(...TOKEN_KINDS),
    delta: fc.integer({ min: -3, max: 3 }),
  }),
);

const startArb: fc.Arbitrary<StartScenario> = fc
  .record({
    seed: fc.integer(),
    zones: fc.array(
      fc.constantFrom<Zone>(
        { kind: 'encounterDeck' },
        { kind: 'setAside' },
        { kind: 'agendaDeck' },
        { kind: 'location', mapId: maps[0]! },
      ),
      { minLength: CARD_COUNT, maxLength: CARD_COUNT },
    ),
  })
  .map(({ seed, zones }) => ({
    type: 'StartScenario',
    scenarioId: 'prop',
    difficulty: 'standard',
    seed,
    investigators: investigators.map((id, seat) => ({
      id,
      code: `inv-${id}`,
      name: id,
      seat,
      health: { max: 8, damage: 0 },
      sanity: { max: 8, horror: 0 },
      clues: 0,
      resources: 5,
      status: 'active' as const,
    })),
    maps: Object.fromEntries(maps.map((m) => [m, { name: m }])),
    cards: zones.map((zone, i) => ({ code: `X${i % 4}`, zone })),
  }));

/** Plays a start command plus adjustments; rejected adjustments are skipped. */
function play(start: StartScenario, adjustments: Adjustment[]) {
  let state: GameState = emptyState();
  const events: Event[] = [];
  const states: GameState[] = [];
  const step = (evs: Event[]) => {
    state = replay(evs, state);
    events.push(...evs);
    states.push(state);
  };
  step(handle(state, start));
  for (const adjustment of adjustments) {
    try {
      step(handle(state, { type: 'ManualAdjust', adjustment }));
    } catch (e) {
      if (!(e instanceof CommandRejected)) throw e;
    }
  }
  return { state, events, states };
}

describe('engine properties', () => {
  it('replaying the event log yields the identical state', () => {
    fc.assert(
      fc.property(startArb, fc.array(adjustmentArb, { maxLength: 40 }), (start, adjustments) => {
        const { state, events } = play(start, adjustments);
        expect(replay(events)).toEqual(state);
        // Event logs survive a JSON round-trip (persistence) without changing the result.
        expect(replay(JSON.parse(JSON.stringify(events)) as Event[])).toEqual(state);
      }),
    );
  });

  it('the same commands always produce the same events', () => {
    fc.assert(
      fc.property(startArb, fc.array(adjustmentArb, { maxLength: 20 }), (start, adjustments) => {
        expect(play(start, adjustments).events).toEqual(play(start, adjustments).events);
      }),
    );
  });

  it('every card is in exactly one zone and no token is negative, after every step', () => {
    fc.assert(
      fc.property(startArb, fc.array(adjustmentArb, { maxLength: 40 }), (start, adjustments) => {
        const { states } = play(start, adjustments);
        for (const s of states) {
          expect(checkInvariants(s)).toEqual([]);
          expect(Object.keys(s.cards)).toHaveLength(CARD_COUNT);
        }
      }),
    );
  });
});
