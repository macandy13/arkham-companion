import { describe, expect, it } from 'vitest';
import type { CommitSha } from './gate.ts';
import { formatVerdictComment, parseVerdict, type MergeVerdict } from './verdict.ts';

const headSha = 'c'.repeat(40) as CommitSha;

describe('formatVerdictComment', () => {
  it.each<{ verdict: MergeVerdict; line: string }>([
    {
      verdict: { sha: headSha, reviewer: 'pass', rules: 'pass' },
      line: '**Merge verdict** for ccccccc: reviewer: pass · rules checker: pass',
    },
    {
      verdict: { sha: headSha, reviewer: 'fail', rules: 'none' },
      line: '**Merge verdict** for ccccccc: reviewer: fail · no rules checked',
    },
  ])('says $line and reads back as the same verdict', ({ verdict, line }) => {
    const comment = formatVerdictComment(verdict);

    expect(comment.split('\n')[0]).toBe(line);
    expect(parseVerdict(comment)).toEqual(verdict);
  });
});

describe('parseVerdict', () => {
  it('ignores a block that is not JSON', () => {
    expect(parseVerdict('<!-- merge-verdict {sha: oops} -->')).toBeUndefined();
  });
});
