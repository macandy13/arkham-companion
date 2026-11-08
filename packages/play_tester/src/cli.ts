/**
 * Command-line entry for the play tester (product.md "Who runs it and where it writes"):
 *
 *   pnpm playtest --games 500 --seed 7   plays 500 runs drawn from seed 7, prints the summary and
 *                                        writes each failing game's record to
 *                                        `packages/play_tester/.runs/` (or `--out <dir>`), with its
 *                                        report (`.md`) and app export (`.arkham-game.json`)
 *                                        and replays every committed record in `--findings <dir>`
 *                                        (`packages/play_tester/findings/` by default): one that
 *                                        still fails is a fixed bug come back, written out alike
 *   pnpm playtest --bot goal             plays only runs of that bot (`random`, `goal`, `chaos`;
 *                                        all of them by default)
 *   pnpm playtest --nightly              also writes `summary.md` (the job summary, with the
 *                                        statistics) and
 *                                        `findings.json` (one `NightlyFinding` per signature, for
 *                                        the issues) to the output directory, findings or not
 *   pnpm playtest --replay <record>      replays a record's steps on today's engine and stops at
 *                                        its failing step
 *
 * Exits with 1 when a game fails a check (or a replayed record still fails), so a script can stop.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkRun } from './play_run';
import { nightlyFindings, nightlySummary, type WrittenRecord } from './nightly';
import {
  loggedBoard,
  parseRecord,
  RECORD_SUFFIX,
  recordFileName,
  recordOf,
  replaySteps,
  serialiseRecord,
  type RunRecord,
  type TesterVersion,
} from './record';
import { BOT_KINDS, runsFrom, type BotKind } from './run';
import { describeStep } from './steps';
import { findingReport, gameExport, gameExportPath, reportPath } from './report';
import { shrink } from './shrink';
import { gameStatistics, statisticsReport } from './statistics';
import { formatSummary, summarise } from './summary';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '100' },
    seed: { type: 'string', default: '1' },
    replay: { type: 'string' },
    out: { type: 'string' },
    bot: { type: 'string' },
    findings: { type: 'string' },
    nightly: { type: 'boolean', default: false },
  },
});

// pnpm runs the script in the package; a path the caller typed is relative to where they were.
const callerDirectory = process.env.INIT_CWD ?? process.cwd();

process.exitCode = values.replay === undefined ? playGames() : replayRecord(values.replay);

function playGames(): number {
  const games = Number(values.games);
  const seed = Number(values.seed);
  const results = runsFrom(seed, games, bots(values.bot)).map((run) => checkRun(run));
  const summary = summarise(results);
  console.log(`Play tester, seed ${seed}\n${formatSummary(summary)}`);
  const tester = testerVersion();
  const failing = results.flatMap((result) =>
    result.finding ? [recordOf(shrink(result), tester)] : [],
  );
  const comeBack = committedRecords().filter(({ record }) => replaySteps(record).finding);
  for (const { file } of comeBack) console.log(`${file} fails again`);
  const out =
    values.out === undefined
      ? fileURLToPath(new URL('../.runs', import.meta.url))
      : resolve(callerDirectory, values.out);
  const written = [...failing, ...comeBack.map(({ record }) => record)].map((record) =>
    writeRecord(out, record),
  );
  if (values.nightly) {
    const findings = nightlyFindings(written);
    const comeBackFiles = comeBack.map(({ file }) => file);
    mkdirSync(out, { recursive: true });
    const statistics = statisticsReport(results.map(gameStatistics));
    writeFileSync(
      join(out, 'summary.md'),
      `${nightlySummary(seed, summary, findings, comeBackFiles)}\n\n${statistics}`,
    );
    writeFileSync(join(out, 'findings.json'), JSON.stringify(findings, undefined, 2));
  }
  return written.length === 0 ? 0 : 1;
}

/** Writes `record` to `out` with its app export and report beside it; prints the report's path. */
function writeRecord(out: string, record: RunRecord): WrittenRecord {
  mkdirSync(out, { recursive: true });
  const path = join(out, recordFileName(record));
  writeFileSync(path, serialiseRecord(record));
  writeFileSync(gameExportPath(path), gameExport(record));
  writeFileSync(reportPath(path), findingReport(record, relative(callerDirectory, path)));
  console.log(`${record.finding.check}: ${reportPath(path)}`);
  return { record, report: relative(out, reportPath(path)) };
}

/** The committed records of fixed bugs in `--findings`, by file name; a missing directory holds none. */
function committedRecords(): { file: string; record: RunRecord }[] {
  const directory =
    values.findings === undefined
      ? fileURLToPath(new URL('../findings', import.meta.url))
      : resolve(callerDirectory, values.findings);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(RECORD_SUFFIX))
    .map((file) => ({ file, record: parseRecord(readFileSync(join(directory, file), 'utf8')) }));
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
