import { describe, expect, it } from 'vitest';
import {
  buildQueue,
  checkState,
  isReviewable,
  mergeOrder,
  QUEUE_JOB,
  type CheckRun,
  type OpenPr,
} from './queue.ts';
import { renderQueue } from './render.ts';

describe('checkState', () => {
  const passed: CheckRun = { name: 'check', status: 'completed', conclusion: 'success' };
  const skipped: CheckRun = { name: 'screencasts', status: 'completed', conclusion: 'skipped' };
  const failed: CheckRun = { name: 'bundle-size', status: 'completed', conclusion: 'failure' };
  const running: CheckRun = { name: 'preview', status: 'in_progress', conclusion: null };
  const queueJob: CheckRun = { name: QUEUE_JOB, status: 'in_progress', conclusion: null };

  it.each([
    ['passed and skipped runs', [passed, skipped], { kind: 'passed' }],
    ['a running run', [passed, running], { kind: 'running', names: ['preview'] }],
    ['a failed and a running run', [failed, running], { kind: 'failed', names: ['bundle-size'] }],
    ['the running queue job, left out', [passed, queueJob], { kind: 'passed' }],
    ['no runs', [], { kind: 'none' }],
  ])('%s', (_case, runs, expected) => {
    expect(checkState(runs, [])).toEqual(expected);
  });

  it('counts commit statuses like check runs', () => {
    expect(checkState([passed], [{ context: 'deploy', state: 'pending' }])).toEqual({
      kind: 'running',
      names: ['deploy'],
    });
    expect(checkState([passed], [{ context: 'deploy', state: 'error' }])).toEqual({
      kind: 'failed',
      names: ['deploy'],
    });
  });
});

describe('isReviewable', () => {
  it.each([
    ['a PR from a branch here', { draft: false, headRef: 'claude/thread', fromFork: false }, true],
    ['a draft', { draft: true, headRef: 'claude/thread', fromFork: false }, false],
    ['a fork PR from its main', { draft: false, headRef: 'main', fromFork: true }, false],
    [
      'the release PR',
      { draft: false, headRef: 'release-please--branches--main', fromFork: false },
      false,
    ],
  ])('%s → %s', (_case, pr, expected) => {
    expect(isReviewable(pr)).toBe(expected);
  });
});

/** A PR whose checks passed and that has no conflicts. */
function greenPr(pr: { number: number; base: string; head: string; title?: string }): OpenPr {
  return {
    number: pr.number,
    title: pr.title ?? `PR ${pr.number}`,
    baseRef: pr.base,
    headRef: pr.head,
    checks: { kind: 'passed' },
    conflicts: false,
  };
}

describe('mergeOrder', () => {
  it('puts PRs on main by number, each followed by the PRs stacked on it', () => {
    const prs = [
      greenPr({ number: 507, base: 'resolving', head: 'moves' }),
      greenPr({ number: 504, base: 'main', head: 'card_zoom' }),
      greenPr({ number: 501, base: 'dialog', head: 'draw' }),
      greenPr({ number: 496, base: 'main', head: 'dialog' }),
      greenPr({ number: 503, base: 'draw', head: 'resolving' }),
      greenPr({ number: 509, base: 'main', head: 'screenshots' }),
    ];

    expect(mergeOrder(prs).map((pr) => pr.number)).toEqual([496, 501, 503, 507, 504, 509]);
  });

  it('treats a PR whose base is no open PR (merged, or never one) as a root', () => {
    const prs = [
      greenPr({ number: 503, base: 'draw', head: 'resolving' }),
      greenPr({ number: 500, base: 'main', head: 'agenda' }),
    ];

    expect(mergeOrder(prs).map((pr) => pr.number)).toEqual([500, 503]);
  });
});

describe('buildQueue', () => {
  it('queues green PRs with the PR they are stacked on and leaves out the ones not ready', () => {
    const dialog: OpenPr = {
      ...greenPr({ number: 496, base: 'main', head: 'dialog' }),
      checks: { kind: 'running', names: ['preview'] },
    };
    const draw = greenPr({ number: 501, base: 'dialog', head: 'draw' });
    const conflicting: OpenPr = {
      ...greenPr({ number: 502, base: 'main', head: 'parley' }),
      conflicts: true,
    };

    const queue = buildQueue([dialog, draw, conflicting]);

    expect(queue.queue).toEqual([{ pr: draw, stackedOn: dialog }]);
    expect(queue.notReady).toEqual([dialog, conflicting]);
  });
});

describe('renderQueue', () => {
  it('numbers the queue in merge order and gives the reason for each PR not ready', () => {
    const dialog = greenPr({ number: 496, base: 'main', head: 'dialog', title: 'feat: dialog' });
    const draw = greenPr({ number: 501, base: 'dialog', head: 'draw', title: 'feat: draw' });
    const bump: OpenPr = {
      ...greenPr({ number: 154, base: 'main', head: 'dependabot/actions', title: 'ci: bump' }),
      checks: { kind: 'failed', names: ['bundle-size'] },
    };

    const body = renderQueue(buildQueue([draw, bump, dialog]));

    expect(body).toContain(
      [
        '## Ready for review (2)',
        '',
        '1. #496 feat: dialog',
        '2. #501 feat: draw (after #496)',
        '',
        '## Not ready (1)',
        '',
        '- #154 ci: bump: failed bundle-size',
      ].join('\n'),
    );
  });

  it.each([
    ['conflicts', { conflicts: true }, 'conflicts with its base'],
    [
      'running checks',
      { checks: { kind: 'running', names: ['preview', 'e2e'] } },
      'running preview, e2e',
    ],
    ['no checks', { checks: { kind: 'none' } }, 'no checks ran'],
  ] as const)('gives %s as the reason a PR is not ready', (_case, state, reason) => {
    const pr: OpenPr = {
      ...greenPr({ number: 443, base: 'main', head: 'release', title: 'chore: release' }),
      ...state,
    };

    expect(renderQueue(buildQueue([pr]))).toContain(`- #443 chore: release: ${reason}`);
  });

  it('says so when nothing is left to review', () => {
    expect(renderQueue({ queue: [], notReady: [] })).toContain(
      '## Ready for review (0)\n\nNothing to review.',
    );
  });
});
