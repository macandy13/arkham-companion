import type { OpenPr, QueueEntry, QueueTag, ReviewQueue } from './queue.ts';

const TAG_TEXT: Record<QueueTag, string> = {
  review: 'to review',
  're-review': 'new commits since your review',
  approved: 'approved, ready to merge',
};

/**
 * Renders the review queue as the body of the pinned issue. Bullet lists rather than a
 * table, since it is read on a phone; `#123` links render with their title on GitHub.
 * The body has no timestamp, so the workflow can skip the edit when nothing changed.
 */
export function renderQueue(queue: ReviewQueue): string {
  return [
    'Open PRs whose checks all passed, in merge order: a stacked PR comes after the PR it builds on. Kept up to date by [`review-queue.yml`](../blob/main/.github/workflows/review-queue.yml).',
    '',
    `## Queue (${queue.queue.length})`,
    '',
    ...(queue.queue.length === 0 ? ['Nothing to review.'] : queue.queue.map(queueLine)),
    ...section('Waiting on the author', queue.waiting.map(prLine)),
    ...section('Not ready', queue.notReady.map(notReadyLine)),
  ].join('\n');
}

function queueLine(entry: QueueEntry, index: number): string {
  const stacked = entry.stackedOn ? `, after #${entry.stackedOn.number}` : '';
  return `${index + 1}. #${entry.pr.number} ${entry.pr.title} (${TAG_TEXT[entry.tag]}${stacked})`;
}

function prLine(pr: OpenPr): string {
  return `- #${pr.number} ${pr.title}`;
}

function notReadyLine(pr: OpenPr): string {
  return `${prLine(pr)}: ${notReadyReason(pr)}`;
}

function notReadyReason(pr: OpenPr): string {
  if (pr.conflicts) return 'conflicts with its base';
  switch (pr.checks.kind) {
    case 'failed':
      return `failed ${pr.checks.names.join(', ')}`;
    case 'running':
      return `running ${pr.checks.names.join(', ')}`;
    default:
      return 'no checks ran';
  }
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `## ${title} (${lines.length})`, '', ...lines];
}
