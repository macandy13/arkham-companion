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

/** Sums up a head commit's check runs and commit statuses; a failure outranks a running check. */
export function checkState(
  runs: readonly CheckRun[],
  statuses: readonly CommitStatus[],
): CheckState {
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

/** The reviewer's latest review that still counts (GitHub drops dismissed ones). */
export interface Review {
  readonly state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  /** The head commit the review was made on. */
  readonly sha: string;
}

/** What the queue needs to know about one open, non-draft PR; `cli.ts` reads it from GitHub. */
export interface OpenPr {
  readonly number: number;
  readonly title: string;
  /** The branch it merges into: another PR's `headRef` when it is stacked on that PR. */
  readonly baseRef: string;
  readonly headRef: string;
  readonly headSha: string;
  readonly checks: CheckState;
  /** Labelled `needs-rebase` by `pr-sync.yml`: the branch conflicts with its base. */
  readonly conflicts: boolean;
  readonly review: Review | undefined;
}

/** Why a PR in the queue needs the reviewer: first look, a look at new commits, or the merge. */
export type QueueTag = 'review' | 're-review' | 'approved';

/** A PR in the queue, with the open PR it is stacked on, if any. */
export interface QueueEntry {
  readonly pr: OpenPr;
  readonly tag: QueueTag;
  readonly stackedOn: OpenPr | undefined;
}

/** The open PRs sorted by what the reviewer can do with them, each list in merge order. */
export interface ReviewQueue {
  /** Checks passed, no conflicts, and the reviewer's move. */
  readonly queue: readonly QueueEntry[];
  /** Reviewed by the reviewer at its current head without approval: the author's move. */
  readonly waiting: readonly OpenPr[];
  /** Checks running or failed, none at all, or conflicts. */
  readonly notReady: readonly OpenPr[];
}

/**
 * Sorts open PRs into the review queue. Order is merge order: PRs on `main` by number,
 * each followed depth-first by the PRs stacked on it, so a stack reads base first.
 */
export function buildQueue(prs: readonly OpenPr[]): ReviewQueue {
  const byHead = new Map(prs.map((pr) => [pr.headRef, pr]));
  const queue: QueueEntry[] = [];
  const waiting: OpenPr[] = [];
  const notReady: OpenPr[] = [];
  for (const pr of mergeOrder(prs)) {
    const tag = queueTag(pr);
    if (pr.checks.kind !== 'passed' || pr.conflicts) notReady.push(pr);
    else if (tag === undefined) waiting.push(pr);
    else queue.push({ pr, tag, stackedOn: byHead.get(pr.baseRef) });
  }
  return { queue, waiting, notReady };
}

/** Undefined when the reviewer already reviewed the current head without approving it. */
function queueTag(pr: OpenPr): QueueTag | undefined {
  if (pr.review === undefined) return 'review';
  if (pr.review.state === 'APPROVED') return 'approved';
  return pr.review.sha === pr.headSha ? undefined : 're-review';
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
