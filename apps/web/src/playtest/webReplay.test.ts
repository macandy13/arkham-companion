import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { playRun, type Run } from '@arkham/play_tester';
import { theGathering } from '@arkham/scenarios';
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
