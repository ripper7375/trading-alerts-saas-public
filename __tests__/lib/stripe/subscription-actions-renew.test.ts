/**
 * The dLocal part of the actions module (Manage Subscription S4, workflow W6;
 * plan §5, §6 and §7): the EXPIRING display state, `renew_now`, and
 * `renewsAutomatically`. The mirror test in `subscription-actions.test.ts`
 * keeps the money-service copy identical, so these cases cover both stacks.
 *
 * @module __tests__/lib/stripe/subscription-actions-renew.test
 */

import {
  EXPIRING_WINDOW_HOURS,
  allowedActionsOf,
  displayStateOf,
  isWithinExpiringWindow,
  renewsAutomatically,
  type SubscriptionFacts,
} from '@/lib/stripe/subscription-actions';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function inHours(hours: number): Date {
  return new Date(NOW.getTime() + hours * HOUR);
}

function dLocal(overrides: Partial<SubscriptionFacts>): SubscriptionFacts {
  return {
    tier: 'PRO',
    status: 'ACTIVE',
    provider: 'DLOCAL',
    openInvoiceUrl: null,
    planType: 'MONTHLY',
    expiresAt: inHours(24 * 20),
    now: NOW,
    ...overrides,
  };
}

describe('isWithinExpiringWindow (W6: three days)', () => {
  it('the window is 72 hours', () => {
    expect(EXPIRING_WINDOW_HOURS).toBe(72);
  });

  it.each([
    [24 * 20, false],
    [73, false],
    [72.01, false],
    // The boundary itself is inside: "within 3 days".
    [72, true],
    [71, true],
    [1, true],
    [0, true],
    // Past its date but not yet downgraded by the daily cron: still PRO, still
    // renewable, so still EXPIRING.
    [-5, true],
  ])('%s hours left -> %s', (hours, expected) => {
    expect(isWithinExpiringWindow(inHours(hours), NOW)).toBe(expected);
  });

  it('reads an ISO string as well as a Date', () => {
    expect(isWithinExpiringWindow(inHours(10).toISOString(), NOW)).toBe(true);
    expect(isWithinExpiringWindow(inHours(100).toISOString(), NOW)).toBe(false);
  });

  it.each([null, undefined, 'not a date'])(
    'an unknown or unreadable date (%s) is never EXPIRING',
    (value) => {
      expect(isWithinExpiringWindow(value, NOW)).toBe(false);
    }
  );
});

describe('displayStateOf: EXPIRING', () => {
  it('a dLocal plan 20 days from its end is ACTIVE', () => {
    expect(displayStateOf(dLocal({}))).toBe('ACTIVE');
  });

  it('a dLocal plan 71 hours from its end is EXPIRING', () => {
    expect(displayStateOf(dLocal({ expiresAt: inHours(71) }))).toBe('EXPIRING');
  });

  it('a dLocal plan 73 hours from its end is still ACTIVE', () => {
    expect(displayStateOf(dLocal({ expiresAt: inHours(73) }))).toBe('ACTIVE');
  });

  it('a dLocal row with no date is ACTIVE, never EXPIRING', () => {
    expect(displayStateOf(dLocal({ expiresAt: null }))).toBe('ACTIVE');
    expect(displayStateOf(dLocal({ expiresAt: undefined }))).toBe('ACTIVE');
  });

  it('only an ACTIVE dLocal plan is EXPIRING', () => {
    expect(
      displayStateOf(dLocal({ status: 'CANCELED', expiresAt: inHours(10) }))
    ).not.toBe('EXPIRING');
    expect(
      displayStateOf(
        dLocal({ tier: 'FREE', status: 'ACTIVE', expiresAt: inHours(10) })
      )
    ).toBe('FREE');
  });

  it('a Stripe subscription is never EXPIRING, whatever date its row holds', () => {
    expect(
      displayStateOf(dLocal({ provider: 'STRIPE', expiresAt: inHours(10) }))
    ).toBe('ACTIVE');
    expect(
      displayStateOf(dLocal({ provider: null, expiresAt: inHours(10) }))
    ).toBe('ACTIVE');
  });

  it('a failed payment outranks EXPIRING', () => {
    expect(
      displayStateOf(dLocal({ status: 'PAST_DUE', expiresAt: inHours(10) }))
    ).toBe('PAST_DUE');
  });
});

describe('allowedActionsOf: renew_now (W6)', () => {
  it('an ACTIVE dLocal plan can be renewed at any time, with nothing else', () => {
    expect(allowedActionsOf(dLocal({}))).toEqual(['renew_now']);
    expect(allowedActionsOf(dLocal({ planType: 'YEARLY' }))).toEqual([
      'renew_now',
    ]);
  });

  it('an EXPIRING dLocal plan can be renewed, with nothing else', () => {
    expect(allowedActionsOf(dLocal({ expiresAt: inHours(10) }))).toEqual([
      'renew_now',
    ]);
  });

  it('a dLocal plan past its date (cron not yet run) can still be renewed', () => {
    expect(allowedActionsOf(dLocal({ expiresAt: inHours(-3) }))).toEqual([
      'renew_now',
    ]);
  });

  it('a dLocal plan has no cancel and no billing-period action (D8)', () => {
    const actions = allowedActionsOf(dLocal({ planType: 'MONTHLY' }));
    expect(actions).not.toContain('cancel');
    expect(actions).not.toContain('update_card');
    expect(actions).not.toContain('upgrade_to_yearly');
    expect(actions).not.toContain('switch_to_monthly');
  });

  it('admin view-as hides it', () => {
    expect(
      allowedActionsOf(dLocal({ expiresAt: inHours(10), viewing: true }))
    ).toEqual([]);
  });

  it('a Stripe subscription is never offered it', () => {
    expect(
      allowedActionsOf(dLocal({ provider: 'STRIPE', expiresAt: inHours(10) }))
    ).not.toContain('renew_now');
    expect(allowedActionsOf(dLocal({ provider: null }))).toEqual([]);
  });

  it('a FREE user or a lapsed row is offered nothing', () => {
    expect(allowedActionsOf(dLocal({ tier: 'FREE' }))).toEqual([]);
    expect(allowedActionsOf(dLocal({ status: 'CANCELED' }))).toEqual([]);
  });
});

describe('renewsAutomatically', () => {
  it('a dLocal plan never renews by itself (B10 / D8: it is prepaid)', () => {
    expect(
      renewsAutomatically({ provider: 'DLOCAL', cancelAtPeriodEnd: false })
    ).toBe(false);
    expect(renewsAutomatically({ provider: 'DLOCAL' })).toBe(false);
  });

  it('a Stripe subscription renews until its cancellation is scheduled', () => {
    expect(
      renewsAutomatically({ provider: 'STRIPE', cancelAtPeriodEnd: false })
    ).toBe(true);
    expect(renewsAutomatically({ provider: 'STRIPE' })).toBe(true);
    expect(
      renewsAutomatically({ provider: 'STRIPE', cancelAtPeriodEnd: true })
    ).toBe(false);
  });

  it('a row with no provider renews nothing', () => {
    expect(renewsAutomatically({ provider: null })).toBe(false);
  });
});
