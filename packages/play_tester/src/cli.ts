/**
 * Command-line entry for the play tester (product.md "Who runs it and where it writes"):
 *
 *   pnpm playtest --games 500 --seed 7   plays 500 runs drawn from seed 7, prints the summary and
 *                                        writes each failing game's record to
 *                                        `packages/play_tester/.runs/` (or `--out <dir>`)
 *   pnpm playtest --bot goal             plays only runs of that bot (`random`, `goal`, `chaos`;
 *                                        all of them by default)
 *   pnpm playtest --replay <record>      replays a record's steps on today's engine and stops at
 *                                        its failing step
 *
 * Exits with 1 when a game fails a check (or a replayed record still fails), so a script can stop.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkRun } from './play_run';
import {
  loggedBoard,
  parseRecord,
  recordFileName,
  recordOf,
  replaySteps,
  serialiseRecord,
  type TesterVersion,
} from './record';
import { BOT_KINDS, runsFrom, type BotKind } from './run';
import { describeStep } from './steps';
import { formatSummary, summarise } from './summary';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '100' },
    seed: { type: 'string', default: '1' },
    replay: { type: 'string' },
    out: { type: 'string' },
    bot: { type: 'string' },
  },
});

// pnpm runs the script in the package; a path the caller typed is relative to where they were.
const callerDirectory = process.env.INIT_CWD ?? process.cwd();

process.exitCode = values.replay === undefined ? playGames() : replayRecord(values.replay);

function playGames(): number {
  const games = Number(values.games);
  const seed = Number(values.seed);
  const results = runsFrom(seed, games, bots(values.bot)).map((run) => checkRun(run));
  console.log(`Play tester, seed ${seed}\n${formatSummary(summarise(results))}`);
  const failing = results.filter(({ finding }) => finding);
  if (failing.length === 0) return 0;
  const out =
    values.out === undefined
      ? fileURLToPath(new URL('../.runs', import.meta.url))
      : resolve(callerDirectory, values.out);
  mkdirSync(out, { recursive: true });
  const tester = testerVersion();
  for (const result of failing) {
    const record = recordOf(result, tester);
    const path = join(out, recordFileName(record));
    writeFileSync(path, serialiseRecord(record));
    console.log(`${record.finding.check}: ${path}`);
  }
  return 1;
}

function replayRecord(path: string): number {
  const record = parseRecord(readFileSync(resolve(callerDirectory, path), 'utf8'));
  const { check, step, attempted } = record.finding;
  console.log(
    `Recorded: ${check} at step ${step}${attempted ? `, ${describeStep(attempted)}` : ''}`,
  );
  console.log(`The logged game ended as:\n${loggedBoard(record)}`);
  const now = replaySteps(record);
  if (!now.finding) {
    console.log('Today the steps play through without a finding.');
    return 0;
  }
  console.log(
    `${now.reproduced ? 'Reproduced' : 'Today it fails differently'}: ${now.finding.check} at step ${now.finding.step}\n${now.finding.message}`,
  );
  return 1;
}

/** The bots `--bot` names, or all of them; fails for a bot the tester does not have. */
function bots(named: string | undefined): readonly BotKind[] {
  if (named === undefined) return BOT_KINDS;
  const bot = BOT_KINDS.find((kind) => kind === named);
  if (!bot) throw new Error(`no bot ${named}; the bots are ${BOT_KINDS.join(', ')}`);
  return [bot];
}

/** This package's version and the commit it runs on; `unknown` outside a git checkout. */
function testerVersion(): TesterVersion {
  const { version } = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    return { version, commit };
  } catch (error) {
    console.warn('Could not read the git commit; the records name it unknown.', error);
    return { version, commit: 'unknown' };
  }
}
