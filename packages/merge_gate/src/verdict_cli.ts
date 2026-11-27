/**
 * Prints the merge verdict comment for a PR's head commit, which the session then posts on the
 * PR (CLAUDE.md, step 4). The results are the last lines of the `pr-reviewer` and `rules-checker`
 * subagents; `--rules none` when the PR changes no rule code.
 *
 *   node verdict_cli.ts --sha <head sha> --reviewer <pass|fail> --rules <pass|fail|none>
 */
import { parseArgs } from 'node:util';
import { formatVerdictComment, parseVerdict } from './verdict.ts';

const { values } = parseArgs({
  options: {
    sha: { type: 'string', default: '' },
    reviewer: { type: 'string', default: '' },
    rules: { type: 'string', default: '' },
  },
});
// Round-tripping through the parser rejects exactly what the gate would ignore.
const verdict = parseVerdict(`<!-- merge-verdict ${JSON.stringify(values)} -->`);
if (verdict === undefined) {
  console.error(
    'usage: verdict_cli.ts --sha <40-hex head sha> --reviewer <pass|fail> --rules <pass|fail|none>',
  );
  process.exit(1);
}
console.log(formatVerdictComment(verdict));
