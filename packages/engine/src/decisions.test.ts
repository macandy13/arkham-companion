import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkInvariants,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  skillTestDecision,
  type Command,
  type Decision,
  type DecisionKind,
  type EngineContext,
  type GameState,
  type Investigator,
  type Rejection,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  makeCard,
  makeInvestigator,
  rejectionOf as rejectionFrom,
  startBoard,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const id = instanceId;

const ctx = contextWith(
  makeCard({ code: 'LOC', name: 'Fake Place', typeCode: 'location' }),
  makeCard({ code: 'HNT', typeCode: 'enemy', keywords: [{ name: 'hunter' }] }),
  makeCard({
    code: 'SPN',
    typeCode: 'enemy',
    keywords: [{ name: 'spawn', detail: 'Fake Place' }],
  }),
  makeCard({ code: 'FOE', typeCode: 'enemy' }),
);

function investigator(who: typeof alice, location: string): Investigator {
  return makeInvestigator({
    id: who,
    seat: who === alice ? 0 : 1,
    locationId: id(location),
  });
}

/** Locations `a`, `b`, `c` where `a` connects to `b` and `c`; `enemies` as `[id, code, zone]`. */
function started(investigators: Investigator[], enemies: [string, string, Zone][]): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { a: 'LOC', b: 'LOC', c: 'LOC' },
        connections: [edge('a', 'b'), edge('a', 'c')],
      },
    },
    investigators,
    cards: Object.fromEntries(enemies.map(([enemyId, code, zone]) => [enemyId, { code, zone }])),
  });
}

const at = (place: string): Zone => ({ kind: 'atLocation', locationId: id(place) });

function rejectionOf(state: GameState, command: Command, context: EngineContext = ctx): Rejection {
  return rejectionFrom(() => execute(context, state, command));
}

function resolve(state: GameState, decision: string, option: string): GameState {
  return execute(ctx, state, {
    type: 'ResolveDecision',
    decisionId: decisionId(decision),
    optionId: option,
  }).state;
}

describe('hunter tie', () => {
  it('moves the hunter towards the investigator the players chose', () => {
    const state = started(
      [investigator(alice, 'b'), investigator(bob, 'c')],
      [['h', 'HNT', at('a')]],
    );
    const asked = execute(ctx, state, { type: 'MoveHunters' }).state;

    const after = resolve(asked, 'hunter:h:investigator', bob);

    expect(after.cards[id('h')]?.zone).toEqual({ kind: 'engaged', investigatorId: bob });
    expect(after.pending).toEqual([]);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('rejects a move to a location that is not connected to the hunter', () => {
    const state = started([investigator(alice, 'a')], [['h', 'HNT', at('b')]]);

    expect(rejectionOf(state, { type: 'MoveHunter', enemyId: id('h'), to: id('c') })).toEqual({
      code: 'hunterCannotMove',
      cardId: 'h',
      to: 'c',
    });
  });
});

describe('engagement choice', () => {
  it('engages the investigator the players chose', () => {
    const state = started(
      [investigator(alice, 'a'), investigator(bob, 'a')],
      [['e', 'FOE', at('a')]],
    );

    const after = resolve(state, 'engage:e', alice);

    expect(after.cards[id('e')]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
    expect(after.pending).toEqual([]);
  });

  it('asks the lead investigator', () => {
    const state = started(
      [investigator(alice, 'a'), investigator(bob, 'a')],
      [['e', 'FOE', at('a')]],
    );

    expect(state.pending[0]).toMatchObject({
      kind: 'chooseInvestigator',
      decider: { kind: 'lead' },
    });
  });
});

describe('spawn choice', () => {
  it('spawns the enemy at the location the players chose and engages there', () => {
    const state = started([investigator(alice, 'c')], [['e', 'SPN', { kind: 'setAside' }]]);
    const asked = execute(ctx, state, { type: 'SpawnEnemy', enemyId: id('e') }).state;

    const after = resolve(asked, 'spawn:e', 'c');

    expect(asked.pending[0]).toMatchObject({ kind: 'chooseLocation', subject: 'e' });
    expect(after.cards[id('e')]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
    expect(after.pending).toEqual([]);
  });
});

describe('pending decisions', () => {
  const choose: Decision = {
    id: decisionId('pick'),
    kind: 'chooseOption',
    prompt: 'decision.pick',
    decider: { kind: 'group' },
    options: [
      { id: 'gain', label: 'Gain a resource', commands: [adjust(alice, 'resources', 1)] },
      { id: 'nothing', label: 'Nothing', commands: [] },
    ],
  };
  let asked: GameState;
  beforeEach(() => {
    const state = started([investigator(alice, 'a')], []);
    asked = execute(ctx, state, { type: 'RequestDecision', decision: choose }).state;
  });

  it('rejects other commands', () => {
    expect(rejectionOf(asked, { type: 'PlaceDoom', cardId: id('a'), amount: 1 })).toEqual({
      code: 'decisionPending',
      decisionId: 'pick',
    });
  });

  it('allows manual adjustments', () => {
    const { state } = execute(ctx, asked, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: id('a'), token: 'clue', delta: 1 },
    });

    expect(state.cards[id('a')]?.tokens.clue).toBe(1);
    expect(state.pending).toHaveLength(1);
  });

  it('runs the commands of the chosen option and clears the decision in one event list', () => {
    const { state, events } = execute(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: choose.id,
      optionId: 'gain',
    });

    expect(events.map((e) => e.type)).toEqual(['DecisionResolved', 'InvestigatorChanged']);
    expect(state.investigators[0]?.resources).toBe(6);
    expect(state.pending).toEqual([]);
  });

  it('runs nothing for an option without commands', () => {
    const { events } = execute(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: choose.id,
      optionId: 'nothing',
    });

    expect(events.map((e) => e.type)).toEqual(['DecisionResolved']);
  });

  it('rejects an unknown decision', () => {
    expect(
      rejectionOf(asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('nope'),
        optionId: 'x',
      }),
    ).toEqual({ code: 'unknownDecision', decisionId: 'nope' });
  });

  it('rejects an unknown option', () => {
    expect(
      rejectionOf(asked, { type: 'ResolveDecision', decisionId: choose.id, optionId: 'x' }),
    ).toEqual({ code: 'unknownOption', decisionId: 'pick', optionId: 'x' });
  });

  it('keeps the decision when a consequence is rejected', () => {
    const failing: Decision = {
      ...choose,
      id: decisionId('failing'),
      options: [{ id: 'bad', label: 'Bad', commands: [adjust(alice, 'resources', -6)] }],
    };
    const state = execute(ctx, started([investigator(alice, 'a')], []), {
      type: 'RequestDecision',
      decision: failing,
    }).state;

    expect(
      rejectionOf(state, { type: 'ResolveDecision', decisionId: failing.id, optionId: 'bad' }),
    ).toMatchObject({ code: 'triggeredCommandRejected', command: 'AdjustInvestigator' });
    expect(state.pending).toHaveLength(1);
  });

  it('rejects a decision requested from outside while another is pending', () => {
    expect(rejectionOf(asked, { type: 'RequestDecision', decision: choose })).toEqual({
      code: 'decisionPending',
      decisionId: 'pick',
    });
  });

  it('rejects a decision without options or with repeated option ids', () => {
    const state = started([investigator(alice, 'a')], []);
    const none = { ...choose, options: [] };
    const twice = { ...choose, options: [choose.options[0]!, choose.options[0]!] };

    expect(
      [none, twice].map((decision) => rejectionOf(state, { type: 'RequestDecision', decision })),
    ).toEqual([
      { code: 'invalidDecisionOptions', decisionId: 'pick' },
      { code: 'invalidDecisionOptions', decisionId: 'pick' },
    ]);
  });
});

describe('skill test result', () => {
  const test = { skill: 'intellect', difficulty: 3 } as const;
  const decision = skillTestDecision(
    { id: decisionId('test'), prompt: 'decision.skillTest', decider: { kind: 'lead' }, test },
    {
      onPass: [{ type: 'DiscoverClues', investigatorId: alice, locationId: id('b'), amount: 1 }],
      onFail: [adjust(alice, 'horror', 1)],
      failedBy: { 2: [adjust(alice, 'horror', 2)] },
    },
  );
  let asked: GameState;
  beforeEach(() => {
    const state = execute(ctx, started([investigator(alice, 'b')], []), {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: id('b'), token: 'clue', delta: 2 },
    }).state;
    asked = execute(ctx, state, { type: 'RequestDecision', decision }).state;
  });

  it('describes the test to resolve', () => {
    expect(asked.pending[0]).toMatchObject({ kind: 'skillTestResult', skillTest: test });
  });

  it('applies the pass consequence', () => {
    const after = resolve(asked, 'test', 'pass');

    expect(after.investigators[0]?.clues).toBe(1);
    expect(after.cards[id('b')]?.tokens.clue).toBe(1);
  });

  it('applies the fail consequence', () => {
    const after = resolve(asked, 'test', 'fail');

    expect(after.investigators[0]?.sanity.horror).toBe(1);
    expect(after.investigators[0]?.clues).toBe(0);
  });

  it('applies the consequence for the margin it failed by', () => {
    const after = resolve(asked, 'test', 'failedBy:2');

    expect(after.investigators[0]?.sanity.horror).toBe(2);
  });
});

describe('decisions raised by hooks', () => {
  it('lets a scenario hook ask the players after doom is placed', () => {
    const hooked: EngineContext = {
      ...ctx,
      hooks: {
        afterDoomPlaced: () => [
          {
            type: 'RequestDecision',
            decision: {
              id: decisionId('doomChoice'),
              kind: 'confirm',
              prompt: 'decision.applyForcedEffect',
              decider: { kind: 'lead' },
              options: [
                { id: 'yes', label: 'decision.yes', commands: [adjust(alice, 'resources', 1)] },
                { id: 'no', label: 'decision.no', commands: [] },
              ],
            },
          },
        ],
      },
    };
    const state = started([investigator(alice, 'a')], []);

    const { state: asked } = execute(hooked, state, {
      type: 'PlaceDoom',
      cardId: id('a'),
      amount: 1,
    });

    expect(asked.pending.map((d) => d.id)).toEqual(['doomChoice']);
  });
});

describe('duplicate decisions from hooks', () => {
  it('rejects a hook that raises the same decision twice', () => {
    const request: Command = {
      type: 'RequestDecision',
      decision: {
        id: decisionId('twice'),
        kind: 'confirm',
        prompt: 'decision.twice',
        decider: { kind: 'group' },
        options: [{ id: 'ok', label: 'decision.ok', commands: [] }],
      },
    };
    const hooked: EngineContext = { ...ctx, hooks: { afterDoomPlaced: () => [request, request] } };
    const state = started([investigator(alice, 'a')], []);

    const placeDoom: Command = { type: 'PlaceDoom', cardId: id('a'), amount: 1 };

    expect(() => execute(hooked, state, placeDoom)).toThrow(/already pending/);
  });
});

describe('pending decision invariants', () => {
  const gainResource = adjust(alice, 'resources', 1);
  const decisionOf = (kind: DecisionKind, optionCount: number, commands: Command[]): Decision => ({
    id: decisionId('random'),
    kind,
    prompt: 'decision.random',
    decider: { kind: 'lead' },
    options: Array.from({ length: optionCount }, (_, i) => ({
      id: `o${i}`,
      label: `Option ${i}`,
      commands,
    })),
  });
  const decisions = [
    { name: 'a confirm with one option and no commands', decision: decisionOf('confirm', 1, []) },
    { name: 'a location choice with two options', decision: decisionOf('chooseLocation', 2, []) },
    {
      name: 'an option choice whose options change state',
      decision: decisionOf('chooseOption', 4, [gainResource]),
    },
    {
      name: 'a skill test result with consequences',
      decision: decisionOf('skillTestResult', 3, [gainResource]),
    },
  ];
  const blocked: Command[] = [
    { type: 'PlaceDoom', cardId: id('a'), amount: 1 },
    { type: 'MoveHunters' },
    { type: 'DrawEncounter', investigatorId: alice },
    gainResource,
    { type: 'RevealLocation', locationId: id('a') },
    { type: 'AdvanceAgenda' },
  ];

  it.each(decisions)('keeps $name pending when another command is rejected', ({ decision }) => {
    const asked = execute(ctx, started([investigator(alice, 'a')], []), {
      type: 'RequestDecision',
      decision,
    }).state;

    const rejections = blocked.map((command) => rejectionOf(asked, command).code);

    expect(rejections).toEqual(blocked.map(() => 'decisionPending'));
    expect(asked.pending).toEqual([decision]);
  });

  it.each(decisions)('clears $name whichever option resolves it', ({ decision }) => {
    const asked = execute(ctx, started([investigator(alice, 'a')], []), {
      type: 'RequestDecision',
      decision,
    }).state;

    const results = decision.options.map((option) => resolve(asked, 'random', option.id));

    expect(results.map((state) => state.pending)).toEqual(decision.options.map(() => []));
    expect(results.flatMap((state) => checkInvariants(state))).toEqual([]);
  });
});

function adjust(who: typeof alice, stat: 'resources' | 'horror', delta: number): Command {
  return { type: 'AdjustInvestigator', investigatorId: who, stat, delta };
}
