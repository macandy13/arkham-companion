import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  cardDbFrom,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  shortestPaths,
  type CardStats,
  type Edge,
  type EngineContext,
  type GameState,
  type InstanceId,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';

const main = mapId('main');
const defs: CardStats[] = [
  { code: 'LOC', name: 'Fake Place', typeCode: 'location', traits: [] },
  {
    code: 'HNT',
    name: 'Fake Hunter',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'hunter' }],
  },
];
const ctx: EngineContext = { cards: cardDbFrom(defs) };

/** A random map: edges between place indices, investigators and hunters at place indices. */
interface Scenario {
  places: number;
  edges: { from: number; to: number; oneWay: boolean }[];
  investigators: number[];
  hunters: { place: number; exhausted: boolean; engaged: boolean }[];
}

const scenarioArb: fc.Arbitrary<Scenario> = fc.integer({ min: 2, max: 7 }).chain((places) => {
  const place = fc.integer({ min: 0, max: places - 1 });
  return fc.record({
    places: fc.constant(places),
    edges: fc.array(fc.record({ from: place, to: place, oneWay: fc.boolean() }), { maxLength: 12 }),
    investigators: fc.array(place, { minLength: 1, maxLength: 3 }),
    hunters: fc.array(fc.record({ place, exhausted: fc.boolean(), engaged: fc.boolean() }), {
      minLength: 1,
      maxLength: 4,
    }),
  });
});

const placeId = (index: number) => instanceId(`p${index}`);
const hunterId = (index: number) => instanceId(`h${index}`);

function investigatorsOf(scenario: Scenario): Investigator[] {
  return scenario.investigators.map((place, i) => ({
    id: investigatorId(`i${i}`),
    code: 'inv',
    name: `Investigator ${i}`,
    seat: i,
    locationId: placeId(place),
    health: { max: 8, damage: 0 },
    sanity: { max: 8, horror: 0 },
    clues: 0,
    resources: 0,
    doomOnPlayerCards: 0,
    status: 'active',
  }));
}

/** Edges without self-loops; a repeated edge would be rejected by the engine. */
function distinctEdges(scenario: Scenario): Edge[] {
  const edges: Edge[] = [];
  for (const { from, to, oneWay } of scenario.edges) {
    const edge = { from: placeId(from), to: placeId(to), oneWay };
    const repeated = edges.some(
      (known) =>
        known.oneWay === oneWay &&
        ((known.from === edge.from && known.to === edge.to) ||
          (!oneWay && known.from === edge.to && known.to === edge.from)),
    );
    if (from !== to && !repeated) edges.push(edge);
  }
  return edges;
}

function build(scenario: Scenario): GameState {
  const investigators = investigatorsOf(scenario);
  const [first] = investigators;
  const locations: StartingCard[] = Array.from({ length: scenario.places }, (_, i) => ({
    id: placeId(i),
    code: 'LOC',
    zone: { kind: 'location', mapId: main },
    faceUp: true,
  }));
  const hunters: StartingCard[] = scenario.hunters.map((hunter, i) => {
    // An unengaged hunter that starts at an investigator would engage during setup.
    const zone: Zone =
      hunter.engaged && first
        ? { kind: 'engaged', investigatorId: first.id }
        : { kind: 'atLocation', locationId: placeId(hunter.place) };
    return { id: hunterId(i), code: 'HNT', zone, faceUp: true };
  });
  const started = execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'hunters-property',
    difficulty: 'standard',
    seed: 1,
    shuffleEncounterDeck: false,
    investigators,
    maps: { [main]: { name: 'Main' } },
    cards: [...locations, ...hunters],
    connections: distinctEdges(scenario),
  }).state;
  return scenario.hunters.reduce(
    (state, hunter, i) =>
      hunter.exhausted && state.cards[hunterId(i)]?.zone.kind === 'atLocation'
        ? execute(ctx, state, { type: 'ExhaustEnemy', enemyId: hunterId(i) }).state
        : state,
    started,
  );
}

/** Steps from `from` to the nearest investigator; infinite if none can be reached. */
function distanceToNearestInvestigator(state: GameState, from: InstanceId): number {
  const distances = state.investigators.flatMap(({ locationId }) => {
    const [path] = locationId === undefined ? [] : shortestPaths(state, from, locationId);
    return path ? [path.length - 1] : [];
  });
  return Math.min(...distances);
}

describe('MoveHunters properties', () => {
  it('moves a hunter strictly closer to the nearest investigator, and never an engaged or exhausted one', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const before = build(scenario);

        const { state: after } = execute(ctx, before, { type: 'MoveHunters' });

        expect(checkInvariants(after)).toEqual([]);
        for (const hunter of Object.values(before.cards).filter((card) => card.code === 'HNT')) {
          const movable = hunter.zone.kind === 'atLocation' && !hunter.exhausted;
          const now = after.cards[hunter.id]?.zone;
          if (!movable) {
            expect(now).toEqual(hunter.zone);
          } else if (now?.kind === 'atLocation' && hunter.zone.kind === 'atLocation') {
            const moved = now.locationId !== hunter.zone.locationId;
            if (moved)
              expect(distanceToNearestInvestigator(after, now.locationId)).toBeLessThan(
                distanceToNearestInvestigator(before, hunter.zone.locationId),
              );
          }
        }
      }),
    );
  });
});
