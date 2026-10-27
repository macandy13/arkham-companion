/**
 * Command-line entry for the review queue, run with plain `node` (type stripping) by
 * `.github/workflows/review-queue.yml`. Reads the open PRs of `GITHUB_REPOSITORY` with
 * `GITHUB_TOKEN` and prints the queue's Markdown; the workflow writes it into the issue.
 */
import {
  buildQueue,
  checkState,
  isReviewable,
  type CheckRun,
  type CommitStatus,
  type OpenPr,
} from './queue.ts';
import { renderQueue } from './render.ts';

const repository = requiredEnv('GITHUB_REPOSITORY');
const token = requiredEnv('GITHUB_TOKEN');

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
  head: { ref: string; sha: string; repo: { full_name: string } | null };
}

async function openPr(pull: ApiPull): Promise<OpenPr> {
  const [runs, status] = await Promise.all([
    api<{ check_runs: CheckRun[] }>(`commits/${pull.head.sha}/check-runs?per_page=100`),
    api<{ statuses: CommitStatus[] }>(`commits/${pull.head.sha}/status`),
  ]);
  return {
    number: pull.number,
    title: pull.title,
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    checks: checkState(runs.check_runs, status.statuses),
    conflicts: pull.labels.some((label) => label.name === 'needs-rebase'),
  };
}

const pulls = await api<ApiPull[]>('pulls?state=open&per_page=100');
const reviewable = pulls.filter((pull) =>
  isReviewable({
    draft: pull.draft,
    headRef: pull.head.ref,
    fromFork: pull.head.repo?.full_name !== repository,
  }),
);
const prs = await Promise.all(reviewable.map(openPr));
process.stdout.write(renderQueue(buildQueue(prs)) + '\n');
