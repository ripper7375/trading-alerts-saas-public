/**
 * Payout-details hold, monolith side (WS-9, CODE-06A): the admin views print
 * when a new or changed Wise recipient may be paid. money-service enforces the
 * hold; this file is the hand-synced twin the views read (LESSONS-LEARNED L1:
 * money-service code is copied, never a shared package), so a parity test
 * holds the two together.
 */
import {
  PAYOUT_DETAILS_HOLD_HOURS,
  changedSinceLastPaid,
  isOnPayoutHold,
  payoutHoldUntil,
} from '@/lib/disbursement/payout-details-hold';
import * as money from '../../../money-service/src/disbursement/payout-details-hold';

const HOUR = 60 * 60 * 1000;

describe('payout-details hold (monolith twin)', () => {
  const changedAt = new Date('2026-10-23T10:00:00.000Z');

  it('is 72 hours, the same as money-service', () => {
    expect(PAYOUT_DETAILS_HOLD_HOURS).toBe(72);
    expect(PAYOUT_DETAILS_HOLD_HOURS).toBe(money.PAYOUT_DETAILS_HOLD_HOURS);
  });

  it('payoutHoldUntil is the change time plus the hold', () => {
    expect(payoutHoldUntil(changedAt).toISOString()).toBe(
      '2026-10-26T10:00:00.000Z'
    );
  });

  it('agrees with money-service about who is held, hour by hour around the edge', () => {
    for (const hours of [-1, 0, 1, 71, 71.99, 72, 72.01, 73, 500]) {
      const now = new Date(changedAt.getTime() + hours * HOUR);
      expect(isOnPayoutHold(changedAt, now)).toBe(
        money.isOnPayoutHold(changedAt, now)
      );
    }
    expect(isOnPayoutHold(null, changedAt)).toBe(false);
    expect(isOnPayoutHold(undefined, changedAt)).toBe(false);
  });

  it('holds until the 72nd hour and not after it', () => {
    expect(
      isOnPayoutHold(changedAt, new Date(changedAt.getTime() + 71 * HOUR))
    ).toBe(true);
    expect(
      isOnPayoutHold(changedAt, new Date(changedAt.getTime() + 72 * HOUR))
    ).toBe(false);
  });
});

describe('changedSinceLastPaid', () => {
  const changedAt = new Date('2026-10-23T10:00:00.000Z');

  it('is false when no change is on record', () => {
    expect(changedSinceLastPaid(null, null)).toBe(false);
    expect(changedSinceLastPaid(null, new Date('2026-01-01'))).toBe(false);
  });

  it('is true when the affiliate has never been paid and a change is on record', () => {
    expect(changedSinceLastPaid(changedAt, null)).toBe(true);
  });

  it('is true when the change is after the last payout', () => {
    expect(
      changedSinceLastPaid(changedAt, new Date('2026-10-01T00:00:00Z'))
    ).toBe(true);
  });

  it('is false when the last payout is after the change (they were already paid to these details)', () => {
    expect(
      changedSinceLastPaid(changedAt, new Date('2026-10-24T00:00:00Z'))
    ).toBe(false);
  });

  it('is true when the payout and the change are the same instant (not proven paid to the new details)', () => {
    expect(changedSinceLastPaid(changedAt, changedAt)).toBe(true);
  });
});
