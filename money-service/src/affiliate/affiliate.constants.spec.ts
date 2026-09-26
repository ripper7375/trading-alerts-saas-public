import {
  AFFILIATE_CONFIG,
  getMaxCommissionCycles,
} from './affiliate.constants';

describe('getMaxCommissionCycles (24-month recurring-commission cap)', () => {
  it('caps a monthly subscription at 24 invoices and an annual one at 2', () => {
    expect(getMaxCommissionCycles('month')).toBe(24);
    expect(getMaxCommissionCycles('year')).toBe(2);
  });

  it('covers MAX_RECURRING_COMMISSION_MONTHS for both intervals', () => {
    expect(getMaxCommissionCycles('year') * 12).toBe(
      AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_MONTHS
    );
  });
});
