/**
 * Command-line entry for the play tester's web replay (product.md "Continuous play tester",
 * check 5), run with `pnpm --filter @arkham/web playtest`:
 *
 *   --games 5 --seed 7   plays 5 runs drawn from seed 7 on a `PlayTable` and replays each through
 *                        the app (`webReplayDifference`)
 *   --records <dir>      also replays every record in `dir`, by default the committed findings
 *                        (`packages/play_tester/findings/`); a missing directory holds none
 *
 * It lives in the app, as a package must not depend on the app, and is not part of `pnpm test`:
 * it is meant for the nightly run, on a few of the night's runs. Exits with 1 when the app differs.
 */
import 'fake-indexeddb/auto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  parseRecord,
  playRun,
  RECORD_SUFFIX,
  runsFrom,
  type Run,
  type Step,
} from '@arkham/play_tester';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { webReplayDifference } from './webReplay';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '5' },
    seed: { type: 'string', default: '1' },
    records: { type: 'string' },
  },
});

// pnpm runs the script in the package; a path the caller typed is relative to where they were.
const callerDirectory = process.env.INIT_CWD ?? process.cwd();
const recordsDirectory =
  values.records === undefined
    ? fileURLToPath(new URL('../../../../packages/play_tester/findings', import.meta.url))
    : resolve(callerDirectory, values.records);

/** One game to replay through the app: where it came from, its run and the steps the table took. */
interface Replay {
  readonly name: string;
  readonly run: Run;
  readonly steps: readonly Step[];
}

const replays: Replay[] = [
  ...runsFrom(Number(values.seed), Number(values.games)).map((run) => ({
    name: `run ${run.bot} ${run.gameSeed} ${run.botSeed}`,
    run,
    steps: playRun(run).steps,
  })),
  ...recordReplays(recordsDirectory),
];

let failed = 0;
for (const [index, { name, run, steps }] of replays.entries()) {
  const difference = await webReplayDifference(new IndexedDbStore(`playtest-${index}`), run, steps);
  if (difference === undefined) continue;
  failed++;
  console.log(`${name}: ${difference}`);
}
console.log(`Web replay: ${replays.length} games, ${failed} differ from the table`);
process.exitCode = failed === 0 ? 0 : 1;

/** The records in `directory` as replays, each with the steps its table took before its finding. */
function recordReplays(directory: string): Replay[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(RECORD_SUFFIX))
    .map((file) => {
      const { run, steps } = parseRecord(readFileSync(join(directory, file), 'utf8'));
      return { name: file, run, steps };
    });
}
