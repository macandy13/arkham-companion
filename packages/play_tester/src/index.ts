/**
 * What the web app's replay check (`apps/web/src/playtest/`) uses of the play tester: the runs,
 * their steps on a `PlayTable`, the records of failing games and the log comparison. The tester
 * itself is run by its own command line (`cli.ts`).
 */
export { logDifference, playRun } from './play_run';
export { parseRecord, RECORD_SUFFIX } from './record';
export { runsFrom, scenarioContext, setUpTable, setupOptions, type Run } from './run';
export { describeStep, playStep, type Step } from './steps';
