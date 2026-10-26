/**
 * The recurring-commission cap is 24 months of subscription lifetime, not
 * 24 invoices: 24 monthly invoices or 2 annual ones.
 */

import {
  AFFILIATE_CONFIG,
  commissionMonthsBefore,
  commissionMonthsForInterval,
  commissionWindow,
  getMaxCommissionCycles,
  type CommissionBillingInterval,
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

describe('commissionMonthsForInterval (E4)', () => {
  it('a monthly invoice covers 1 month and a yearly invoice 12', () => {
    expect(commissionMonthsForInterval('month')).toBe(1);
    expect(commissionMonthsForInterval('year')).toBe(12);
  });
});

describe('commissionMonthsBefore (E4)', () => {
  it('adds up what Stripe says each earlier invoice covered', () => {
    expect(
      commissionMonthsBefore(
        ['in_1', 'in_2', 'in_3'],
        { in_1: 1, in_2: 1, in_3: 12 },
        1
      )
    ).toBe(14);
  });

  it('counts an invoice Stripe cannot resolve as the fallback', () => {
    expect(commissionMonthsBefore(['in_1', 'in_2'], { in_1: 12 }, 1)).toBe(13);
    expect(commissionMonthsBefore(['in_1', 'in_2'], { in_1: 12 }, 12)).toBe(24);
  });

  it('counts a row with no invoice id (an older commission) as the fallback', () => {
    expect(commissionMonthsBefore([null, 'in_2'], { in_2: 12 }, 1)).toBe(13);
  });

  it('counts everything as the fallback when Stripe gave no answer', () => {
    expect(commissionMonthsBefore(['in_1', 'in_2', 'in_3'], null, 12)).toBe(36);
  });

  it('ignores a nonsensical months value', () => {
    expect(commissionMonthsBefore(['in_1'], { in_1: 0 }, 1)).toBe(1);
    expect(commissionMonthsBefore(['in_1'], { in_1: -3 }, 1)).toBe(1);
  });

  it('nothing before is zero months', () => {
    expect(commissionMonthsBefore([], {}, 12)).toBe(0);
  });
});

describe('commissionWindow (E4: months of lifetime, cap 24)', () => {
  it('pays while fewer than 24 months came before, and reports the cap on the invoice that reaches it', () => {
    expect(commissionWindow(0, 'month')).toEqual({
      payable: true,
      months: 1,
      capReached: false,
    });
    expect(commissionWindow(22, 'month')).toEqual({
      payable: true,
      months: 1,
      capReached: false,
    });
    expect(commissionWindow(23, 'month')).toEqual({
      payable: true,
      months: 1,
      capReached: true,
    });
    expect(commissionWindow(24, 'month')).toMatchObject({
      payable: false,
      capReached: true,
    });
  });

  it('an invoice that crosses month 24 is paid in full; the next one is not', () => {
    expect(commissionWindow(23, 'year')).toEqual({
      payable: true,
      months: 12,
      capReached: true,
    });
    expect(commissionWindow(35, 'month')).toMatchObject({ payable: false });
  });

  it('a yearly invoice pays at 0 and 12 months before, not at 24', () => {
    expect(commissionWindow(0, 'year')).toMatchObject({
      payable: true,
      capReached: false,
    });
    expect(commissionWindow(12, 'year')).toMatchObject({
      payable: true,
      capReached: true,
    });
    expect(commissionWindow(24, 'year')).toMatchObject({ payable: false });
  });

  /**
   * Plays a subscription's invoices through the same two functions the webhook
   * uses and returns which of them earned commission.
   */
  function play(intervals: CommissionBillingInterval[]): boolean[] {
    const paidMonths: number[] = [];
    const paid: boolean[] = [];
    intervals.forEach((interval) => {
      const monthsBefore = paidMonths.reduce((a, b) => a + b, 0);
      const window = commissionWindow(monthsBefore, interval);
      paid.push(window.payable);
      if (window.payable) paidMonths.push(window.months);
    });
    return paid;
  }
  const times = (n: number, interval: CommissionBillingInterval) =>
    Array.from({ length: n }, () => interval);
  const paidCount = (flags: boolean[]) => flags.filter(Boolean).length;

  it('never switched, monthly: exactly 24 invoices earn commission (the result before E4)', () => {
    const flags = play(times(30, 'month'));
    expect(paidCount(flags)).toBe(24);
    expect(flags.slice(0, 24).every(Boolean)).toBe(true);
    expect(flags[24]).toBe(false);
  });

  it('never switched, yearly: exactly 2 invoices earn commission (the result before E4)', () => {
    expect(play(times(4, 'year'))).toEqual([true, true, false, false]);
  });

  it('upgrade at invoice 5: the prorated yearly invoice earns commission (the old cap would have stopped it)', () => {
    const flags = play([...times(4, 'month'), 'year', 'year', 'year']);
    // 4 monthly + the upgrade invoice (cycle 5) + one yearly renewal reach 28
    // months, so the renewal after that earns nothing.
    expect(flags).toEqual([true, true, true, true, true, true, false]);
    expect(getMaxCommissionCycles('year')).toBe(2); // what the old rule applied to that invoice
  });

  it('downgrade after a yearly invoice: the monthly invoices run on to month 24', () => {
    const flags = play(['year', ...times(14, 'month')]);
    // 12 months from the yearly invoice, then 12 monthly invoices reach 24.
    expect(paidCount(flags)).toBe(13);
    expect(flags[12]).toBe(true);
    expect(flags[13]).toBe(false);
  });

  it('monthly for 23 months, then the upgrade: paid in full, then nothing more', () => {
    const flags = play([...times(23, 'month'), 'year', 'year']);
    expect(paidCount(flags)).toBe(24);
    expect(flags[23]).toBe(true);
    expect(flags[24]).toBe(false);
  });

  it('covers the same total lifetime however the plan switches', () => {
    expect(AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_MONTHS).toBe(24);
  });
});
