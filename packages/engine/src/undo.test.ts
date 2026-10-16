import { describe, expect, it } from 'vitest';
import {
  decisionId,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  replay,
  undoLastGroup,
  type Command,
  type Decision,
  type Event,
  type GameState,
  type StartScenario,
  type Zone,
} from './index';
import { contextWith, edge, makeCard, makeInvestigator } from '../test/utils';

/** A log entry as the store keeps it, reduced to what undo looks at. */
interface LogEntry {
  commandId: string;
  event: Event;
}

const ctx = contextWith(
  makeCard({ code: 'hall', name: 'Hall', typeCode: 'location' }),
  makeCard({ code: 'cellar', name: 'Cellar', typeCode: 'location' }),
  makeCard({ code: 'plain_treachery' }),
  makeCard({ code: 'chilling_treachery', revelationTest: { skill: 'willpower', difficulty: 4 } }),
);
const alice = investigatorId('alice');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const chill = instanceId('chill');
const firstPlain = instanceId('first_plain');
const encounterDeck: Zone = { kind: 'encounterDeck' };
const setAside: Zone = { kind: 'setAside' };

/**
 * Alice in the hall next to the cellar; the encounter deck holds the chilling
 * treachery (a willpower 4 revelation test) above two plain treacheries, and
 * two more plain ones are set aside for `shuffleInto`.
 */
const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 7,
  investigators: [makeInvestigator({ id: 'alice', locationId: hall })],
  maps: { [mapId('main')]: { name: 'main', connections: [edge('hall', 'cellar')] } },
  shuffleEncounterDeck: false,
  cards: [
    { id: hall, code: 'hall', zone: { kind: 'location', mapId: mapId('main') } },
    { id: cellar, code: 'cellar', zone: { kind: 'location', mapId: mapId('main') } },
    { id: chill, code: 'chilling_treachery', zone: encounterDeck },
    { id: firstPlain, code: 'plain_treachery', zone: encounterDeck },
    { id: instanceId('second_plain'), code: 'plain_treachery', zone: encounterDeck },
    { id: instanceId('spare_one'), code: 'plain_treachery', zone: setAside },
    { id: instanceId('spare_two'), code: 'plain_treachery', zone: setAside },
  ],
};

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };
const shuffleInto: Command = {
  type: 'ShuffleInto',
  codes: ['plain_treachery', 'plain_treachery'],
  zone: encounterDeck,
};
const addClue: Command = {
  type: 'ManualAdjust',
  adjustment: { kind: 'tokens', cardId: hall, token: 'clue', delta: 1 },
};
const moveFirstPlainToDiscard: Command = {
  type: 'ManualAdjust',
  adjustment: { kind: 'moveCard', cardId: firstPlain, to: { kind: 'encounterDiscard' } },
};
const revealHall: Command = { type: 'RevealLocation', locationId: hall };
const nextPhase: Command = { type: 'NextPhase' };
const startTurn: Command = { type: 'StartTurn', investigatorId: alice };
const endTurn: Command = { type: 'EndTurn', investigatorId: alice };
const moveToCellar: Command = { type: 'MoveInvestigator', investigatorId: alice, to: cellar };
const spendAction: Command = { type: 'AdjustActions', investigatorId: alice, delta: -1 };
const passChillTest: Command = {
  type: 'ResolveDecision',
  decisionId: decisionId('revelation:chill'),
  optionId: 'pass',
};
const pick: Decision = {
  id: decisionId('pick'),
  kind: 'chooseOption',
  prompt: 'decision.pick',
  decider: { kind: 'group' },
  options: [{ id: 'nothing', label: 'Nothing', commands: [] }],
};
const ask: Command = { type: 'RequestDecision', decision: pick };
const answer: Command = { type: 'ResolveDecision', decisionId: pick.id, optionId: 'nothing' };

/** Round 1's investigation phase, in which alice may start her turn. */
const intoInvestigation: Command[] = [revealHall, nextPhase];

/**
 * Executes the start and then `commands`, one `execute` per group like the
 * store appends them. Returns the log and the state after each group
 * (index 0 = after the start).
 */
function play(commands: readonly Command[]): { log: LogEntry[]; states: GameState[] } {
  let state = emptyState();
  const states: GameState[] = [];
  const log: LogEntry[] = [];
  for (const [i, command] of [start, ...commands].entries()) {
    const result = execute(ctx, state, command);
    state = result.state;
    states.push(state);
    log.push(...result.events.map((event) => ({ commandId: `cmd-${i}`, event })));
  }
  return { log, states };
}

/** The state a client has after loading `log`: a replay of its events. */
function stateOf(log: readonly LogEntry[]): GameState {
  return replay(log.map((entry) => entry.event));
}

/** The state after playing `commands` and undoing the last group. */
function afterUndoOf(commands: readonly Command[]): GameState {
  return stateOf(undoLastGroup(play(commands).log).kept);
}

describe('undoLastGroup', () => {
  it('removes only the trailing run of one commandId', () => {
    const log = [
      { commandId: 'a', n: 1 },
      { commandId: 'b', n: 2 },
      { commandId: 'b', n: 3 },
    ];

    expect(undoLastGroup(log)).toEqual({ kept: [log[0]], removed: [log[1], log[2]] });
  });

  it('removes everything when the log is a single group', () => {
    const log = [{ commandId: 'a' }, { commandId: 'a' }];

    expect(undoLastGroup(log)).toEqual({ kept: [], removed: log });
  });

  it('treats an empty log as nothing to undo', () => {
    expect(undoLastGroup([])).toEqual({ kept: [], removed: [] });
  });

  it('does not merge a later group with an earlier group of the same id', () => {
    const log = [{ commandId: 'a' }, { commandId: 'b' }, { commandId: 'a' }];

    expect(undoLastGroup(log).removed).toEqual([log[2]]);
  });
});

describe('undo with the seeded RNG', () => {
  it('redoing an undone shuffle yields the same events and state', () => {
    const { log, states } = play([shuffleInto]);
    const { kept, removed } = undoLastGroup(log);

    const redo = execute(ctx, stateOf(kept), shuffleInto);

    expect(stateOf(kept)).toEqual(states[0]);
    expect(redo.state).toEqual(states[1]);
    expect(redo.events).toEqual(removed.map((entry) => entry.event));
  });

  it('removes all events of a multi-event command as one group', () => {
    const { log } = play([shuffleInto]);

    const { removed } = undoLastGroup(log);

    expect(removed.length).toBeGreaterThan(1);
    expect(removed.every((entry) => entry.commandId === 'cmd-1')).toBe(true);
  });
});

describe('undoing group by group', () => {
  it.each<[string, Command[]]>([
    ['draws and a revelation test', [draw, passChillTest, draw, draw]],
    ['token and move adjustments', [addClue, moveFirstPlainToDiscard, addClue]],
    ['a shuffle between draws', [draw, passChillTest, shuffleInto, draw]],
    ['phase changes with their steps', [...intoInvestigation, startTurn, endTurn, nextPhase]],
    [
      'a turn with a move and the players counting it',
      [...intoInvestigation, startTurn, moveToCellar, spendAction, endTurn],
    ],
    ['a revelation test answered', [draw, passChillTest, draw]],
    ['a decision asked and answered', [ask, answer, draw]],
    [
      'every kind of command',
      [
        addClue,
        draw,
        passChillTest,
        shuffleInto,
        ...intoInvestigation,
        startTurn,
        moveToCellar,
        moveFirstPlainToDiscard,
        ask,
        answer,
      ],
    ],
  ])('walks back through every earlier state to the empty one (%s)', (_name, commands) => {
    const { log: played, states } = play(commands);
    let log = played;

    for (let step = states.length - 2; step >= 0; step--) {
      log = undoLastGroup(log).kept;
      expect(stateOf(log)).toEqual(states[step]);
    }
    log = undoLastGroup(log).kept;

    expect(log).toEqual([]);
    expect(stateOf(log)).toEqual(emptyState());
  });
});

describe('undo and the turn', () => {
  it('restores the counter when an AdjustActions is undone', () => {
    const commands = [...intoInvestigation, startTurn, spendAction];
    const spent = play(commands).states.at(-1)!;

    const afterUndo = afterUndoOf(commands);

    expect(spent.investigators[0]?.actionsRemaining).toBe(2);
    expect(afterUndo.investigators[0]?.actionsRemaining).toBe(3);
  });

  it('puts the investigator back when a move taken mid-turn is undone', () => {
    const afterUndo = afterUndoOf([...intoInvestigation, startTurn, moveToCellar]);

    expect(afterUndo.investigators[0]?.locationId).toBe(hall);
    expect(afterUndo.meta.turn).toEqual({ investigatorId: alice });
  });

  it('reopens the turn when ending it is undone', () => {
    const commands = [...intoInvestigation, startTurn, moveToCellar, endTurn];
    const ended = play(commands).states.at(-1)!;

    const afterUndo = afterUndoOf(commands);

    expect(ended.meta.turn).toBeUndefined();
    expect(ended.meta.turnsTaken).toEqual([alice]);
    expect(afterUndo.meta.turn).toEqual({ investigatorId: alice });
    expect(afterUndo.meta.turnsTaken).toEqual([]);
  });

  it('takes back the start of the turn', () => {
    const afterUndo = afterUndoOf([...intoInvestigation, startTurn]);

    expect(afterUndo.meta.turn).toBeUndefined();
    expect(afterUndo.meta.phase).toBe('investigation');
  });
});

describe('undo and a revelation test', () => {
  it('puts the treachery back in the resolving zone with its decision pending', () => {
    const commands = [draw, passChillTest];
    const answered = play(commands).states.at(-1)!;

    const afterUndo = afterUndoOf(commands);

    expect(answered.cards[chill]?.zone).toEqual({ kind: 'encounterDiscard' });
    expect(afterUndo.cards[chill]?.zone).toEqual({ kind: 'resolving' });
    expect(afterUndo.pending.map((decision) => decision.id)).toEqual(['revelation:chill']);
  });

  it('puts the treachery back on the encounter deck when the draw is undone', () => {
    const afterUndo = afterUndoOf([draw]);

    expect(afterUndo.cards[chill]?.zone).toEqual(encounterDeck);
    expect(afterUndo.pending).toEqual([]);
  });
});

describe('undo and pending decisions', () => {
  // Undo is a store operation on the event log, not a command, so
  // `decisionPending` does not apply: the table can always take back the last step.
  it('removes the pending decision together with the group that raised it', () => {
    const { states } = play([ask]);

    const afterUndo = afterUndoOf([ask]);

    expect(states[1]?.pending).toHaveLength(1);
    expect(afterUndo.pending).toEqual([]);
  });

  it('brings the decision back when the answer is undone', () => {
    const { states } = play([ask, answer]);

    const afterUndo = afterUndoOf([ask, answer]);

    expect(states[2]?.pending).toEqual([]);
    expect(afterUndo.pending).toEqual(states[1]?.pending);
  });

  it('accepts commands again after undoing the group that raised the decision', () => {
    const afterUndo = afterUndoOf([ask]);

    expect(() => execute(ctx, afterUndo, draw)).not.toThrow();
  });
});

describe('the events of one command form one group', () => {
  /** The event types of the last group of `commands`, as undo would remove them. */
  function lastGroupTypes(commands: readonly Command[]): string[] {
    return undoLastGroup(play(commands).log).removed.map((entry) => entry.event.type);
  }

  it('keeps a move and the reveal of its destination in one group', () => {
    expect(lastGroupTypes([...intoInvestigation, startTurn, moveToCellar])).toEqual([
      'InvestigatorMoved',
      'CardFlipped',
    ]);
  });

  it('keeps TurnStarted in the group of StartTurn', () => {
    expect(lastGroupTypes([...intoInvestigation, startTurn])).toEqual(['TurnStarted']);
  });

  it('keeps ActionsAdjusted in the group of AdjustActions', () => {
    expect(lastGroupTypes([...intoInvestigation, startTurn, spendAction])).toEqual([
      'ActionsAdjusted',
    ]);
  });
});
