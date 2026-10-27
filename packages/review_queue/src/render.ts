import type { OpenPr, QueueEntry, ReviewQueue } from './queue.ts';

/**
 * Renders the review queue as the body of the pinned issue. Bullet lists rather than a
 * table, since it is read on a phone. The body has no timestamp, so the workflow can skip
 * the edit when nothing changed.
 */
export function renderQueue(queue: ReviewQueue): string {
  return [
    'Open PRs whose checks all passed, in merge order: a stacked PR comes after the PR it builds on. Kept up to date by [`review-queue.yml`](../blob/main/.github/workflows/review-queue.yml).',
    '',
    `## Ready for review (${queue.queue.length})`,
    '',
    ...(queue.queue.length === 0 ? ['Nothing to review.'] : queue.queue.map(queueLine)),
    ...(queue.notReady.length === 0
      ? []
      : ['', `## Not ready (${queue.notReady.length})`, '', ...queue.notReady.map(notReadyLine)]),
  ].join('\n');
}

function queueLine(entry: QueueEntry, index: number): string {
  const stacked = entry.stackedOn ? ` (after #${entry.stackedOn.number})` : '';
  return `${index + 1}. #${entry.pr.number} ${entry.pr.title}${stacked}`;
}

function notReadyLine(pr: OpenPr): string {
  return `- #${pr.number} ${pr.title}: ${notReadyReason(pr)}`;
}

// No default case: TypeScript fails the build when `CheckState` gains a kind this misses.
// Not `assertNever` from @arkham/util, since `node` won't strip types inside node_modules.
function notReadyReason(pr: OpenPr): string {
  if (pr.conflicts) return 'conflicts with its base';
  switch (pr.checks.kind) {
    case 'failed':
      return `failed ${pr.checks.names.join(', ')}`;
    case 'running':
      return `running ${pr.checks.names.join(', ')}`;
    case 'none':
      return 'no checks ran';
    case 'passed':
      throw new Error(`#${pr.number} passed its checks and has no conflicts, so it is ready`);
  }
}
