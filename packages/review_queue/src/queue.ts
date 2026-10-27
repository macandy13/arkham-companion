/** One check run on a PR's head commit, as the GitHub check-runs API reports it. */
export interface CheckRun {
  readonly name: string;
  readonly status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  /** Null until the run completes. */
  readonly conclusion: string | null;
}

/** One commit status (the older API some apps report through), latest per context. */
export interface CommitStatus {
  readonly context: string;
  readonly state: 'success' | 'pending' | 'failure' | 'error';
}

/**
 * Where a PR's checks stand. `none` counts as not passed: a PR nothing checked (the
 * Release Please PR) is no review the queue can vouch for.
 */
export type CheckState =
  | { readonly kind: 'passed' }
  | { readonly kind: 'none' }
  | { readonly kind: 'running'; readonly names: readonly string[] }
  | { readonly kind: 'failed'; readonly names: readonly string[] };

/** A finished run counts as passed with these conclusions, as GitHub's merge box does. */
const PASSING_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

/**
 * The name of the job in `review-queue.yml`. Some of the events that start it show it as a
 * check on a PR, where it is still running while it reads that PR's checks.
 */
export const QUEUE_JOB = 'review-queue';

/**
 * Sums up a head commit's check runs and commit statuses, leaving out the queue's own job;
 * a failure outranks a running check.
 */
export function checkState(
  allRuns: readonly CheckRun[],
  statuses: readonly CommitStatus[],
): CheckState {
  const runs = allRuns.filter((run) => run.name !== QUEUE_JOB);
  const failed = [
    ...runs.filter(
      (run) => run.status === 'completed' && !PASSING_CONCLUSIONS.has(run.conclusion ?? ''),
    ),
    ...statuses.filter((status) => status.state === 'failure' || status.state === 'error'),
  ];
  if (failed.length > 0) return { kind: 'failed', names: failed.map(checkName) };
  const running = [
    ...runs.filter((run) => run.status !== 'completed'),
    ...statuses.filter((status) => status.state === 'pending'),
  ];
  if (running.length > 0) return { kind: 'running', names: running.map(checkName) };
  return runs.length + statuses.length === 0 ? { kind: 'none' } : { kind: 'passed' };
}

function checkName(check: CheckRun | CommitStatus): string {
  return 'name' in check ? check.name : check.context;
}

/** Facts from GitHub's PR list that decide whether a PR belongs in the queue at all. */
export interface ListedPr {
  readonly draft: boolean;
  readonly headRef: string;
  /** Its head branch lives in a fork, so its branch name may clash with ours (even `main`). */
  readonly fromFork: boolean;
}

/**
 * Drafts aren't ready, Release Please PRs get no CI and are merged when a release is due,
 * and fork PRs would break stacking by branch name (pr-sync.yml skips them too).
 */
export function isReviewable(pr: ListedPr): boolean {
  return !pr.draft && !pr.fromFork && !pr.headRef.startsWith('release-please--');
}

/** Whether a PR merges into its base without conflicts; `unknown` while GitHub still checks. */
export type Mergeable = 'clean' | 'conflicts' | 'unknown';

/**
 * Combines GitHub's `mergeable` flag (null until GitHub has test-merged the current head
 * and base) with the `needs-rebase` label from `pr-sync.yml`. Either one saying "conflict"
 * wins: the label can be newer than the flag GitHub last computed, and the reverse.
 */
export function mergeability(
  githubMergeable: boolean | null,
  labels: readonly string[],
): Mergeable {
  if (githubMergeable === false || labels.includes('needs-rebase')) return 'conflicts';
  return githubMergeable === null ? 'unknown' : 'clean';
}

/** What the queue needs to know about one reviewable PR; `cli.ts` reads it from GitHub. */
export interface OpenPr {
  readonly number: number;
  readonly title: string;
  /** The branch it merges into: another PR's `headRef` when it is stacked on that PR. */
  readonly baseRef: string;
  readonly headRef: string;
  readonly checks: CheckState;
  readonly mergeable: Mergeable;
}

/** A PR in the queue, with the open PR it is stacked on, if any. */
export interface QueueEntry {
  readonly pr: OpenPr;
  readonly stackedOn: OpenPr | undefined;
}

/**
 * The open PRs split by whether they can be reviewed now, each list in merge order.
 * Reviews don't move PRs between lists: the PRs here are opened under the owner's
 * account, so the owner can't approve them, and sessions post review comments as the
 * owner too, so no review state tells whether the owner has looked.
 */
export interface ReviewQueue {
  /** Checks passed and known to merge without conflicts. */
  readonly queue: readonly QueueEntry[];
  /** Checks running or failed, none at all, conflicts, or mergeability still unknown. */
  readonly notReady: readonly OpenPr[];
}

/**
 * Sorts open PRs into the review queue. Order is merge order: PRs on `main` by number,
 * each followed depth-first by the PRs stacked on it, so a stack reads base first.
 */
export function buildQueue(prs: readonly OpenPr[]): ReviewQueue {
  const byHead = new Map(prs.map((pr) => [pr.headRef, pr]));
  const queue: QueueEntry[] = [];
  const notReady: OpenPr[] = [];
  for (const pr of mergeOrder(prs)) {
    if (pr.checks.kind === 'passed' && pr.mergeable === 'clean') {
      queue.push({ pr, stackedOn: byHead.get(pr.baseRef) });
    } else {
      notReady.push(pr);
    }
  }
  return { queue, notReady };
}

/** The PRs in merge order (see `buildQueue`). */
export function mergeOrder(prs: readonly OpenPr[]): OpenPr[] {
  const heads = new Set(prs.map((pr) => pr.headRef));
  const byNumber = [...prs].sort((a, b) => a.number - b.number);
  const ordered: OpenPr[] = [];
  const visit = (pr: OpenPr): void => {
    ordered.push(pr);
    byNumber.filter((child) => child.baseRef === pr.headRef).forEach(visit);
  };
  byNumber.filter((pr) => !heads.has(pr.baseRef)).forEach(visit);
  return ordered;
}
