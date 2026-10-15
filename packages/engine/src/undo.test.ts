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
import { contextWith, makeCard, makeInvestigator } from '../test/utils';

/** A log entry as the store keeps it, reduced to what undo looks at. */
interface LogEntry {
  commandId: string;
  event: Event;
}

const ctx = contextWith(
  makeCard({ code: 'LOC', typeCode: 'location' }),
  makeCard({ code: 'TRE' }),
  makeCard({
    code: 'FOE',
    typeCode: 'enemy',
    fight: 2,
    evade: 2,
    health: { fixed: 2, perInvestigator: 0 },
  }),
);
const alice = investigatorId('alice');
const encounterDeck: Zone = { kind: 'encounterDeck' };

const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 7,
  investigators: [makeInvestigator({ id: 'alice', locationId: instanceId('a') })],
  maps: { [mapId('main')]: { name: 'main' } },
  shuffleEncounterDeck: false,
  cards: [
    { id: instanceId('a'), code: 'LOC', zone: { kind: 'location', mapId: mapId('main') } },
    { id: instanceId('d1'), code: 'TRE', zone: encounterDeck },
    { id: instanceId('d2'), code: 'FOE', zone: encounterDeck },
    { id: instanceId('d3'), code: 'TRE', zone: encounterDeck },
    { id: instanceId('s1'), code: 'TRE', zone: { kind: 'setAside' } },
    { id: instanceId('s2'), code: 'TRE', zone: { kind: 'setAside' } },
  ],
};

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };
const shuffleInto: Command = { type: 'ShuffleInto', codes: ['TRE', 'TRE'], zone: encounterDeck };
const addClue: Command = {
  type: 'ManualAdjust',
  adjustment: { kind: 'tokens', cardId: instanceId('d1'), token: 'clue', delta: 1 },
};
const moveToDiscard: Command = {
  type: 'ManualAdjust',
  adjustment: { kind: 'moveCard', cardId: instanceId('d3'), to: { kind: 'encounterDiscard' } },
};
const nextPhase: Command = { type: 'NextPhase' };
const pick: Decision = {
  id: decisionId('pick'),
  kind: 'chooseOption',
  prompt: 'decision.pick',
  decider: { kind: 'group' },
  options: [{ id: 'nothing', label: 'Nothing', commands: [] }],
};
const ask: Command = { type: 'RequestDecision', decision: pick };
const answer: Command = { type: 'ResolveDecision', decisionId: pick.id, optionId: 'nothing' };

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
    ['draws only', [draw, draw, draw]],
    ['token and move adjustments', [addClue, moveToDiscard, addClue]],
    ['a shuffle between draws', [draw, shuffleInto, draw]],
    ['phase changes with their steps', [nextPhase, nextPhase, draw]],
    ['a decision asked and answered', [ask, answer, draw]],
    ['every kind of command', [addClue, shuffleInto, draw, nextPhase, moveToDiscard, ask, answer]],
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

describe('undo and pending decisions', () => {
  // Undo is a store operation on the event log, not a command, so
  // `decisionPending` does not apply: the table can always take back the last step.
  it('removes the pending decision together with the group that raised it', () => {
    const { log, states } = play([ask]);

    const afterUndo = stateOf(undoLastGroup(log).kept);

    expect(states[1]?.pending).toHaveLength(1);
    expect(afterUndo.pending).toEqual([]);
  });

  it('brings the decision back when the answer is undone', () => {
    const { log, states } = play([ask, answer]);

    const afterUndo = stateOf(undoLastGroup(log).kept);

    expect(states[2]?.pending).toEqual([]);
    expect(afterUndo.pending).toEqual(states[1]?.pending);
  });

  it('accepts commands again after undoing the group that raised the decision', () => {
    const { log } = play([ask]);
    const afterUndo = stateOf(undoLastGroup(log).kept);

    expect(() => execute(ctx, afterUndo, draw)).not.toThrow();
  });
});
