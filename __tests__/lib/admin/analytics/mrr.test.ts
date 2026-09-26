/**
 * MRR weights each PRO subscriber by billing interval: the monthly price,
 * or the annual price / 12.
 */

import { computeMrr } from '@/lib/admin/analytics/mrr';

describe('computeMrr', () => {
  it('counts monthly subscribers at the monthly price', () => {
    expect(
      computeMrr({
        monthlyProUsers: 10,
        annualProUsers: 0,
        monthlyPriceUsd: 29,
        annualPriceUsd: 290,
      })
    ).toMatchObject({ mrr: 290, arr: 3480 });
  });

  it('counts annual subscribers at the annual price / 12', () => {
    expect(
      computeMrr({
        monthlyProUsers: 0,
        annualProUsers: 12,
        monthlyPriceUsd: 29,
        annualPriceUsd: 290,
      })
    ).toMatchObject({ mrr: 290, arr: 3480 });
  });

  it('adds both groups', () => {
    const result = computeMrr({
      monthlyProUsers: 7,
      annualProUsers: 3,
      monthlyPriceUsd: 29,
      annualPriceUsd: 290,
    });
    expect(result.mrr).toBe(275.5);
    expect(result.arr).toBe(3306);
  });

  it('returns zero when there are no PRO users', () => {
    expect(
      computeMrr({
        monthlyProUsers: 0,
        annualProUsers: 0,
        monthlyPriceUsd: 29,
        annualPriceUsd: 290,
      })
    ).toMatchObject({ mrr: 0, arr: 0 });
  });
});
