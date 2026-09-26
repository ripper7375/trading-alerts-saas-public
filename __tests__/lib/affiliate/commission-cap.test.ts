/**
 * The recurring-commission cap is 24 months of subscription lifetime, not
 * 24 invoices: 24 monthly invoices or 2 annual ones.
 */

import {
  AFFILIATE_CONFIG,
  getMaxCommissionCycles,
} from '@/lib/affiliate/constants';

describe('getMaxCommissionCycles', () => {
  it('caps a monthly subscription at 24 invoices', () => {
    expect(getMaxCommissionCycles('month')).toBe(24);
  });

  it('caps an annual subscription at 2 invoices', () => {
    expect(getMaxCommissionCycles('year')).toBe(2);
  });

  it('covers the same number of months for both intervals', () => {
    const months = AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_MONTHS;
    expect(getMaxCommissionCycles('month') * 1).toBe(months);
    expect(getMaxCommissionCycles('year') * 12).toBe(months);
  });
});
