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

  it('ACTIVE dLocal: cancel only (today’s button; S2 removes it, D8)', () => {
    expect(allowedActionsOf(facts({ provider: 'DLOCAL' }))).toEqual(['cancel']);
  });

  it('PRO with no provider on the row: cancel only', () => {
    expect(allowedActionsOf(facts({ provider: null }))).toEqual(['cancel']);
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
