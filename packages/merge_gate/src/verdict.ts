import type { CommitSha } from './gate.ts';

/**
 * The review result a session posts on its PR as a hidden comment block,
 * `<!-- merge-verdict {…} -->`, after the `pr-reviewer` and `rules-checker` subagents ran on the
 * head commit. The reviews run inside the session, on the subscription, so CI pays no tokens: the
 * gate (`decideGate`) only reads this block. It counts only for the commit it names, so a push
 * after the review needs a new verdict.
 */
export interface MergeVerdict {
  readonly sha: CommitSha;
  /** `pass` when `pr-reviewer` left no blocking finding. */
  readonly reviewer: ReviewResult;
  /**
   * `pass` when `rules-checker` confirmed every rule claim of the change; `none` when the session
   * found no rule to check. On a PR that touches rule code the gate blocks on `none` as on `fail`.
   */
  readonly rules: ReviewResult | 'none';
}

/** What one reviewing subagent concluded. */
type ReviewResult = 'pass' | 'fail';

const VERDICT_BLOCK = /^<!-- merge-verdict (\{.*\}) -->$/m;
const RESULTS: readonly string[] = ['pass', 'fail'];

/**
 * Reads the verdict block from a comment body. Returns `undefined` for a comment without one or
 * with a malformed one: a broken block must not count as a pass, and the gate then simply keeps
 * waiting for a valid verdict.
 */
export function parseVerdict(body: string): MergeVerdict | undefined {
  const match = VERDICT_BLOCK.exec(body);
  if (match === null) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(match[1] ?? '');
  } catch (error) {
    console.warn('merge-verdict block is not valid JSON, ignoring it:', error);
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { sha, reviewer, rules } = raw as Record<string, unknown>;
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) return undefined;
  if (typeof reviewer !== 'string' || !RESULTS.includes(reviewer)) return undefined;
  if (typeof rules !== 'string' || ![...RESULTS, 'none'].includes(rules)) return undefined;
  return {
    sha: sha as CommitSha,
    reviewer: reviewer as ReviewResult,
    rules: rules as MergeVerdict['rules'],
  };
}
