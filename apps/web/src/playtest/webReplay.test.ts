import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { gameExport, playRun, type Run } from '@arkham/play_tester';
import { theGathering } from '@arkham/scenarios';
import { parseGameExport } from '../storage/gameExport';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { webReplayDifference } from './webReplay';

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

describe('opening a play tester record with "Import game"', () => {
  /** The first 20 steps of a goal bot game of The Gathering for Roland Banks, recorded as a refusal. */
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [cardName('Roland Banks')],
    blanks: [],
    gameSeed: 24,
    bot: 'goal',
    botSeed: 1,
  };
  const { log } = playRun(run, { stepCap: 20 });
  const finding = {
    check: 'refusal',
    step: 20,
    message: 'recorded',
    boardBefore: 'recorded',
  } as const;

  it("reads as the app's own export, with every event and its undo group", () => {
    const imported = parseGameExport(gameExport({ run, finding, log }));

    expect(imported.title).toBe('Play tester: refusal, goal 24');
    expect(
      imported.events.map(({ commandId, event, cause }) => ({ commandId, event, cause })),
    ).toEqual(log.map(({ commandId, event, cause }) => ({ commandId, event, cause })));
  });
});
