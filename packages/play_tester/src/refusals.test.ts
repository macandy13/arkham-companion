import { describe, expect, it } from 'vitest';
import type { RejectionCode } from '@arkham/engine';
import { refusalKind, type RefusalKind } from './refusals';

describe('how a refused step is judged', () => {
  it.each<{ code: RejectionCode; kind: RefusalKind }>([
    { code: 'notConnected', kind: 'expected' },
    { code: 'decisionPending', kind: 'expected' },
    { code: 'turnsNotTaken', kind: 'expected' },
    { code: 'cardActionLimitReached', kind: 'expected' },
    { code: 'unknownCard', kind: 'never' },
    { code: 'invalidDecisionOptions', kind: 'never' },
    { code: 'unknownOption', kind: 'never' },
    { code: 'triggeredCommandRejected', kind: 'never' },
  ])('marks $code as $kind', ({ code, kind }) => {
    expect(refusalKind(code)).toBe(kind);
  });
});
