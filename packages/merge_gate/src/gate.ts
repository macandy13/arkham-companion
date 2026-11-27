/**
 * The merge gate: decides whether a PR may merge without the owner's review. `gate.yml` runs
 * it on every push, review and comment and posts the outcome as the `gate` commit status, which
 * the `main` ruleset requires (milestone MA, `docs/automation.md`, "Merge gate").
 *
 * The owner reviews only what they can judge without reading code: a change to how the app looks
 * or behaves on screen, which always comes with a changed screenshot golden (coding guidelines
 * §3), and changes to the automation itself. Everything else passes on the session's verdict,
 * with the rules checker standing in for the owner on rule code.
 */
import { parseVerdict, type MergeVerdict } from './verdict.ts';

type Brand<T, B extends string> = T & { readonly __brand: B };

/** A full 40-character git commit hash. */
export type CommitSha = Brand<string, 'CommitSha'>;

/** A GitHub account name, as the REST API's `user.login` gives it (`arkham-claude[bot]`). */
export type GitHubLogin = Brand<string, 'GitHubLogin'>;

/** A repo-relative file path as GitHub lists a PR's changed files. */
export type RepoPath = Brand<string, 'RepoPath'>;

/** What the gate knows about a PR, read from the REST API by `gate.yml`. */
export interface PullRequestFacts {
  readonly headSha: CommitSha;
  readonly changedFiles: readonly RepoPath[];
  /** Submitted reviews, oldest first, as `GET /pulls/{n}/reviews` lists them. */
  readonly reviews: readonly PullRequestReview[];
  /** Conversation comments, oldest first, as `GET /issues/{n}/comments` lists them. */
  readonly comments: readonly PullRequestComment[];
}

/** One submitted review. Only the owner's count; comment-only reviews never change the outcome. */
export interface PullRequestReview {
  readonly author: GitHubLogin;
  /** The commit the review was given on; an approval passes only that commit. */
  readonly commit: CommitSha;
  readonly state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
}

/** One conversation comment; the gate looks for a `merge-verdict` block in it. */
export interface PullRequestComment {
  readonly author: GitHubLogin;
  readonly body: string;
}

/** Who the gate trusts: the owner, and the accounts allowed to post a verdict. */
export interface GatePolicy {
  readonly owner: GitHubLogin;
  /**
   * Accounts whose comments may carry a verdict. Sessions comment through the owner's
   * credential, so the owner's account is one of them; anyone else's verdict is ignored.
   */
  readonly verdictAuthors: readonly GitHubLogin[];
}

/**
 * The gate's decision. `needs-owner` and `waiting` keep the status pending (the PR can't merge
 * yet, nothing is wrong); `blocked` fails it, because the session has to fix something first.
 */
export type GateOutcome =
  | { readonly kind: 'pass'; readonly reason: string }
  | { readonly kind: 'needs-owner'; readonly reason: string }
  | { readonly kind: 'waiting'; readonly reason: string }
  | { readonly kind: 'blocked'; readonly reason: string };

/**
 * Changes the owner always sees: screenshot goldens, and everything that decides what this gate
 * lets through (the workflows, the gate's own code, the session setup and the review rules the
 * verdict stands for), so the gate can't be loosened without them.
 */
const OWNER_PATHS: readonly { readonly prefix: string; readonly what: string }[] = [
  { prefix: 'apps/web/e2e/__screenshots__/', what: 'changes a screenshot golden' },
  { prefix: '.github/', what: 'changes the GitHub automation' },
  { prefix: 'packages/merge_gate/', what: 'changes the merge gate' },
  { prefix: '.claude/', what: 'changes the Claude Code setup' },
  { prefix: 'CLAUDE.md', what: 'changes the session instructions' },
  { prefix: 'REVIEW.md', what: 'changes the review rules' },
];

/** Code whose game rules the rules checker has to confirm before the PR passes without the owner. */
const RULES_PATHS: readonly string[] = [
  'packages/engine/src/',
  'packages/scenarios/src/',
  'packages/carddata/src/',
  'docs/rules/',
];

/**
 * Decides the gate for a PR. The owner's approval of the head commit always passes it; their
 * latest review asking for changes always sends it back to them. An approval of an earlier commit
 * counts for nothing, so a push after it is judged like any other. Without the owner, a PR passes only when it changes
 * nothing the owner reviews, the newest trusted verdict is for the head commit, the reviewer
 * passed it, and, when rule code changed, the rules checker did too.
 */
export function decideGate(pr: PullRequestFacts, policy: GatePolicy): GateOutcome {
  const ownerReview = latestOwnerReview(pr.reviews, policy.owner);
  if (ownerReview?.state === 'APPROVED' && ownerReview.commit === pr.headSha) {
    return { kind: 'pass', reason: 'Approved by the owner.' };
  }
  if (ownerReview?.state === 'CHANGES_REQUESTED') {
    return {
      kind: 'needs-owner',
      reason: 'The owner asked for changes; their approval is needed.',
    };
  }

  const ownerReasons = OWNER_PATHS.filter(({ prefix }) =>
    pr.changedFiles.some((file) => file.startsWith(prefix)),
  ).map(({ what }) => what);
  if (ownerReasons.length > 0) {
    return {
      kind: 'needs-owner',
      reason: `Needs the owner's review: the PR ${ownerReasons.join(' and ')}.`,
    };
  }

  const verdict = latestVerdict(pr.comments, policy.verdictAuthors);
  const shortSha = pr.headSha.slice(0, 7);
  if (verdict?.sha !== pr.headSha) {
    return { kind: 'waiting', reason: `Waiting for the session's review verdict on ${shortSha}.` };
  }
  if (verdict.reviewer === 'fail') {
    return { kind: 'blocked', reason: `The reviewer found blocking issues on ${shortSha}.` };
  }
  const touchesRules = pr.changedFiles.some((file) =>
    RULES_PATHS.some((prefix) => file.startsWith(prefix)),
  );
  if (touchesRules && verdict.rules !== 'pass') {
    return {
      kind: 'blocked',
      reason: `The PR changes rule code and the rules checker didn't confirm it on ${shortSha}.`,
    };
  }
  return {
    kind: 'pass',
    reason: touchesRules
      ? `Reviewer and rules checker passed ${shortSha}.`
      : `Reviewer passed ${shortSha}.`,
  };
}

// GitHub lists every review ever submitted; only the owner's last approving or rejecting one says
// where they stand, as a later comment-only review doesn't withdraw an approval.
function latestOwnerReview(
  reviews: readonly PullRequestReview[],
  owner: GitHubLogin,
): PullRequestReview | undefined {
  return reviews
    .filter(
      (review) =>
        review.author === owner &&
        (review.state === 'APPROVED' ||
          review.state === 'CHANGES_REQUESTED' ||
          review.state === 'DISMISSED'),
    )
    .at(-1);
}

function latestVerdict(
  comments: readonly PullRequestComment[],
  authors: readonly GitHubLogin[],
): MergeVerdict | undefined {
  return comments
    .filter((comment) => authors.includes(comment.author))
    .map((comment) => parseVerdict(comment.body))
    .filter((verdict) => verdict !== undefined)
    .at(-1);
}
