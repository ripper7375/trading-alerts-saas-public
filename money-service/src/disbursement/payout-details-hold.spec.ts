/**
 * Payout-details hold (WS-9, CODE-06A): the 72-hour hold on a new or changed
 * Wise payout recipient, and what counts as a new or changed one.
 */
import {
  PAYOUT_DETAILS_HOLD_HOURS,
  classifyRecipientChange,
  isOnPayoutHold,
  payoutHoldCutoff,
  payoutHoldUntil,
} from './payout-details-hold';

const HOUR = 60 * 60 * 1000;

describe('payout-details hold window', () => {
  const changedAt = new Date('2026-10-23T10:00:00.000Z');

  it('is 72 hours', () => {
    expect(PAYOUT_DETAILS_HOLD_HOURS).toBe(72);
  });

  it('payoutHoldUntil is the change time plus 72 hours', () => {
    expect(payoutHoldUntil(changedAt).toISOString()).toBe(
      '2026-10-26T10:00:00.000Z'
    );
  });

  it('payoutHoldCutoff is now minus 72 hours', () => {
    const now = new Date('2026-10-26T10:00:00.000Z');
    expect(payoutHoldCutoff(now).toISOString()).toBe(changedAt.toISOString());
  });

  it('a recipient with no recorded change is never held', () => {
    expect(isOnPayoutHold(null, changedAt)).toBe(false);
    expect(isOnPayoutHold(undefined, changedAt)).toBe(false);
  });

  it.each([
    ['at the moment of the change', 0, true],
    ['one hour after', 1, true],
    ['71 hours 59 minutes after', 72 - 1 / 60, true],
    ['exactly 72 hours after', 72, false],
    ['73 hours after', 73, false],
  ])('is held %s: %s', (_label, hours, held) => {
    const now = new Date(changedAt.getTime() + hours * HOUR);
    expect(isOnPayoutHold(changedAt, now)).toBe(held);
  });

  it('a change time in the future (clock skew) is held', () => {
    const now = new Date(changedAt.getTime() - HOUR);
    expect(isOnPayoutHold(changedAt, now)).toBe(true);
  });

  it('agrees with the cutoff the eligibility query uses', () => {
    const now = new Date('2026-10-26T10:00:00.000Z');
    const cutoff = payoutHoldCutoff(now);
    // held <=> changedAt is later than the cutoff
    for (const hours of [-1, 0, 1, 71, 72, 73]) {
      const at = new Date(changedAt.getTime() + hours * HOUR);
      expect(isOnPayoutHold(at, now)).toBe(at.getTime() > cutoff.getTime());
    }
  });
});

describe('classifyRecipientChange', () => {
  const active = {
    status: 'ACTIVE',
    detailsFingerprint: 'fp-1',
    accountHolderName: 'Jane Doe',
    targetCurrency: 'GBP',
    recipientCountry: 'GB',
    legalType: 'PRIVATE',
    requirementsType: 'sort_code',
  };
  const next = {
    detailsFingerprint: 'fp-1',
    accountHolderName: 'Jane Doe',
    targetCurrency: 'GBP',
    recipientCountry: 'GB',
    legalType: 'PRIVATE',
    requirementsType: 'sort_code',
  };

  it('the first recipient of an account is an addition', () => {
    expect(classifyRecipientChange(null, next)).toBe('ADDED');
    expect(classifyRecipientChange(undefined, next)).toBe('ADDED');
  });

  it('a recipient added again after a removal is an addition, even with identical details', () => {
    expect(
      classifyRecipientChange({ ...active, status: 'ARCHIVED' }, next)
    ).toBe('ADDED');
  });

  it.each(['INVALID', 'DRAFT', 'PENDING_DETAILS'])(
    'a %s recipient submitted again is held, as a replacement',
    (status) => {
      expect(classifyRecipientChange({ ...active, status }, next)).toBe(
        'REPLACED'
      );
    }
  );

  it('an identical re-submission on an ACTIVE recipient is not a change', () => {
    expect(classifyRecipientChange(active, next)).toBeNull();
  });

  it.each([
    ['detailsFingerprint', 'fp-2'],
    ['accountHolderName', 'John Roe'],
    ['targetCurrency', 'EUR'],
    ['recipientCountry', 'DE'],
    ['legalType', 'BUSINESS'],
    ['requirementsType', 'iban'],
  ])('a different %s is a replacement', (field, value) => {
    expect(classifyRecipientChange(active, { ...next, [field]: value })).toBe(
      'REPLACED'
    );
  });

  it('a stored recipient with no fingerprint is treated as changed', () => {
    expect(
      classifyRecipientChange({ ...active, detailsFingerprint: null }, next)
    ).toBe('REPLACED');
  });
});
