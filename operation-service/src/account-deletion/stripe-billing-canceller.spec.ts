import Stripe from 'stripe';

import type { PrismaService } from '../prisma/prisma.service';
import { StripeBillingCanceller } from './stripe-billing-canceller';

const NO_SUCH_SUBSCRIPTION = new Stripe.errors.StripeInvalidRequestError({
  type: 'invalid_request_error',
  code: 'resource_missing',
  message: 'No such subscription: sub_1',
} as never);

describe('StripeBillingCanceller', () => {
  const originalKey = process.env['STRIPE_RESTRICTED_KEY'];
  const findUnique = jest.fn();
  const retrieve = jest.fn();
  const cancel = jest.fn();
  let createdWith: string[];
  let canceller: StripeBillingCanceller;

  class TestableCanceller extends StripeBillingCanceller {
    protected override createClient(key: string): Stripe {
      createdWith.push(key);
      return { subscriptions: { retrieve, cancel } } as unknown as Stripe;
    }
  }

  const liveRow = { stripeSubscriptionId: 'sub_1', status: 'ACTIVE' };

  beforeEach(() => {
    process.env['STRIPE_RESTRICTED_KEY'] = 'rk_test_not_a_real_key';
    findUnique.mockReset();
    retrieve.mockReset();
    cancel.mockReset();
    createdWith = [];
    canceller = new TestableCanceller({
      subscription: { findUnique },
    } as unknown as PrismaService);
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env['STRIPE_RESTRICTED_KEY'];
    else process.env['STRIPE_RESTRICTED_KEY'] = originalKey;
  });

  it('reads the Subscription row of that user only', async () => {
    findUnique.mockResolvedValue(null);

    await canceller.cancelForUser('u1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { stripeSubscriptionId: true, status: true },
    });
  });

  describe('nothing to stop', () => {
    it('a user with no subscription row (a free user) completes without Stripe or a key', async () => {
      findUnique.mockResolvedValue(null);
      delete process.env['STRIPE_RESTRICTED_KEY'];

      await expect(canceller.cancelForUser('u1')).resolves.toEqual({
        stripeSubscriptionsCanceled: 0,
      });
      expect(createdWith).toEqual([]);
    });

    it('a dLocal-only subscription (no Stripe id) completes without Stripe or a key', async () => {
      findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        status: 'ACTIVE',
      });
      delete process.env['STRIPE_RESTRICTED_KEY'];

      await expect(canceller.cancelForUser('u1')).resolves.toEqual({
        stripeSubscriptionsCanceled: 0,
      });
      expect(createdWith).toEqual([]);
    });

    it('a row already CANCELED (the webhook ran) does not call Stripe', async () => {
      findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        status: 'CANCELED',
      });

      await expect(canceller.cancelForUser('u1')).resolves.toEqual({
        stripeSubscriptionsCanceled: 0,
      });
      expect(retrieve).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
    });

    it('Stripe says it is already canceled (the webhook lagged, or a retry after a lost reply)', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockResolvedValue({ id: 'sub_1', status: 'canceled' });

      await expect(canceller.cancelForUser('u1')).resolves.toEqual({
        stripeSubscriptionsCanceled: 0,
      });
      expect(cancel).not.toHaveBeenCalled();
    });

    it('Stripe has no such subscription (resource_missing on retrieve)', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockRejectedValue(NO_SUCH_SUBSCRIPTION);

      await expect(canceller.cancelForUser('u1')).resolves.toEqual({
        stripeSubscriptionsCanceled: 0,
      });
    });

    it('the subscription vanishes between retrieve and cancel (resource_missing on cancel)', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
      cancel.mockRejectedValue(NO_SUCH_SUBSCRIPTION);

      await expect(canceller.cancelForUser('u1')).resolves.toEqual({
        stripeSubscriptionsCanceled: 0,
      });
    });
  });

  describe('a live subscription', () => {
    it.each(['active', 'trialing', 'past_due', 'unpaid', 'incomplete'])(
      'cancels a %s subscription immediately, with no options that refund or prorate',
      async (status) => {
        findUnique.mockResolvedValue(liveRow);
        retrieve.mockResolvedValue({ id: 'sub_1', status });
        cancel.mockResolvedValue({ id: 'sub_1', status: 'canceled' });

        await expect(canceller.cancelForUser('u1')).resolves.toEqual({
          stripeSubscriptionsCanceled: 1,
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith('sub_1');
      }
    );

    it('builds the client once, from STRIPE_RESTRICTED_KEY', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
      cancel.mockResolvedValue({});

      await canceller.cancelForUser('u1');
      await canceller.cancelForUser('u2');

      expect(createdWith).toEqual(['rk_test_not_a_real_key']);
    });
  });

  describe('when it cannot be sure billing stopped it throws (the worker then retries)', () => {
    it('without STRIPE_RESTRICTED_KEY, for a user who has a Stripe subscription', async () => {
      findUnique.mockResolvedValue(liveRow);
      delete process.env['STRIPE_RESTRICTED_KEY'];

      await expect(canceller.cancelForUser('u1')).rejects.toThrow(
        /STRIPE_RESTRICTED_KEY/
      );
    });

    it('on any other Stripe error from retrieve', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockRejectedValue(new Error('stripe is down'));

      await expect(canceller.cancelForUser('u1')).rejects.toThrow(
        'stripe is down'
      );
      expect(cancel).not.toHaveBeenCalled();
    });

    it('on any other Stripe error from cancel', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
      cancel.mockRejectedValue(new Error('rate limited'));

      await expect(canceller.cancelForUser('u1')).rejects.toThrow(
        'rate limited'
      );
    });

    it('on a permission error (a restricted key without Subscriptions: Write)', async () => {
      findUnique.mockResolvedValue(liveRow);
      retrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
      cancel.mockRejectedValue(
        new Stripe.errors.StripePermissionError({
          type: 'invalid_request_error',
          message: 'The provided key does not have the required permissions',
        } as never)
      );

      await expect(canceller.cancelForUser('u1')).rejects.toThrow(
        /permissions/
      );
    });
  });
});
