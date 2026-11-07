import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { cardName, instanceId, type LoggedEvent } from '@arkham/engine';
import { playRun, type Run } from '@arkham/play_tester';
import { theGathering } from '@arkham/scenarios';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { logDifference, webReplayDifference } from './webReplay';

describe('replaying a play tester run through the app', () => {
  /** A chaos bot game of The Gathering for Roland Banks whose first 80 steps include undos. */
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [cardName('Roland Banks')],
    blanks: [],
    gameSeed: 24,
    bot: 'chaos',
    botSeed: 1,
  };
  const { steps } = playRun(run, { stepCap: 80 });

  it('logs what the table logs, through storage and an export and import', async () => {
    expect(steps).toContainEqual({ verb: 'undo' });
    expect(await webReplayDifference(new IndexedDbStore('web-replay'), run, steps)).toBeUndefined();
  });
});

describe('comparing two logs', () => {
  const doomOnAgenda: LoggedEvent['event'] = {
    type: 'TokensChanged',
    cardId: instanceId('agenda'),
    token: 'doom',
    delta: 1,
  };
  const clueOnStudy: LoggedEvent['event'] = {
    type: 'TokensChanged',
    cardId: instanceId('study'),
    token: 'clue',
    delta: -1,
  };

  it('accepts the same events in the same groups, whatever the groups are called', () => {
    const table = [
      { commandId: 'command-0', event: doomOnAgenda },
      { commandId: 'command-3', event: clueOnStudy },
    ];
    const app = [
      { commandId: 'command-0', event: doomOnAgenda },
      { commandId: 'command-1', event: clueOnStudy },
    ];

    expect(logDifference('the app', table, app)).toBeUndefined();
  });

  it('reports two events the app logs in one group that the table logs in two', () => {
    const table = [
      { commandId: 'command-0', event: doomOnAgenda },
      { commandId: 'command-1', event: clueOnStudy },
    ];
    const app = [
      { commandId: 'command-0', event: doomOnAgenda },
      { commandId: 'command-0', event: clueOnStudy },
    ];

    expect(logDifference('the app', table, app)).toBe(
      `the app logs another event at 1: ${JSON.stringify({ group: 0, event: clueOnStudy })} instead of ${JSON.stringify({ group: 1, event: clueOnStudy })}`,
    );
  });

  it('reports an event the app leaves out', () => {
    const table = [{ commandId: 'command-0', event: doomOnAgenda }];

    expect(logDifference('the app', table, [])).toBe(
      `the app logs another event at 0: undefined instead of ${JSON.stringify({ group: 0, event: doomOnAgenda })}`,
    );
  });
});
