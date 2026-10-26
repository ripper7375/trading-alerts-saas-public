/**
 * The Stripe tier rule (Manage Subscription S1, defect B1).
 *
 * `lib/stripe/tier-rule.ts` is a byte copy of
 * `money-service/src/stripe/tier-rule.ts`; the second test fails on any
 * difference, so the monolith webhook and money-service's cannot drift. The
 * same table is asserted in money-service's own spec.
 *
 * @module __tests__/lib/stripe/tier-rule.test
 */

import fs from 'fs';
import path from 'path';

import { tierForStripeStatus } from '@/lib/stripe/tier-rule';

describe('tierForStripeStatus', () => {
  it.each([
    ['active', 'PRO'],
    ['trialing', 'PRO'],
    ['past_due', 'PRO'],
    ['unpaid', 'FREE'],
    ['canceled', 'FREE'],
    ['incomplete', 'FREE'],
    ['incomplete_expired', 'FREE'],
    ['paused', 'FREE'],
  ])('%s -> %s', (status, tier) => {
    expect(tierForStripeStatus(status)).toBe(tier);
  });

  it('treats a status it does not know as FREE', () => {
    expect(tierForStripeStatus('something_new')).toBe('FREE');
    expect(tierForStripeStatus('')).toBe('FREE');
  });

  it('does not read inherited object keys as statuses', () => {
    expect(tierForStripeStatus('toString')).toBe('FREE');
    expect(tierForStripeStatus('__proto__')).toBe('FREE');
  });
});

describe('the monolith and money-service copies of the tier rule', () => {
  const read = (file: string): string =>
    fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  it('are identical', () => {
    expect(read('money-service/src/stripe/tier-rule.ts')).toBe(
      read('lib/stripe/tier-rule.ts')
    );
  });
});
