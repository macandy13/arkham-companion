/**
 * Command-line entry for the merge gate, run with plain `node` (type stripping) by
 * `.github/workflows/gate.yml` from the base branch, never from the PR's own code. Reads what the
 * workflow fetched from the REST API and prints the outcome as one JSON line,
 * `{"kind":"pass","reason":"…"}`, which the workflow turns into the `gate` commit status.
 *
 *   node cli.ts --head <sha> --owner <login> --files <paths.txt> --reviews <reviews.ndjson>
 *     --comments <comments.ndjson>
 *
 * `paths.txt` holds one changed path per line; the `.ndjson` files hold one
 * `{"author","state"}` review or `{"author","body"}` comment per line, oldest first.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  decideGate,
  type CommitSha,
  type GitHubLogin,
  type PullRequestComment,
  type PullRequestReview,
  type RepoPath,
} from './gate.ts';

/** The GitHub App that opens the sessions' PRs (`open-pr.yml`); it may post verdicts too. */
const PR_BOT = 'arkham-claude[bot]' as GitHubLogin;

// Every option is required; an empty default lets the check below name all missing ones at once.
const stringOption = { type: 'string', default: '' } as const;
const { values } = parseArgs({
  options: {
    head: stringOption,
    owner: stringOption,
    files: stringOption,
    reviews: stringOption,
    comments: stringOption,
  },
});
const missing = Object.entries(values).filter(([, value]) => value === '');
if (missing.length > 0) {
  console.error(`missing options: ${missing.map(([name]) => `--${name}`).join(', ')}`);
  process.exit(1);
}

function lines(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');
}

// The workflow's jq filters build these records, so their shape is known here.
const reviews = lines(values.reviews).map((line) => JSON.parse(line) as PullRequestReview);
const comments = lines(values.comments).map((line) => JSON.parse(line) as PullRequestComment);
const owner = values.owner as GitHubLogin;

const outcome = decideGate(
  {
    headSha: values.head as CommitSha,
    changedFiles: lines(values.files) as RepoPath[],
    reviews,
    comments,
  },
  { owner, verdictAuthors: [owner, PR_BOT] },
);
console.log(JSON.stringify(outcome));
