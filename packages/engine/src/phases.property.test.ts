import fc from 'fast-check';
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
  type CardStats,
  type Command,
  type EngineContext,
  type GameState,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';

const main = mapId('main');
const defs: CardStats[] = [
  {
    code: 'AG',
    name: 'Fake Agenda',
    typeCode: 'agenda',
    traits: [],
    doom: { fixed: 2, perInvestigator: 0 },
  },
  { code: 'LOC', name: 'Fake Place', typeCode: 'location', traits: [], shroud: 1 },
  {
    code: 'HNT',
    name: 'Fake Hunter',
    typeCode: 'enemy',
    traits: [],
    damage: 1,
    horror: 1,
    keywords: [{ name: 'hunter' }],
  },
  { code: 'FOE', name: 'Fake Foe', typeCode: 'enemy', traits: [], damage: 1, horror: 0 },
  {
    code: 'BIG',
    name: 'Fake Giant',
    typeCode: 'enemy',
    traits: [],
    damage: 0,
    horror: 1,
    keywords: [{ name: 'massive' }],
  },
  {
    code: 'SPN',
    name: 'Fake Spawner',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'spawn', detail: 'Fake Place' }],
  },
  {
    code: 'SRG',
    name: 'Fake Surge',
    typeCode: 'treachery',
    traits: [],
    keywords: [{ name: 'surge' }],
  },
  { code: 'TRE', name: 'Fake Mishap', typeCode: 'treachery', traits: [] },
];
const ctx: EngineContext = { cards: cardDbFrom(defs) };
const encounterCodes = ['HNT', 'FOE', 'BIG', 'SPN', 'SRG', 'TRE'];

/** Three agendas, a triangle of locations, 1-3 investigators and a random encounter deck. */
function started(investigatorCount: number, encounterDeck: string[], seed: number): GameState {
  const places = ['p0', 'p1', 'p2'];
  const investigators: Investigator[] = Array.from({ length: investigatorCount }, (_, i) => ({
    id: investigatorId(`inv${i}`),
    code: 'inv',
    name: `inv${i}`,
    seat: i,
    locationId: instanceId(places[i % places.length] ?? 'p0'),
    health: { max: 4, damage: 0 },
    sanity: { max: 4, horror: 0 },
    clues: 0,
    resources: 0,
    doomOnPlayerCards: 0,
    status: 'active',
  }));
  const cards: StartingCard[] = [
    ...['ag0', 'ag1', 'ag2'].map((cardId) => ({
      id: instanceId(cardId),
      code: 'AG',
      zone: { kind: 'agendaDeck' } as Zone,
      faceUp: true,
    })),
    ...places.map((place) => ({
      id: instanceId(place),
      code: 'LOC',
      zone: { kind: 'location', mapId: main } as Zone,
      faceUp: true,
    })),
    ...encounterDeck.map((code, i) => ({
      id: instanceId(`e${i}`),
      code,
      zone: { kind: 'encounterDeck' } as Zone,
    })),
  ];
  return execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'phases-property',
    difficulty: 'standard',
    seed,
    investigators,
    maps: { [main]: { name: 'Main' } },
    cards,
    connections: [
      { from: instanceId('p0'), to: instanceId('p1'), oneWay: false },
      { from: instanceId('p1'), to: instanceId('p2'), oneWay: false },
      { from: instanceId('p2'), to: instanceId('p0'), oneWay: false },
    ],
  }).state;
}

/** The commands that could move the game on from `state`, in the order `pick` rotates. */
function candidates(state: GameState): Command[] {
  const [decision] = state.pending;
  if (decision)
    return decision.options.map((option) => ({
      type: 'ResolveDecision',
      decisionId: decision.id,
      optionId: option.id,
    }));
  const attacks: Command[] = state.meta.steps.flatMap((step) =>
    step.kind === 'enemyAttack'
      ? [{ type: 'ResolveEnemyAttack', enemyId: step.enemyId, investigatorId: step.investigatorId }]
      : [],
  );
  return [{ type: 'NextPhase' }, ...attacks];
}

/** Runs the first accepted command of `commands`, starting at `pick`; `undefined` if all are rejected. */
function firstAccepted(state: GameState, commands: Command[], pick: number): GameState | undefined {
  for (let i = 0; i < commands.length; i++) {
    const command = commands[(pick + i) % commands.length];
    if (!command) continue;
    try {
      return execute(ctx, state, command).state;
    } catch (e) {
      if (!(e instanceof CommandRejected)) throw e;
    }
  }
  return undefined;
}

describe('phase assistant properties', () => {
  it('random NextPhase and answers keep the invariants, never lower the round and never get stuck', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.constantFrom(...encounterCodes), { maxLength: 10 }),
        fc.integer(),
        fc.array(fc.nat(5), { minLength: 1, maxLength: 60 }),
        (investigatorCount, encounterDeck, seed, picks) => {
          let state = started(investigatorCount, encounterDeck, seed);
          for (const pick of picks) {
            if (state.meta.resolution !== undefined) break;
            const next = firstAccepted(state, candidates(state), pick);

            expect(next).toBeDefined();
            if (!next) return;
            expect(checkInvariants(next)).toEqual([]);
            expect(next.meta.round).toBeGreaterThanOrEqual(state.meta.round);
            state = next;
          }
        },
      ),
    );
  });
});
