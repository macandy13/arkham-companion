import { describe, expect, it } from 'vitest';
import {
  compileMapStep,
  compileSetup,
  emptyState,
  execute,
  instanceId,
  mapId,
  referenceSide,
  spawnZone,
  type AddMapStep,
  type SetupStep,
} from './index';
import {
  contextWith,
  investigators,
  makeCard,
  makeDefinition,
  makeSetupOptions,
  perInvestigator,
  rejectionOf,
} from '../test/utils';

const main = mapId('main');

/** A map step for `main` with the given locations (unrevealed) and no connections. */
function mainMap(...codes: string[]): AddMapStep {
  return { kind: 'addMap', mapId: main, name: 'Main', locations: codes.map((code) => ({ code })) };
}

describe('compileSetup', () => {
  it('copies identity, difficulty, seed and the chaos bag for the difficulty', () => {
    const def = makeDefinition({
      id: 'demo',
      chaosBag: { easy: ['+1'], standard: [], hard: ['-4', 'skull'], expert: [] },
    });

    const command = compileSetup(
      contextWith(),
      def,
      makeSetupOptions({ difficulty: 'hard', seed: 42 }),
    );

    expect(command).toMatchObject({
      type: 'StartScenario',
      scenarioId: 'demo',
      difficulty: 'hard',
      seed: 42,
      chaosBag: ['-4', 'skull'],
    });
  });

  it('puts agendas and acts into their decks in order, side a up', () => {
    const def = makeDefinition({ agendaDeck: ['ag1', 'ag2'], actDeck: ['act1'] });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.cards).toEqual([
      { id: 'ag1#1', code: 'ag1', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: 'ag2#1', code: 'ag2', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: 'act1#1', code: 'act1', zone: { kind: 'actDeck' }, faceUp: true },
    ]);
  });

  it('sets cards aside and numbers copies of the same code', () => {
    const def = makeDefinition({ setup: [{ kind: 'setAside', codes: ['x', 'x', 'y'] }] });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.cards.map((c) => [c.id, c.zone.kind])).toEqual([
      ['x#1', 'setAside'],
      ['x#2', 'setAside'],
      ['y#1', 'setAside'],
    ]);
  });

  it('spawns an enemy at a location', () => {
    const def = makeDefinition({
      setup: [mainMap('loc'), { kind: 'spawn', code: 'enemy', at: 'loc' }],
    });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.cards[1]).toEqual({
      id: 'enemy#1',
      code: 'enemy',
      zone: spawnZone(instanceId('loc#1')),
      faceUp: true,
    });
  });

  it('places investigators at a location and reveals it with its clues', () => {
    const ctx = contextWith(
      makeCard({ code: 'start', typeCode: 'location', clues: perInvestigator(1) }),
    );
    const def = makeDefinition({
      setup: [mainMap('start'), { kind: 'moveInvestigators', to: 'start' }],
    });

    const command = compileSetup(ctx, def, makeSetupOptions({ investigators: investigators(2) }));

    expect(command.investigators.map((inv) => inv.locationId)).toEqual(['start#1', 'start#1']);
    expect(command.cards[0]).toMatchObject({ faceUp: true, tokens: { clue: 2 } });
  });

  it('leaves investigators unplaced without a moveInvestigators step', () => {
    const command = compileSetup(contextWith(), makeDefinition(), makeSetupOptions());

    expect(command.investigators[0]?.locationId).toBeUndefined();
  });

  it('places a fixed number of tokens and adds to tokens already there', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: ['target'] },
        { kind: 'placeTokens', target: 'target', token: 'doom', amount: 1 },
        { kind: 'placeTokens', target: 'target', token: 'doom', amount: 2 },
      ],
    });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.cards[0]?.tokens).toEqual({ doom: 3 });
  });

  it('places tokens per investigator', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: ['target'] },
        { kind: 'placeTokens', target: 'target', token: 'clue', amount: perInvestigator(2) },
      ],
    });

    const command = compileSetup(
      contextWith(),
      def,
      makeSetupOptions({ investigators: investigators(3) }),
    );

    expect(command.cards[0]?.tokens).toEqual({ clue: 6 });
  });

  it('rejects a step that targets a card no earlier step created', () => {
    const def = makeDefinition({ setup: [{ kind: 'moveInvestigators', to: 'missing' }] });

    const rejection = rejectionOf(() => compileSetup(contextWith(), def, makeSetupOptions()));

    expect(rejection).toEqual({ code: 'setupTargetNotFound', cardCode: 'missing' });
  });

  it('rejects a step that targets a code with several instances', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: ['twin', 'twin'] },
        { kind: 'placeTokens', target: 'twin', token: 'doom', amount: 1 },
      ],
    });

    const rejection = rejectionOf(() => compileSetup(contextWith(), def, makeSetupOptions()));

    expect(rejection).toEqual({ code: 'setupTargetAmbiguous', cardCode: 'twin' });
  });
});

describe('compileSetup addMap', () => {
  it('adds several maps, visible unless stated otherwise', () => {
    const def = makeDefinition({
      setup: [
        mainMap(),
        { kind: 'addMap', mapId: mapId('dream'), name: 'Dream', visible: false, locations: [] },
      ],
    });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.maps).toEqual({
      main: { name: 'Main', visible: true, connections: [] },
      dream: { name: 'Dream', visible: false, connections: [] },
    });
  });

  it('puts its locations onto the map unrevealed unless face up', () => {
    const ctx = contextWith(makeCard({ code: 'b', typeCode: 'location' }));
    const def = makeDefinition({
      setup: [{ ...mainMap(), locations: [{ code: 'a' }, { code: 'b', faceUp: true }] }],
    });

    const command = compileSetup(ctx, def, makeSetupOptions());

    expect(command.cards).toEqual([
      { id: 'a#1', code: 'a', zone: { kind: 'location', mapId: main }, faceUp: false },
      { id: 'b#1', code: 'b', zone: { kind: 'location', mapId: main }, faceUp: true },
    ]);
  });

  it('places clues per investigator on a location put into play revealed', () => {
    const ctx = contextWith(
      makeCard({ code: 'loc', typeCode: 'location', clues: perInvestigator(2) }),
    );
    const def = makeDefinition({
      setup: [{ ...mainMap(), locations: [{ code: 'loc', faceUp: true }] }],
    });

    const command = compileSetup(ctx, def, makeSetupOptions({ investigators: investigators(2) }));

    expect(command.cards[0]?.tokens).toEqual({ clue: 4 });
  });

  it('places no clue tokens on a revealed location without clues', () => {
    const ctx = contextWith(
      makeCard({ code: 'loc', typeCode: 'location', clues: perInvestigator(0) }),
    );
    const def = makeDefinition({
      setup: [{ ...mainMap(), locations: [{ code: 'loc', faceUp: true }] }],
    });

    const command = compileSetup(ctx, def, makeSetupOptions());

    expect(command.cards[0]?.tokens).toBeUndefined();
  });

  it('connects its locations two-way by default and one-way on request', () => {
    const def = makeDefinition({
      setup: [
        {
          ...mainMap('a', 'b'),
          connections: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a', oneWay: true },
          ],
        },
      ],
    });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.maps?.[main]?.connections).toEqual([
      { from: 'a#1', to: 'b#1', oneWay: false },
      { from: 'b#1', to: 'a#1', oneWay: true },
    ]);
  });

  it('resolves connection codes among its own locations only', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: ['a'] },
        { ...mainMap('a', 'b'), connections: [{ from: 'a', to: 'b' }] },
      ],
    });

    const command = compileSetup(contextWith(), def, makeSetupOptions());

    expect(command.maps?.[main]?.connections).toEqual([{ from: 'a#2', to: 'b#1', oneWay: false }]);
  });

  it('rejects a connection to a location that is not on the map', () => {
    const def = makeDefinition({
      setup: [
        { kind: 'setAside', codes: ['b'] },
        { ...mainMap('a'), connections: [{ from: 'a', to: 'b' }] },
      ],
    });

    const rejection = rejectionOf(() => compileSetup(contextWith(), def, makeSetupOptions()));

    expect(rejection).toEqual({ code: 'setupTargetNotFound', cardCode: 'b' });
  });
});

describe('compileSetup buildEncounterDeck', () => {
  const ghoul = makeCard({ code: 'ghoul', typeCode: 'enemy', encounterCode: 'set1', quantity: 3 });
  const curse = makeCard({ code: 'curse', encounterCode: 'set1', quantity: 2 });
  const rat = makeCard({ code: 'rat', typeCode: 'enemy', encounterCode: 'set2' });
  const room = makeCard({ code: 'room', typeCode: 'location', encounterCode: 'set1' });
  const plan = makeCard({ code: 'plan', typeCode: 'agenda', encounterCode: 'set1' });
  const ctx = contextWith(ghoul, curse, rat, room, plan);

  function deckCodes(setup: SetupStep[]): string[] {
    const command = compileSetup(ctx, makeDefinition({ setup }), makeSetupOptions());
    return command.cards
      .filter((card) => card.zone.kind === 'encounterDeck')
      .map((card) => card.code);
  }

  it('adds every copy of the enemies and treacheries in the given sets', () => {
    const codes = deckCodes([{ kind: 'buildEncounterDeck', sets: ['set1', 'set2'] }]);

    expect(codes).toEqual(['ghoul', 'ghoul', 'ghoul', 'curse', 'curse', 'rat']);
  });

  it('leaves out copies that other steps put on the table, before or after the deck', () => {
    const codes = deckCodes([
      { kind: 'setAside', codes: ['ghoul'] },
      { kind: 'buildEncounterDeck', sets: ['set1'] },
      { kind: 'setAside', codes: ['curse', 'curse'] },
    ]);

    expect(codes).toEqual(['ghoul', 'ghoul']);
  });

  it('leaves out every copy of an excluded code', () => {
    const codes = deckCodes([{ kind: 'buildEncounterDeck', sets: ['set1'], exclude: ['ghoul'] }]);

    expect(codes).toEqual(['curse', 'curse']);
  });

  it('counts a card without a quantity as one copy', () => {
    const codes = deckCodes([{ kind: 'buildEncounterDeck', sets: ['set2'] }]);

    expect(codes).toEqual(['rat']);
  });

  it('rejects an encounter set without cards', () => {
    const def = makeDefinition({ setup: [{ kind: 'buildEncounterDeck', sets: ['typo'] }] });

    const rejection = rejectionOf(() => compileSetup(ctx, def, makeSetupOptions()));

    expect(rejection).toEqual({ code: 'unknownEncounterSet', encounterCode: 'typo' });
  });
});

describe('compileSetup campaign', () => {
  it('passes the campaign log through', () => {
    const campaign = { campaignId: 'c', entries: [], records: {} };

    const command = compileSetup(contextWith(), makeDefinition(), makeSetupOptions({ campaign }));

    expect(command.campaign).toBe(campaign);
  });
});

describe('referenceSide', () => {
  it.each([
    ['easy', 'easyStandard'],
    ['standard', 'easyStandard'],
    ['hard', 'hardExpert'],
    ['expert', 'hardExpert'],
  ] as const)('reads the %s difficulty from the %s side', (difficulty, side) => {
    expect(referenceSide(difficulty)).toBe(side);
  });
});

describe('compileMapStep', () => {
  const wing = mapId('wing');
  const ctx = contextWith(
    makeCard({ code: 'a', typeCode: 'location' }),
    makeCard({ code: 'b', typeCode: 'location' }),
  );

  /** A started scenario with location `a` on main and one set-aside copy per entry of `setAside`. */
  function startedWith(setAside: string[]) {
    const def = makeDefinition({ setup: [mainMap('a'), { kind: 'setAside', codes: setAside }] });
    return execute(ctx, emptyState(), compileSetup(ctx, def, makeSetupOptions())).state;
  }

  /** A step for the wing with the given locations and no connections. */
  function wingMap(...locations: AddMapStep['locations']): AddMapStep {
    return { kind: 'addMap', mapId: wing, name: 'Wing', locations };
  }

  it('takes the locations from outside play and resolves the connections among them', () => {
    const step: AddMapStep = {
      ...wingMap({ code: 'a' }, { code: 'b' }),
      connections: [{ from: 'a', to: 'b' }],
    };

    const commands = compileMapStep(startedWith(['a', 'b']), step);

    expect(commands).toEqual([
      {
        type: 'AddMap',
        mapId: wing,
        map: {
          name: 'Wing',
          visible: true,
          connections: [{ from: 'a#2', to: 'b#1', oneWay: false }],
        },
        locations: ['a#2', 'b#1'],
      },
    ]);
  });

  it('reveals a face-up location after adding the map', () => {
    const commands = compileMapStep(startedWith(['b']), wingMap({ code: 'b', faceUp: true }));

    expect(commands.map((command) => command.type)).toEqual(['AddMap', 'RevealLocation']);
    expect(commands[1]).toEqual({ type: 'RevealLocation', locationId: 'b#1' });
  });

  it.each([
    { name: 'only in play', location: 'a', setAside: [], code: 'setupTargetNotFound' },
    { name: 'set aside twice', location: 'b', setAside: ['b', 'b'], code: 'setupTargetAmbiguous' },
  ])('rejects a location that is $name', ({ location, setAside, code }) => {
    const state = startedWith(setAside);

    const rejection = rejectionOf(() => compileMapStep(state, wingMap({ code: location })));

    expect(rejection.code).toBe(code);
  });
});
