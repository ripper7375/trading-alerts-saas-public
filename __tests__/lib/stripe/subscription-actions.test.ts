/**
 * allowedActions and displayState (Manage Subscription S1, defects B2/B3;
 * plan §6). `lib/stripe/subscription-actions.ts` is a byte copy of
 * `money-service/src/stripe/subscription-actions.ts`; the last test fails on
 * any difference.
 *
 * @module __tests__/lib/stripe/subscription-actions.test
 */

import fs from 'fs';
import path from 'path';

import {
  allowedActionsOf,
  displayStateOf,
  isPaymentProblem,
  providerOf,
  showsSubscription,
  type SubscriptionFacts,
} from '@/lib/stripe/subscription-actions';

const INVOICE = 'https://invoice.stripe.com/i/acct_1/test_1';

function facts(overrides: Partial<SubscriptionFacts>): SubscriptionFacts {
  return {
    tier: 'PRO',
    status: 'ACTIVE',
    provider: 'STRIPE',
    openInvoiceUrl: null,
    ...overrides,
  };
}

describe('providerOf', () => {
  it.each([
    [{ dLocalPaymentId: 'dl_1', stripeSubscriptionId: null }, 'DLOCAL'],
    [{ dLocalPaymentId: null, stripeSubscriptionId: 'sub_1' }, 'STRIPE'],
    // dLocal wins when both are set: the precedence the page always had.
    [{ dLocalPaymentId: 'dl_1', stripeSubscriptionId: 'sub_1' }, 'DLOCAL'],
    [{ dLocalPaymentId: null, stripeSubscriptionId: null }, null],
    [{}, null],
  ])('%j -> %s', (row, expected) => {
    expect(providerOf(row)).toBe(expected);
  });
});

describe('showsSubscription (B2)', () => {
  it.each([
    ['PRO', 'ACTIVE', true],
    ['PRO', 'TRIALING', true],
    ['PRO', 'PAST_DUE', true],
    // The B2 cases: a FREE user with a failed payment still sees the block.
    ['FREE', 'PAST_DUE', true],
    ['FREE', 'UNPAID', true],
    ['FREE', 'CANCELED', false],
    ['FREE', 'INACTIVE', false],
    ['FREE', 'ACTIVE', false],
    ['FREE', null, false],
    ['PRO', null, false],
  ] as const)('tier %s, status %s -> %s', (tier, status, expected) => {
    expect(showsSubscription(tier, status)).toBe(expected);
  });

  it('isPaymentProblem is true for exactly PAST_DUE and UNPAID', () => {
    expect(isPaymentProblem('PAST_DUE')).toBe(true);
    expect(isPaymentProblem('UNPAID')).toBe(true);
    expect(isPaymentProblem('ACTIVE')).toBe(false);
    expect(isPaymentProblem(null)).toBe(false);
  });
});

describe('displayStateOf', () => {
  it.each([
    [{ tier: 'FREE', status: null }, 'FREE'],
    [{ tier: 'FREE', status: 'CANCELED' }, 'FREE'],
    [{ tier: 'PRO', status: 'ACTIVE' }, 'ACTIVE'],
    [{ tier: 'PRO', status: 'TRIALING' }, 'TRIALING'],
    [{ tier: 'PRO', status: 'PAST_DUE' }, 'PAST_DUE'],
    [{ tier: 'FREE', status: 'PAST_DUE' }, 'PAST_DUE'],
    [{ tier: 'FREE', status: 'UNPAID' }, 'UNPAID'],
    // A PRO user whose row says something else stays on the normal view.
    [{ tier: 'PRO', status: 'INACTIVE' }, 'ACTIVE'],
  ] as const)('%j -> %s', (input, expected) => {
    expect(displayStateOf(input)).toBe(expected);
  });

  describe('CANCEL_SCHEDULED (W3)', () => {
    it.each([
      ['ACTIVE', 'CANCEL_SCHEDULED'],
      // Cancelling during the trial ends the trial with no charge.
      ['TRIALING', 'CANCEL_SCHEDULED'],
      // A failed payment outranks a scheduled cancellation.
      ['PAST_DUE', 'PAST_DUE'],
      ['UNPAID', 'UNPAID'],
    ] as const)(
      'a Stripe %s subscription with the flag set -> %s',
      (status, expected) => {
        const tier = status === 'UNPAID' ? 'FREE' : 'PRO';
        expect(
          displayStateOf({
            tier,
            status,
            provider: 'STRIPE',
            cancelAtPeriodEnd: true,
          })
        ).toBe(expected);
      }
    );

    it('ignores the flag when it is false or absent', () => {
      const base = {
        tier: 'PRO',
        status: 'ACTIVE',
        provider: 'STRIPE',
      } as const;
      expect(displayStateOf({ ...base, cancelAtPeriodEnd: false })).toBe(
        'ACTIVE'
      );
      expect(displayStateOf(base)).toBe('ACTIVE');
    });

    it('ignores the flag for a FREE user with no failed payment', () => {
      expect(
        displayStateOf({
          tier: 'FREE',
          status: 'CANCELED',
          provider: 'STRIPE',
          cancelAtPeriodEnd: true,
        })
      ).toBe('FREE');
    });
  });
});

describe('allowedActionsOf (plan §6)', () => {
  it('ACTIVE Stripe: update card and cancel', () => {
    expect(allowedActionsOf(facts({}))).toEqual(['update_card', 'cancel']);
  });

  it('TRIALING Stripe: update card and cancel', () => {
    expect(allowedActionsOf(facts({ status: 'TRIALING' }))).toEqual([
      'update_card',
      'cancel',
    ]);
  });

  it('ACTIVE dLocal: renew now only (D8: a prepaid plan has no cancel and just ends)', () => {
    expect(allowedActionsOf(facts({ provider: 'DLOCAL' }))).toEqual([
      'renew_now',
    ]);
  });

  it('a dLocal row is never CANCEL_SCHEDULED, whatever the column holds', () => {
    const dLocal = facts({ provider: 'DLOCAL', cancelAtPeriodEnd: true });
    expect(displayStateOf(dLocal)).toBe('ACTIVE');
    expect(allowedActionsOf(dLocal)).toEqual(['renew_now']);
  });

  it('PRO with no provider on the row: nothing to cancel or update', () => {
    expect(allowedActionsOf(facts({ provider: null }))).toEqual([]);
  });

  it('PAST_DUE with an open invoice: pay now and update card, no cancel', () => {
    expect(
      allowedActionsOf(facts({ status: 'PAST_DUE', openInvoiceUrl: INVOICE }))
    ).toEqual(['pay_now', 'update_card']);
  });

  it('PAST_DUE without a known open invoice: update card only', () => {
    expect(allowedActionsOf(facts({ status: 'PAST_DUE' }))).toEqual([
      'update_card',
    ]);
  });

  it('UNPAID (tier FREE): pay now and update card', () => {
    expect(
      allowedActionsOf(
        facts({ tier: 'FREE', status: 'UNPAID', openInvoiceUrl: INVOICE })
      )
    ).toEqual(['pay_now', 'update_card']);
  });

  it('a FREE user downgraded while PAST_DUE before S1 can still pay', () => {
    expect(
      allowedActionsOf(
        facts({ tier: 'FREE', status: 'PAST_DUE', openInvoiceUrl: INVOICE })
      )
    ).toEqual(['pay_now', 'update_card']);
  });

  it('a failed payment on a non-Stripe row offers nothing', () => {
    expect(
      allowedActionsOf(
        facts({
          status: 'PAST_DUE',
          provider: 'DLOCAL',
          openInvoiceUrl: INVOICE,
        })
      )
    ).toEqual([]);
  });

  it.each([
    ['FREE', null],
    ['FREE', 'CANCELED'],
    ['FREE', 'INACTIVE'],
  ] as const)('FREE with status %s / %s: nothing', (tier, status) => {
    expect(allowedActionsOf(facts({ tier, status }))).toEqual([]);
  });

  describe('CANCEL_SCHEDULED: resume and update card, no second cancel (W4)', () => {
    const NOW = new Date('2026-11-01T12:00:00.000Z');
    const scheduled = (
      overrides: Partial<SubscriptionFacts>
    ): SubscriptionFacts =>
      facts({ cancelAtPeriodEnd: true, now: NOW, ...overrides });

    it('offers resume and update card before the period ends', () => {
      expect(
        allowedActionsOf(
          scheduled({ currentPeriodEnd: new Date('2026-11-05T00:00:00.000Z') })
        )
      ).toEqual(['resume', 'update_card']);
    });

    it('accepts the period end as an ISO string, as the database client returns it over JSON', () => {
      expect(
        allowedActionsOf(
          scheduled({ currentPeriodEnd: '2026-11-05T00:00:00.000Z' })
        )
      ).toEqual(['resume', 'update_card']);
    });

    it('offers resume while the trial is running too', () => {
      expect(
        allowedActionsOf(
          scheduled({
            status: 'TRIALING',
            currentPeriodEnd: new Date('2026-11-03T00:00:00.000Z'),
          })
        )
      ).toEqual(['resume', 'update_card']);
    });

    it('withdraws resume once the period end has passed, keeping update card', () => {
      expect(
        allowedActionsOf(
          scheduled({ currentPeriodEnd: new Date('2026-11-01T11:59:59.000Z') })
        )
      ).toEqual(['update_card']);
    });

    it('withdraws resume at the exact period end (the subscription ends then)', () => {
      expect(allowedActionsOf(scheduled({ currentPeriodEnd: NOW }))).toEqual([
        'update_card',
      ]);
    });

    it.each([null, undefined, 'not a date'])(
      'treats an unknown period end (%s) as not yet ended and lets Stripe judge',
      (currentPeriodEnd) => {
        expect(
          allowedActionsOf(
            scheduled({ currentPeriodEnd: currentPeriodEnd as never })
          )
        ).toEqual(['resume', 'update_card']);
      }
    );

    it('never offers cancel again', () => {
      expect(allowedActionsOf(scheduled({}))).not.toContain('cancel');
    });

    it('offers nothing in admin view-as', () => {
      expect(
        allowedActionsOf(
          scheduled({
            currentPeriodEnd: new Date('2026-11-05T00:00:00.000Z'),
            viewing: true,
          })
        )
      ).toEqual([]);
    });

    it('offers resume to nobody on a failed payment: pay first (plan §6)', () => {
      expect(
        allowedActionsOf(
          scheduled({ status: 'PAST_DUE', openInvoiceUrl: INVOICE })
        )
      ).toEqual(['pay_now', 'update_card']);
    });

    it('uses the real clock when none is passed', () => {
      const future = new Date(Date.now() + 86_400_000);
      const past = new Date(Date.now() - 86_400_000);
      const base = facts({ cancelAtPeriodEnd: true });
      expect(allowedActionsOf({ ...base, currentPeriodEnd: future })).toContain(
        'resume'
      );
      expect(
        allowedActionsOf({ ...base, currentPeriodEnd: past })
      ).not.toContain('resume');
    });
  });

  it.each([
    ['ACTIVE', 'PRO'],
    ['TRIALING', 'PRO'],
    ['PAST_DUE', 'PRO'],
    ['UNPAID', 'FREE'],
  ] as const)(
    'admin view-as hides every action (status %s)',
    (status, tier) => {
      expect(
        allowedActionsOf(
          facts({ tier, status, openInvoiceUrl: INVOICE, viewing: true })
        )
      ).toEqual([]);
    }
  );
});

describe('the monolith and money-service copies of the actions module', () => {
  const read = (file: string): string =>
    fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  it('are identical', () => {
    expect(read('money-service/src/stripe/subscription-actions.ts')).toBe(
      read('lib/stripe/subscription-actions.ts')
    );
  });
});
