import { describe, expect, it } from 'vitest';
import {
  decideGate,
  type CommitSha,
  type GatePolicy,
  type GitHubLogin,
  type PullRequestComment,
  type PullRequestFacts,
  type PullRequestReview,
  type RepoPath,
} from './gate.ts';

const owner = 'macandy13' as GitHubLogin;
const bot = 'arkham-claude[bot]' as GitHubLogin;
const stranger = 'someone-else' as GitHubLogin;
const policy: GatePolicy = { owner, verdictAuthors: [owner, bot] };

const headSha = 'a'.repeat(40) as CommitSha;
const olderSha = 'b'.repeat(40) as CommitSha;

const testFile = 'apps/web/src/play/header.test.tsx' as RepoPath;
const engineFile = 'packages/engine/src/doom.ts' as RepoPath;
const goldenFile = 'apps/web/e2e/__screenshots__/desktop/shots/play.png' as RepoPath;
const workflowFile = '.github/workflows/ci.yml' as RepoPath;

function verdictComment(author: GitHubLogin, verdict: object): PullRequestComment {
  return { author, body: `Review done.\n<!-- merge-verdict ${JSON.stringify(verdict)} -->` };
}

function pr(facts: Partial<PullRequestFacts>): PullRequestFacts {
  return { headSha, changedFiles: [], reviews: [], comments: [], ...facts };
}

describe('decideGate', () => {
  it('passes a PR the owner approved, whatever it changes', () => {
    const approved: PullRequestReview = { author: owner, state: 'APPROVED' };

    const outcome = decideGate(
      pr({ changedFiles: [goldenFile, workflowFile], reviews: [approved] }),
      policy,
    );

    expect(outcome).toEqual({ kind: 'pass', reason: 'Approved by the owner.' });
  });

  it.each<{ name: string; reviews: PullRequestReview[]; kind: string }>([
    {
      name: 'a later request for changes withdraws an approval',
      reviews: [
        { author: owner, state: 'APPROVED' },
        { author: owner, state: 'CHANGES_REQUESTED' },
      ],
      kind: 'needs-owner',
    },
    {
      name: 'a later comment-only review keeps the approval',
      reviews: [
        { author: owner, state: 'APPROVED' },
        { author: owner, state: 'COMMENTED' },
      ],
      kind: 'pass',
    },
    {
      name: "someone else's approval doesn't count",
      reviews: [{ author: stranger, state: 'APPROVED' }],
      kind: 'needs-owner',
    },
  ])('$name', ({ reviews, kind }) => {
    const outcome = decideGate(pr({ changedFiles: [goldenFile], reviews }), policy);

    expect(outcome.kind).toBe(kind);
  });

  it.each<{ file: RepoPath; reason: string }>([
    { file: goldenFile, reason: "Needs the owner's review: the PR changes a screenshot golden." },
    {
      file: workflowFile,
      reason: "Needs the owner's review: the PR changes the GitHub automation.",
    },
    {
      file: '.claude/agents/pr-reviewer.md' as RepoPath,
      reason: "Needs the owner's review: the PR changes the Claude Code setup.",
    },
  ])('sends $file to the owner even with a passing verdict', ({ file, reason }) => {
    const passing = verdictComment(bot, { sha: headSha, reviewer: 'pass', rules: 'pass' });

    const outcome = decideGate(pr({ changedFiles: [file], comments: [passing] }), policy);

    expect(outcome).toEqual({ kind: 'needs-owner', reason });
  });

  it.each<{ name: string; comments: PullRequestComment[]; kind: string }>([
    { name: 'no verdict yet', comments: [], kind: 'waiting' },
    {
      name: 'a verdict for an older commit',
      comments: [verdictComment(bot, { sha: olderSha, reviewer: 'pass', rules: 'none' })],
      kind: 'waiting',
    },
    {
      name: "a verdict from an account that isn't trusted",
      comments: [verdictComment(stranger, { sha: headSha, reviewer: 'pass', rules: 'none' })],
      kind: 'waiting',
    },
    {
      name: 'a malformed verdict',
      comments: [{ author: bot, body: '<!-- merge-verdict {"sha": "aaa", "reviewer": "yes"} -->' }],
      kind: 'waiting',
    },
    {
      name: 'a failing review',
      comments: [verdictComment(bot, { sha: headSha, reviewer: 'fail', rules: 'none' })],
      kind: 'blocked',
    },
    {
      name: 'a passing review posted through the owner account',
      comments: [verdictComment(owner, { sha: headSha, reviewer: 'pass', rules: 'none' })],
      kind: 'pass',
    },
    {
      name: 'a newer failing verdict after a passing one',
      comments: [
        verdictComment(bot, { sha: headSha, reviewer: 'pass', rules: 'none' }),
        verdictComment(bot, { sha: headSha, reviewer: 'fail', rules: 'none' }),
      ],
      kind: 'blocked',
    },
  ])('a test-only PR with $name: $kind', ({ comments, kind }) => {
    const outcome = decideGate(pr({ changedFiles: [testFile], comments }), policy);

    expect(outcome.kind).toBe(kind);
  });

  it.each<{ rules: string; kind: string }>([
    { rules: 'pass', kind: 'pass' },
    { rules: 'fail', kind: 'blocked' },
    { rules: 'none', kind: 'blocked' },
  ])('a PR changing rule code with rules "$rules": $kind', ({ rules, kind }) => {
    const verdict = verdictComment(bot, { sha: headSha, reviewer: 'pass', rules });

    const outcome = decideGate(pr({ changedFiles: [engineFile], comments: [verdict] }), policy);

    expect(outcome.kind).toBe(kind);
  });
});
