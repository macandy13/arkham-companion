/**
 * Command-line entry for the review queue, run with plain `node` (type stripping) by
 * `.github/workflows/review-queue.yml`. Reads the open PRs of `GITHUB_REPOSITORY` with
 * `GITHUB_TOKEN` and prints the queue's Markdown; the workflow writes it into the issue.
 * The reviewer is the repository owner.
 */
import {
  buildQueue,
  checkState,
  type CheckRun,
  type CommitStatus,
  type OpenPr,
  type Review,
} from './queue.ts';
import { renderQueue } from './render.ts';

const repository = requiredEnv('GITHUB_REPOSITORY');
const token = requiredEnv('GITHUB_TOKEN');
const reviewer = repository.split('/')[0];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
  return value;
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

interface ApiPull {
  number: number;
  title: string;
  draft: boolean;
  labels: { name: string }[];
  base: { ref: string };
  head: { ref: string; sha: string };
}

interface ApiReview {
  user: { login: string } | null;
  state: string;
  commit_id: string;
}

/** Release Please PRs get no CI and are merged when a release is due, not reviewed. */
function isReviewable(pull: ApiPull): boolean {
  return !pull.draft && !pull.head.ref.startsWith('release-please--');
}

function latestReview(reviews: readonly ApiReview[]): Review | undefined {
  const counted = reviews.filter(
    (review): review is ApiReview & { state: Review['state'] } =>
      review.user?.login === reviewer &&
      ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(review.state),
  );
  const last = counted.at(-1);
  return last && { state: last.state, sha: last.commit_id };
}

async function openPr(pull: ApiPull): Promise<OpenPr> {
  const [runs, status, reviews] = await Promise.all([
    api<{ check_runs: CheckRun[] }>(`commits/${pull.head.sha}/check-runs?per_page=100`),
    api<{ statuses: CommitStatus[] }>(`commits/${pull.head.sha}/status`),
    api<ApiReview[]>(`pulls/${pull.number}/reviews?per_page=100`),
  ]);
  return {
    number: pull.number,
    title: pull.title,
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    // The queue's own job shows up as a check on PRs whose event started it.
    checks: checkState(
      runs.check_runs.filter((run) => run.name !== 'review-queue'),
      status.statuses,
    ),
    conflicts: pull.labels.some((label) => label.name === 'needs-rebase'),
    review: latestReview(reviews),
  };
}

const pulls = await api<ApiPull[]>('pulls?state=open&per_page=100');
const prs = await Promise.all(pulls.filter(isReviewable).map(openPr));
process.stdout.write(renderQueue(buildQueue(prs)) + '\n');
