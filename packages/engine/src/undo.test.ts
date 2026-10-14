import { describe, expect, it } from 'vitest';
import {
  emptyState,
  execute,
  investigatorId,
  mapId,
  replay,
  undoLastGroup,
  type Command,
  type Event,
  type GameState,
  type StartScenario,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

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
  const start: StartScenario = {
    type: 'StartScenario',
    scenarioId: 'undo',
    difficulty: 'standard',
    seed: 99,
    investigators: [
      {
        id: investigatorId('i1'),
        code: 'inv',
        name: 'Tester',
        seat: 0,
        health: { max: 8, damage: 0 },
        sanity: { max: 8, horror: 0 },
        clues: 0,
        resources: 5,
        doomOnPlayerCards: 0,
        status: 'active',
      },
    ],
    maps: { [mapId('m')]: { name: 'Map' } },
    shuffleEncounterDeck: false,
    cards: [
      { code: 'E3', zone: { kind: 'encounterDeck' } },
      { code: 'E3', zone: { kind: 'encounterDeck' } },
      { code: 'E3', zone: { kind: 'encounterDeck' } },
      { code: 'E3', zone: { kind: 'encounterDeck' } },
      { code: 'E4', zone: { kind: 'setAside' } },
      { code: 'E4', zone: { kind: 'setAside' } },
    ],
  };
  const shuffleInto: Command = {
    type: 'ShuffleInto',
    codes: ['E4', 'E4'],
    zone: { kind: 'encounterDeck' },
  };

  it('redoing an undone shuffle yields the same events and state', () => {
    const begun = execute(sandboxContext, emptyState(), start);
    const first = execute(sandboxContext, begun.state, shuffleInto);
    const log: { commandId: string; event: Event }[] = [
      ...begun.events.map((event) => ({ commandId: 'start', event })),
      ...first.events.map((event) => ({ commandId: 'shuffle', event })),
    ];

    const afterUndo: GameState = replay(undoLastGroup(log).kept.map((e) => e.event));
    const redo = execute(sandboxContext, afterUndo, shuffleInto);

    expect(afterUndo).toEqual(begun.state);
    expect(redo.events).toEqual(first.events);
    expect(redo.state).toEqual(first.state);
  });

  it('removes all events of a multi-event command as one group', () => {
    const begun = execute(sandboxContext, emptyState(), start);
    const shuffle = execute(sandboxContext, begun.state, shuffleInto);
    const log: { commandId: string; event: Event }[] = [
      ...begun.events.map((event) => ({ commandId: 'start', event })),
      ...shuffle.events.map((event) => ({ commandId: 'shuffle', event })),
    ];

    expect(shuffle.events.length).toBeGreaterThan(1);
    expect(undoLastGroup(log).removed).toHaveLength(shuffle.events.length);
  });
});
