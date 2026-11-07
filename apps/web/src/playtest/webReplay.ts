import { isDeepStrictEqual } from 'node:util';
import type { GameStore, LoggedEvent } from '@arkham/engine';
import { firstDifference } from '@arkham/util';
import {
  describeStep,
  numberedGroups,
  playStep,
  scenarioContext,
  setUpTable,
  setupOptions,
  type Run,
  type Step,
} from '@arkham/play_tester';
import { GameSession, startGame } from '../state/gameSession';
import { parseGameExport, serialiseGameExport } from '../storage/gameExport';

/**
 * Plays `steps` of `run` through the app (product.md "Continuous play tester", check 5): a saved
 * game in `store` started like the run's table (`startGame`), each step played as the screen plays
 * it (`GameSession.play`, `GameSession.undo`). The app must log the same events in the same undo
 * groups as `PlayTable` playing them straight, and the log must come back the same when the game
 * is opened again from storage and after an export and import. Returns what differs first, or
 * `undefined`. The steps are ones the table accepted (`RunResult.steps`, a record's steps).
 */
export async function webReplayDifference(
  store: GameStore,
  run: Run,
  steps: readonly Step[],
): Promise<string | undefined> {
  const table = setUpTable(run);
  steps.forEach((step) => playStep(table, step));
  const ctx = scenarioContext(run);
  const title = `Play tester ${run.gameSeed}`;
  const gameId = await startGame(store, title, ctx, setupOptions(run));
  const session = await GameSession.open(store, gameId, ctx);
  for (const step of steps) {
    if (step.verb === 'undo') {
      await session.undo();
      continue;
    }
    const refused = await session.play((played) => playStep(played, step));
    if (refused) return `the app refused ${describeStep(step)}: ${refused.code}`;
  }
  const played =
    logDifference('the app', table.entries, session.entries) ??
    logDifference(
      'the stored game',
      session.entries,
      (await GameSession.open(store, gameId, ctx)).entries,
    );
  if (played) return played;
  const stored = await store.loadGame(gameId);
  if (!stored) return 'the app lost the saved game';
  const exported = serialiseGameExport(
    title,
    stored.summary.createdAt,
    await store.loadEvents(gameId),
  );
  const importedId = await store.importGame(parseGameExport(exported));
  return logDifference(
    'the imported game',
    session.entries,
    (await GameSession.open(store, importedId, ctx)).entries,
  );
}

/**
 * Where `actual` (what `who` logged) first differs from `expected`, by event and by the place of
 * its undo group (`numberedGroups`: each table numbers its groups its own way).
 */
export function logDifference(
  who: string,
  expected: readonly LoggedEvent[],
  actual: readonly LoggedEvent[],
): string | undefined {
  const want = numberedGroups(expected);
  const got = numberedGroups(actual);
  const at = firstDifference(want, got, isDeepStrictEqual);
  return at === undefined
    ? undefined
    : `${who} logs another event at ${at}: ${JSON.stringify(got[at])} instead of ${JSON.stringify(want[at])}`;
}
