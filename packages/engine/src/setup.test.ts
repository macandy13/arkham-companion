import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardDbFrom,
  compileSetup,
  investigatorId,
  mapId,
  type CardStats,
  type EngineContext,
  type Investigator,
  type Rejection,
  type ScenarioDefinition,
  type SetupOptions,
  type SetupStep,
} from './index';

const main = mapId('main');

/** A card definition with boring defaults; tests pass only the fields they assert on. */
function makeCard(overrides: Partial<CardStats> & { code: string }): CardStats {
  return { name: overrides.code, typeCode: 'treachery', traits: [], ...overrides };
}

function makeInvestigator(id: string): Investigator {
  return {
    id: investigatorId(id),
    code: id,
    name: id,
    seat: 0,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
    clues: 0,
    resources: 5,
    status: 'active',
  };
}

/** A definition with no agendas, acts or chaos tokens, so only `setup` matters. */
function makeDefinition(setup: SetupStep[], overrides: Partial<ScenarioDefinition> = {}) {
  const def: ScenarioDefinition = {
    id: 'test',
    chaosBag: { easy: [], standard: [], hard: [], expert: [] },
    agendaDeck: [],
    actDeck: [],
    setup,
    ...overrides,
  };
  return def;
}

function makeOptions(overrides: Partial<SetupOptions> = {}): SetupOptions {
  return {
    difficulty: 'standard',
    seed: 1,
    investigators: [makeInvestigator('inv1')],
    ...overrides,
  };
}

function contextWith(...cards: CardStats[]): EngineContext {
  return { cards: cardDbFrom(cards) };
}

/** The structured rejection `fn` throws (fails the test if it does not throw one). */
function rejectionOf(fn: () => unknown): Rejection {
  try {
    fn();
  } catch (e) {
    if (e instanceof CommandRejected) return e.rejection;
    throw e;
  }
  throw new Error('expected CommandRejected');
}

const addMain: SetupStep = { kind: 'addMap', mapId: main, name: 'Main' };

describe('compileSetup', () => {
  it('copies identity, difficulty, seed and the chaos bag for the difficulty', () => {
    const def = makeDefinition([], {
      id: 'demo',
      chaosBag: { easy: ['+1'], standard: [], hard: ['-4', 'skull'], expert: [] },
    });

    const command = compileSetup(contextWith(), def, makeOptions({ difficulty: 'hard', seed: 42 }));

    expect(command).toMatchObject({
      type: 'StartScenario',
      scenarioId: 'demo',
      difficulty: 'hard',
      seed: 42,
      chaosBag: ['-4', 'skull'],
    });
  });

  it('puts agendas and acts into their decks in order, side a up', () => {
    const def = makeDefinition([], { agendaDeck: ['ag1', 'ag2'], actDeck: ['act1'] });

    const command = compileSetup(contextWith(), def, makeOptions());

    expect(command.cards).toEqual([
      { id: 'ag1#1', code: 'ag1', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: 'ag2#1', code: 'ag2', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: 'act1#1', code: 'act1', zone: { kind: 'actDeck' }, faceUp: true },
    ]);
  });

  it('adds maps', () => {
    const def = makeDefinition([
      addMain,
      { kind: 'addMap', mapId: mapId('dream'), name: 'Dream', visible: false },
    ]);

    const command = compileSetup(contextWith(), def, makeOptions());

    expect(command.maps).toEqual({
      main: { name: 'Main', visible: true },
      dream: { name: 'Dream', visible: false },
    });
  });

  it('puts locations into play unrevealed by default', () => {
    const ctx = contextWith(
      makeCard({ code: 'loc', typeCode: 'location', clues: { fixed: 0, perInvestigator: 2 } }),
    );
    const def = makeDefinition([addMain, { kind: 'putIntoPlay', code: 'loc', mapId: main }]);

    const command = compileSetup(ctx, def, makeOptions());

    expect(command.cards).toEqual([
      { id: 'loc#1', code: 'loc', zone: { kind: 'location', mapId: main }, faceUp: false },
    ]);
  });

  it('places clues per investigator on a location put into play revealed', () => {
    const ctx = contextWith(
      makeCard({ code: 'loc', typeCode: 'location', clues: { fixed: 0, perInvestigator: 2 } }),
    );
    const def = makeDefinition([
      addMain,
      { kind: 'putIntoPlay', code: 'loc', mapId: main, faceUp: true },
    ]);
    const investigators = [makeInvestigator('a'), makeInvestigator('b')];

    const command = compileSetup(ctx, def, makeOptions({ investigators }));

    expect(command.cards[0]?.tokens).toEqual({ clue: 4 });
  });

  it('places no clue tokens on a revealed location without clues', () => {
    const ctx = contextWith(
      makeCard({ code: 'loc', typeCode: 'location', clues: { fixed: 0, perInvestigator: 0 } }),
    );
    const def = makeDefinition([
      addMain,
      { kind: 'putIntoPlay', code: 'loc', mapId: main, faceUp: true },
    ]);

    const command = compileSetup(ctx, def, makeOptions());

    expect(command.cards[0]?.tokens).toBeUndefined();
  });

  it('sets cards aside and numbers copies of the same code', () => {
    const def = makeDefinition([{ kind: 'setAside', codes: ['x', 'x', 'y'] }]);

    const command = compileSetup(contextWith(), def, makeOptions());

    expect(command.cards.map((c) => [c.id, c.zone.kind])).toEqual([
      ['x#1', 'setAside'],
      ['x#2', 'setAside'],
      ['y#1', 'setAside'],
    ]);
  });

  it('spawns an enemy at a location', () => {
    const def = makeDefinition([
      addMain,
      { kind: 'putIntoPlay', code: 'loc', mapId: main },
      { kind: 'spawn', code: 'enemy', at: 'loc' },
    ]);

    const command = compileSetup(contextWith(), def, makeOptions());

    expect(command.cards[1]).toEqual({
      id: 'enemy#1',
      code: 'enemy',
      zone: { kind: 'atLocation', locationId: 'loc#1' },
      faceUp: true,
    });
  });

  it('places investigators at a location and reveals it with its clues', () => {
    const ctx = contextWith(
      makeCard({ code: 'start', typeCode: 'location', clues: { fixed: 0, perInvestigator: 1 } }),
    );
    const def = makeDefinition([
      addMain,
      { kind: 'putIntoPlay', code: 'start', mapId: main },
      { kind: 'moveInvestigators', to: 'start' },
    ]);
    const investigators = [makeInvestigator('a'), makeInvestigator('b')];

    const command = compileSetup(ctx, def, makeOptions({ investigators }));

    expect(command.investigators.map((inv) => inv.locationId)).toEqual(['start#1', 'start#1']);
    expect(command.cards[0]).toMatchObject({ faceUp: true, tokens: { clue: 2 } });
  });

  it('leaves investigators unplaced without a moveInvestigators step', () => {
    const command = compileSetup(contextWith(), makeDefinition([]), makeOptions());

    expect(command.investigators[0]?.locationId).toBeUndefined();
  });

  it('adds two-way and one-way connections between locations', () => {
    const def = makeDefinition([
      addMain,
      { kind: 'putIntoPlay', code: 'a', mapId: main },
      { kind: 'putIntoPlay', code: 'b', mapId: main },
      { kind: 'addConnection', from: 'a', to: 'b' },
      { kind: 'addConnection', from: 'b', to: 'a', oneWay: true },
    ]);

    const command = compileSetup(contextWith(), def, makeOptions());

    expect(command.connections).toEqual([
      { from: 'a#1', to: 'b#1', oneWay: false },
      { from: 'b#1', to: 'a#1', oneWay: true },
    ]);
  });

  it('places a fixed number of tokens and adds to tokens already there', () => {
    const def = makeDefinition([
      { kind: 'setAside', codes: ['target'] },
      { kind: 'placeTokens', target: 'target', token: 'doom', amount: 1 },
      { kind: 'placeTokens', target: 'target', token: 'doom', amount: 2 },
    ]);

    const command = compileSetup(contextWith(), def, makeOptions());

    expect(command.cards[0]?.tokens).toEqual({ doom: 3 });
  });

  it('places tokens per investigator', () => {
    const def = makeDefinition([
      { kind: 'setAside', codes: ['target'] },
      {
        kind: 'placeTokens',
        target: 'target',
        token: 'clue',
        amount: { fixed: 0, perInvestigator: 2 },
      },
    ]);
    const investigators = [makeInvestigator('a'), makeInvestigator('b'), makeInvestigator('c')];

    const command = compileSetup(contextWith(), def, makeOptions({ investigators }));

    expect(command.cards[0]?.tokens).toEqual({ clue: 6 });
  });

  it('rejects a step that targets a card no earlier step created', () => {
    const def = makeDefinition([{ kind: 'moveInvestigators', to: 'missing' }]);

    const rejection = rejectionOf(() => compileSetup(contextWith(), def, makeOptions()));

    expect(rejection).toEqual({ code: 'setupTargetNotFound', cardCode: 'missing' });
  });

  it('rejects a step that targets a code with several instances', () => {
    const def = makeDefinition([
      { kind: 'setAside', codes: ['twin', 'twin'] },
      { kind: 'placeTokens', target: 'twin', token: 'doom', amount: 1 },
    ]);

    const rejection = rejectionOf(() => compileSetup(contextWith(), def, makeOptions()));

    expect(rejection).toEqual({ code: 'setupTargetAmbiguous', cardCode: 'twin' });
  });
});

describe('compileSetup buildEncounterDeck', () => {
  const ghoul = makeCard({ code: 'ghoul', typeCode: 'enemy', encounterCode: 'set1', quantity: 3 });
  const curse = makeCard({ code: 'curse', encounterCode: 'set1', quantity: 2 });
  const rat = makeCard({ code: 'rat', typeCode: 'enemy', encounterCode: 'set2' });
  const room = makeCard({ code: 'room', typeCode: 'location', encounterCode: 'set1' });
  const plan = makeCard({ code: 'plan', typeCode: 'agenda', encounterCode: 'set1' });
  const ctx = contextWith(ghoul, curse, rat, room, plan);

  function deckCodes(steps: SetupStep[]): string[] {
    const command = compileSetup(ctx, makeDefinition(steps), makeOptions());
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
    const def = makeDefinition([{ kind: 'buildEncounterDeck', sets: ['typo'] }]);

    const rejection = rejectionOf(() => compileSetup(ctx, def, makeOptions()));

    expect(rejection).toEqual({ code: 'unknownEncounterSet', encounterCode: 'typo' });
  });
});

describe('compileSetup campaign', () => {
  it('passes the campaign log through', () => {
    const campaign = { campaignId: 'c', entries: [], records: {} };

    const command = compileSetup(contextWith(), makeDefinition([]), makeOptions({ campaign }));

    expect(command.campaign).toBe(campaign);
  });
});
