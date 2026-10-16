import { describe, expect, it } from 'vitest';
import { withRunningTotals } from './index';

describe('withRunningTotals', () => {
  it('adds each value to the total so far', () => {
    const payments = [{ amount: 3 }, { amount: 1 }, { amount: -2 }];

    expect(withRunningTotals(payments, (payment) => payment.amount)).toEqual([
      { amount: 3, total: 3 },
      { amount: 1, total: 4 },
      { amount: -2, total: 2 },
    ]);
  });

  it('starts from the given total', () => {
    const payments = [{ amount: 1 }, { amount: -2 }];

    expect(withRunningTotals(payments, (payment) => payment.amount, 4)).toEqual([
      { amount: 1, total: 5 },
      { amount: -2, total: 3 },
    ]);
  });

  it('leaves the items untouched', () => {
    const payments = [{ amount: 3 }];

    withRunningTotals(payments, (payment) => payment.amount);

    expect(payments).toEqual([{ amount: 3 }]);
  });

  it('is empty for an empty list', () => {
    expect(withRunningTotals([], () => 1, 4)).toEqual([]);
  });
});
