import { describe, expect, it } from 'vitest';
import { instanceId, type Rejection, type RejectionCode } from '@arkham/engine';
import { cardActionRefusal, refusalKind, type RefusalKind } from './refusals';

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

describe("why a card action's effect was refused", () => {
  const nothingBeneath: Rejection = { code: 'nothingBeneath', locationId: instanceId('uptown') };

  it('is the reason its effect was refused for, however deep it is wrapped', () => {
    const wrapped: Rejection = {
      code: 'triggeredCommandRejected',
      command: 'UseCardAction',
      reason: { code: 'triggeredCommandRejected', command: 'DrawBeneath', reason: nothingBeneath },
    };

    expect(cardActionRefusal(wrapped)).toEqual(nothingBeneath);
  });

  it('is the rejection itself when nothing wraps it', () => {
    expect(cardActionRefusal(nothingBeneath)).toEqual(nothingBeneath);
  });
});
