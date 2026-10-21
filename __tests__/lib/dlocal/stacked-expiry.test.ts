/**
 * Stacked expiry for a dLocal payment (Manage Subscription S4, decision D6,
 * defect B10). `lib/dlocal/stacked-expiry.ts` is a byte copy of
 * `money-service/src/dlocal/stacked-expiry.ts`; the last test fails on any
 * difference.
 *
 * @module __tests__/lib/dlocal/stacked-expiry.test
 */

import fs from 'fs';
import path from 'path';

import { currentExpiryOf, stackedExpiry } from '@/lib/dlocal/stacked-expiry';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-21T12:00:00.000Z');

describe('stackedExpiry (D6: max(now, current expiry) + duration)', () => {
  it('an early renewal keeps the days left: 10 days left + 30 days', () => {
    const current = new Date(NOW + 10 * DAY);
    expect(stackedExpiry(current, 30, NOW).getTime()).toBe(NOW + 40 * DAY);
  });

  it('the B10 case: an early renewal is NOT now + duration', () => {
    const current = new Date(NOW + 10 * DAY);
    expect(stackedExpiry(current, 30, NOW).getTime()).not.toBe(NOW + 30 * DAY);
  });

  it('a renewal after the plan ended starts now', () => {
    const current = new Date(NOW - 2 * DAY);
    expect(stackedExpiry(current, 30, NOW).getTime()).toBe(NOW + 30 * DAY);
  });

  it('a renewal at the very second the plan ends starts there', () => {
    expect(stackedExpiry(new Date(NOW), 30, NOW).getTime()).toBe(
      NOW + 30 * DAY
    );
  });

  it.each([null, undefined])('no current expiry (%s) starts now', (value) => {
    expect(stackedExpiry(value, 365, NOW).getTime()).toBe(NOW + 365 * DAY);
  });

  it('an unreadable current expiry starts now', () => {
    expect(stackedExpiry('garbage', 30, NOW).getTime()).toBe(NOW + 30 * DAY);
  });

  it('reads an ISO string as well as a Date', () => {
    expect(
      stackedExpiry(new Date(NOW + 5 * DAY).toISOString(), 3, NOW).getTime()
    ).toBe(NOW + 8 * DAY);
  });

  it.each([
    ['THREE_DAY', 3],
    ['MONTHLY', 30],
    ['YEARLY', 365],
  ])('%s adds %s days', (_plan, days) => {
    const current = new Date(NOW + 7 * DAY);
    expect(stackedExpiry(current, days, NOW).getTime()).toBe(
      NOW + (7 + days) * DAY
    );
  });

  it('uses the clock when none is passed', () => {
    const before = Date.now();
    const result = stackedExpiry(null, 30).getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(result).toBeLessThanOrEqual(after + 30 * DAY);
  });
});

describe('currentExpiryOf (only a live dLocal plan counts)', () => {
  const future = new Date(NOW + 10 * DAY);

  it('an ACTIVE dLocal row gives its expiry', () => {
    expect(
      currentExpiryOf({
        status: 'ACTIVE',
        dLocalPaymentId: 'dl_1',
        expiresAt: future,
      })
    ).toEqual(future);
  });

  it('a Stripe row (no dLocal payment) gives nothing, even with a date months ahead', () => {
    expect(
      currentExpiryOf({
        status: 'ACTIVE',
        dLocalPaymentId: null,
        expiresAt: new Date(NOW + 300 * DAY),
      })
    ).toBeNull();
  });

  it('a lapsed dLocal row gives nothing', () => {
    expect(
      currentExpiryOf({
        status: 'CANCELED',
        dLocalPaymentId: 'dl_1',
        expiresAt: future,
      })
    ).toBeNull();
  });

  it.each([null, undefined])('no row (%s) gives nothing', (row) => {
    expect(currentExpiryOf(row)).toBeNull();
  });

  it('a row without a date, or with an unreadable one, gives nothing', () => {
    expect(
      currentExpiryOf({
        status: 'ACTIVE',
        dLocalPaymentId: 'dl_1',
        expiresAt: null,
      })
    ).toBeNull();
    expect(
      currentExpiryOf({
        status: 'ACTIVE',
        dLocalPaymentId: 'dl_1',
        expiresAt: 'garbage',
      })
    ).toBeNull();
  });
});

describe('the two copies', () => {
  const read = (file: string): string =>
    fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  it('lib/dlocal and money-service hold the same bytes', () => {
    expect(read('money-service/src/dlocal/stacked-expiry.ts')).toBe(
      read('lib/dlocal/stacked-expiry.ts')
    );
  });
});
