import { STATE_VERSION } from '@arkham/engine';
import { attempts } from './play_run';
import { RECORD_SUFFIX, type RunRecord } from './record';
import { describeStep } from './steps';

/**
 * The app's export format marker (`apps/web/src/storage/gameExport.ts`), so a record's game opens
 * with "Import game". The play tester must not depend on the app; a web test parses this export
 * with the app's own `parseGameExport`, so the two can't drift apart unnoticed.
 */
const GAME_EXPORT_FORMAT = 'arkham-companion-game';

/**
 * The finding of `record` for a reader (product.md "Recording and replay"): the check and its
 * message, the run, the steps as `PlayTable` calls with the failing one last, the board before
 * that step and after it when it changed, and how to replay it from `recordPath` or open it in the
 * app (`gameExport`). Markdown, for the console, a job summary or an issue.
 */
export function findingReport(record: RunRecord, recordPath: string): string {
  const { run, finding, tester } = record;
  const steps = attempts(record).map(describeStep);
  const [headline = finding.check] = finding.message.split('\n');
  return [
    `## ${finding.check} at step ${finding.step}: ${headline}`,
    '',
    `- Run: ${run.scenario}, ${run.difficulty}, seats ${run.seats.join(', ')}; game seed ${run.gameSeed}, ${run.bot} bot, bot seed ${run.botSeed}`,
    `- Tester: ${tester.version} at ${tester.commit}`,
    `- Replay: \`pnpm playtest --replay ${recordPath}\`; open \`${gameExportPath(recordPath)}\` in the app with "Import game"`,
    '',
    `### Steps (${steps.length})`,
    '',
    fenced(steps.join('\n')),
    '### What failed',
    '',
    fenced(finding.message),
    '### Board before the failing step',
    '',
    fenced(finding.boardBefore),
    ...(finding.boardAfter ? ['### Board after it', '', fenced(finding.boardAfter)] : []),
  ].join('\n');
}

/**
 * The game of `record` as an export file of the app (`serialiseGameExport`): its event log with
 * each event's undo group and cause, so "Import game" opens it on the board and undo steps back
 * through it. The tester keeps no clock, so the timestamps count the events.
 */
export function gameExport({
  run,
  finding,
  log,
}: Pick<RunRecord, 'run' | 'finding' | 'log'>): string {
  return JSON.stringify({
    format: GAME_EXPORT_FORMAT,
    stateVersion: STATE_VERSION,
    game: { title: `Play tester: ${finding.check}, ${run.bot} ${run.gameSeed}`, createdAt: 0 },
    events: log.map(({ commandId, event, cause }, timestamp) => ({
      timestamp,
      commandId,
      event,
      ...(cause && { cause }),
    })),
  });
}

/** The file name ending of a record's app export (`gameExport`), which sits beside the record. */
const GAME_EXPORT_SUFFIX = '.arkham-game.json';

/** Where the app export of the record at `recordPath` goes: beside it, with its own ending. */
export function gameExportPath(recordPath: string): string {
  const base = recordPath.endsWith(RECORD_SUFFIX)
    ? recordPath.slice(0, -RECORD_SUFFIX.length)
    : recordPath;
  return `${base}${GAME_EXPORT_SUFFIX}`;
}

/** Where the report of the record at `recordPath` goes (`findingReport`): beside it, as Markdown. */
export function reportPath(recordPath: string): string {
  return gameExportPath(recordPath).slice(0, -GAME_EXPORT_SUFFIX.length) + '.md';
}

/** `text` as a fenced block; boards, steps and messages hold no backtick fences of their own. */
function fenced(text: string): string {
  return ['```', text, '```', ''].join('\n');
}
