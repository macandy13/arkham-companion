import { describe, expect, it } from 'vitest';
import { buildQueue, checkState, mergeOrder, type CheckRun, type OpenPr } from './queue.ts';
import { renderQueue } from './render.ts';

describe('checkState', () => {
  const passed: CheckRun = { name: 'check', status: 'completed', conclusion: 'success' };
  const skipped: CheckRun = { name: 'screencasts', status: 'completed', conclusion: 'skipped' };
  const failed: CheckRun = { name: 'bundle-size', status: 'completed', conclusion: 'failure' };
  const running: CheckRun = { name: 'preview', status: 'in_progress', conclusion: null };

  it.each([
    ['passed and skipped runs', [passed, skipped], { kind: 'passed' }],
    ['a running run', [passed, running], { kind: 'running', names: ['preview'] }],
    ['a failed and a running run', [failed, running], { kind: 'failed', names: ['bundle-size'] }],
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

/** A PR whose checks passed, without conflicts and without a review yet. */
function unreviewedGreenPr(number: number, baseRef: string, headRef: string): OpenPr {
  return {
    number,
    title: `PR ${number}`,
    baseRef,
    headRef,
    headSha: `${headRef}_head`,
    checks: { kind: 'passed' },
    conflicts: false,
    review: undefined,
  };
}

describe('mergeOrder', () => {
  it('puts PRs on main by number, each followed by the PRs stacked on it', () => {
    const prs = [
      unreviewedGreenPr(507, 'resolving', 'moves'),
      unreviewedGreenPr(504, 'main', 'card_zoom'),
      unreviewedGreenPr(501, 'dialog', 'draw'),
      unreviewedGreenPr(496, 'main', 'dialog'),
      unreviewedGreenPr(503, 'draw', 'resolving'),
      unreviewedGreenPr(509, 'main', 'screenshots'),
    ];

    expect(mergeOrder(prs).map((pr) => pr.number)).toEqual([496, 501, 503, 507, 504, 509]);
  });

  it('treats a PR whose base is no open PR (merged or never one) as a root', () => {
    const prs = [
      unreviewedGreenPr(503, 'draw', 'resolving'),
      unreviewedGreenPr(500, 'main', 'agenda'),
    ];

    expect(mergeOrder(prs).map((pr) => pr.number)).toEqual([500, 503]);
  });
});

describe('buildQueue', () => {
  it('queues green PRs with their stack base and leaves out the ones not ready', () => {
    const dialog: OpenPr = {
      ...unreviewedGreenPr(496, 'main', 'dialog'),
      checks: { kind: 'running', names: ['preview'] },
    };
    const draw = unreviewedGreenPr(501, 'dialog', 'draw');
    const conflicting: OpenPr = { ...unreviewedGreenPr(502, 'main', 'parley'), conflicts: true };

    const queue = buildQueue([dialog, draw, conflicting]);

    expect(queue.queue).toEqual([{ pr: draw, tag: 'review', stackedOn: dialog }]);
    expect(queue.notReady).toEqual([dialog, conflicting]);
  });

  it.each([
    ['no review', undefined, 'queue', 'review'],
    [
      'approved at an older commit',
      { state: 'APPROVED', sha: 'older_commit' },
      'queue',
      'approved',
    ],
    [
      'commented at an older commit',
      { state: 'COMMENTED', sha: 'older_commit' },
      'queue',
      're-review',
    ],
    [
      'changes requested at the head',
      { state: 'CHANGES_REQUESTED', sha: 'head_commit' },
      'waiting',
      undefined,
    ],
  ] as const)('%s → %s', (_case, review, list, tag) => {
    const pr: OpenPr = {
      ...unreviewedGreenPr(491, 'main', 'buttons'),
      headSha: 'head_commit',
      review,
    };

    const queue = buildQueue([pr]);

    expect(queue.queue.map((entry) => entry.tag)).toEqual(list === 'queue' ? [tag] : []);
    expect(queue.waiting).toEqual(list === 'waiting' ? [pr] : []);
  });
});

describe('renderQueue', () => {
  it('numbers the queue in merge order and gives the reason for each PR not ready', () => {
    const dialog = {
      ...unreviewedGreenPr(496, 'main', 'dialog'),
      title: 'feat(web): encounter dialog',
    };
    const draw = { ...unreviewedGreenPr(501, 'dialog', 'draw'), title: 'feat(web): draw a card' };
    const bump: OpenPr = {
      ...unreviewedGreenPr(154, 'main', 'dependabot/actions'),
      title: 'ci: bump actions',
      checks: { kind: 'failed', names: ['bundle-size'] },
    };

    const body = renderQueue(buildQueue([draw, bump, dialog]));

    expect(body).toContain(
      [
        '## Queue (2)',
        '',
        '1. #496 feat(web): encounter dialog (to review)',
        '2. #501 feat(web): draw a card (to review, after #496)',
        '',
        '## Not ready (1)',
        '',
        '- #154 ci: bump actions: failed bundle-size',
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
      ...unreviewedGreenPr(443, 'main', 'release'),
      title: 'chore: release',
      ...state,
    };

    expect(renderQueue(buildQueue([pr]))).toContain(`- #443 chore: release: ${reason}`);
  });

  it('lists PRs waiting on their author under their own heading', () => {
    const pr: OpenPr = {
      ...unreviewedGreenPr(500, 'main', 'agenda'),
      title: 'feat(web): full agenda',
      headSha: 'head_commit',
      review: { state: 'CHANGES_REQUESTED', sha: 'head_commit' },
    };

    expect(renderQueue(buildQueue([pr]))).toContain(
      '## Waiting on the author (1)\n\n- #500 feat(web): full agenda',
    );
  });

  it('says so when nothing is left to review', () => {
    expect(renderQueue({ queue: [], waiting: [], notReady: [] })).toContain(
      '## Queue (0)\n\nNothing to review.',
    );
  });
});
