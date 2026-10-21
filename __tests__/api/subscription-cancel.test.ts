/**
 * POST /api/subscription/cancel -- Manage Subscription S2, workflow W3 (cancel
 * at the END of the paid period, decision D1; a dLocal plan has no cancel,
 * decision D8). Defects B5, B6 and B7 of plan v2.1.
 *
 * @module __tests__/api/subscription-cancel.test
 */

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockSubscriptionUpdate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
      update: (...a: unknown[]) => mockSubscriptionUpdate(...a),
    },
  },
}));

const mockUseMoneyService = jest.fn();
jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  shouldUseMoneyServiceForStripeWrite: () => mockUseMoneyService(),
}));

const mockForward = jest.fn();
jest.mock('@/lib/money-service/write-routes', () => ({
  __esModule: true,
  forwardWriteRequestToMoneyService: (...a: unknown[]) => mockForward(...a),
  MoneyServiceError: class MoneyServiceError extends Error {
    constructor(
      public status: number,
      public body: unknown
    ) {
      super('money-service error');
    }
  },
}));

const mockSetCancelAtPeriodEnd = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  setCancelAtPeriodEnd: (...a: unknown[]) => mockSetCancelAtPeriodEnd(...a),
}));

const mockSendCanceled = jest.fn();
jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendSubscriptionCanceledEmail: (...a: unknown[]) => mockSendCanceled(...a),
}));

import { POST } from '@/app/api/subscription/cancel/route';
import { MoneyServiceError } from '@/lib/money-service/write-routes';

const PERIOD_END_SECONDS = Math.floor(
  new Date('2026-11-21T00:00:00.000Z').getTime() / 1000
);

function stripeRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'row_1',
    status: 'ACTIVE',
    stripeSubscriptionId: 'sub_1',
    stripeCurrentPeriodEnd: new Date('2026-11-21T00:00:00.000Z'),
    dLocalPaymentId: null,
    expiresAt: new Date('2026-11-21T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

async function post(
  ...args: [body?: unknown]
): Promise<{ status: number; body: Record<string, any> }> {
  // No argument: a normal request with a reason. An explicit `undefined`: a
  // request with no body at all.
  const body = args.length === 0 ? { reason: 'too_expensive' } : args[0];
  const request = {
    json: async () => {
      if (body === 'INVALID_JSON') throw new SyntaxError('bad json');
      return body;
    },
  };
  const res = await POST(request as never);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
  mockUseMoneyService.mockReturnValue(false);
  mockUserFindUnique.mockResolvedValue({
    tier: 'PRO',
    email: 'user@example.com',
    name: 'Una',
  });
  mockSubscriptionFindUnique.mockResolvedValue(stripeRow());
  mockSubscriptionUpdate.mockResolvedValue({});
  mockSetCancelAtPeriodEnd.mockResolvedValue({
    cancel_at: PERIOD_END_SECONDS,
    current_period_end: PERIOD_END_SECONDS,
  });
  mockSendCanceled.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/subscription/cancel', () => {
  describe('the happy path (Stripe, cancel at period end)', () => {
    it('asks Stripe to cancel at the period end, not now', async () => {
      const { status } = await post();

      expect(status).toBe(200);
      expect(mockSetCancelAtPeriodEnd).toHaveBeenCalledTimes(1);
      expect(mockSetCancelAtPeriodEnd).toHaveBeenCalledWith('sub_1', true);
    });

    it('records the request and keeps the user on PRO (B5)', async () => {
      await post({ reason: 'too_expensive' });

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'row_1' },
        data: {
          cancelAtPeriodEnd: true,
          cancelRequestedAt: expect.any(Date),
          cancellationReason: 'too_expensive',
        },
      });
      // Neither the tier nor the status changes: the webhook does that when
      // Stripe ends the subscription at the period end.
      expect(mockUserUpdate).not.toHaveBeenCalled();
      const data = mockSubscriptionUpdate.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('status');
    });

    it('answers with the date PRO ends', async () => {
      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body).toEqual({
        success: true,
        message:
          'Your subscription will end at the close of the current period',
        tier: 'PRO',
        cancelAtPeriodEnd: true,
        cancelAt: '2026-11-21T00:00:00.000Z',
      });
    });

    it('uses current_period_end when Stripe sends no cancel_at', async () => {
      mockSetCancelAtPeriodEnd.mockResolvedValue({
        cancel_at: null,
        current_period_end: PERIOD_END_SECONDS,
      });

      const { body } = await post();

      expect(body['cancelAt']).toBe('2026-11-21T00:00:00.000Z');
    });

    it('sends the "canceled, access until" e-mail with that date', async () => {
      await post();

      expect(mockSendCanceled).toHaveBeenCalledTimes(1);
      expect(mockSendCanceled).toHaveBeenCalledWith(
        'user@example.com',
        'Una',
        'PRO',
        new Date('2026-11-21T00:00:00.000Z')
      );
    });

    it('does not fail the cancellation when the e-mail fails', async () => {
      mockSendCanceled.mockRejectedValue(new Error('resend down'));

      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body['success']).toBe(true);
    });

    it('cancels a trial the same way: it ends at the trial end, no charge', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        stripeRow({ status: 'TRIALING' })
      );

      const { status } = await post();

      expect(status).toBe(200);
      expect(mockSetCancelAtPeriodEnd).toHaveBeenCalledWith('sub_1', true);
    });
  });

  describe('reads the Subscription with an explicit select (F21)', () => {
    it('names the columns it needs and nothing else', async () => {
      await post();

      expect(mockSubscriptionFindUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: {
          id: true,
          status: true,
          stripeSubscriptionId: true,
          stripeCurrentPeriodEnd: true,
          dLocalPaymentId: true,
          expiresAt: true,
          cancelAtPeriodEnd: true,
        },
      });
    });
  });

  describe('the reason (B6)', () => {
    it.each([
      ['a code', { reason: 'not_using' }, 'not_using'],
      [
        'free text',
        { reason: 'other: found a cheaper tool' },
        'other: found a cheaper tool',
      ],
      ['padded text, trimmed', { reason: '  switching  ' }, 'switching'],
      ['control characters become spaces', { reason: 'a\u0000b\nc' }, 'a b c'],
      ['an empty string is no reason', { reason: '   ' }, null],
      ['no reason at all', {}, null],
      ['a null reason', { reason: null }, null],
      ['no body', undefined, null],
      ['a body that is not JSON', 'INVALID_JSON', null],
      ['a body that is not an object', 'just text', null],
    ])('%s', async (_name, body, expected) => {
      const { status } = await post(body);

      expect(status).toBe(200);
      expect(mockSubscriptionUpdate.mock.calls[0][0].data).toMatchObject({
        cancellationReason: expected,
      });
    });

    it('stores a reason of exactly 500 characters', async () => {
      const reason = 'x'.repeat(500);

      const { status } = await post({ reason });

      expect(status).toBe(200);
      expect(
        mockSubscriptionUpdate.mock.calls[0][0].data.cancellationReason
      ).toBe(reason);
    });

    it.each([
      ['501 characters', { reason: 'x'.repeat(501) }],
      ['a number', { reason: 5 }],
      ['an object', { reason: { code: 'x' } }],
      ['a list', { reason: ['a'] }],
    ])('refuses %s before anything is done', async (_name, body) => {
      const { status, body: answer } = await post(body);

      expect(status).toBe(400);
      expect(answer['code']).toBe('INVALID_REASON');
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockSendCanceled).not.toHaveBeenCalled();
    });
  });

  describe('a dLocal plan has no cancel (D8, B7)', () => {
    it('answers DLOCAL_NO_CANCEL with the expiry and touches nothing', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        stripeRow({
          dLocalPaymentId: 'dl_1',
          stripeSubscriptionId: null,
          expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body).toEqual({
        error: 'Nothing to cancel',
        message:
          'Your plan is prepaid and ends on its expiry date. It does not renew automatically.',
        code: 'DLOCAL_NO_CANCEL',
        expiresAt: '2026-12-01T00:00:00.000Z',
      });
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSendCanceled).not.toHaveBeenCalled();
    });

    it('treats a row with both ids as dLocal, the precedence the page has always had', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        stripeRow({ dLocalPaymentId: 'dl_1' })
      );

      const { body } = await post();

      expect(body['code']).toBe('DLOCAL_NO_CANCEL');
    });

    it('sends a null expiry when the row has none', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        stripeRow({
          dLocalPaymentId: 'dl_1',
          stripeSubscriptionId: null,
          expiresAt: null,
        })
      );

      const { body } = await post();

      expect(body['expiresAt']).toBeNull();
    });
  });

  describe('refusals', () => {
    it('401 when not signed in', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { status, body } = await post();

      expect(status).toBe(401);
      expect(body['code']).toBe('UNAUTHORIZED');
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('404 when the user does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const { status, body } = await post();

      expect(status).toBe(404);
      expect(body['code']).toBe('USER_NOT_FOUND');
    });

    it('NO_SUBSCRIPTION for a FREE user', async () => {
      mockUserFindUnique.mockResolvedValue({
        tier: 'FREE',
        email: 'user@example.com',
        name: 'Una',
      });

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('NO_SUBSCRIPTION');
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('NO_SUBSCRIPTION when there is no row', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('NO_SUBSCRIPTION');
    });

    it('NO_STRIPE_SUBSCRIPTION for a row with neither provider', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        stripeRow({ stripeSubscriptionId: null })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('NO_STRIPE_SUBSCRIPTION');
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('ALREADY_SCHEDULED when the cancellation is already recorded', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        stripeRow({ cancelAtPeriodEnd: true })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('ALREADY_SCHEDULED');
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it.each(['PAST_DUE', 'UNPAID'])(
      'ACTION_NOT_ALLOWED while the payment is %s: pay first (plan §6)',
      async (state) => {
        mockSubscriptionFindUnique.mockResolvedValue(
          stripeRow({ status: state })
        );

        const { status, body } = await post();

        expect(status).toBe(400);
        expect(body['code']).toBe('ACTION_NOT_ALLOWED');
        expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
        expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      }
    );
  });

  describe('failures', () => {
    it('records nothing and sends nothing when Stripe refuses', async () => {
      mockSetCancelAtPeriodEnd.mockRejectedValue(new Error('stripe down'));

      const { status, body } = await post();

      expect(status).toBe(500);
      expect(body['code']).toBe('CANCEL_ERROR');
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSendCanceled).not.toHaveBeenCalled();
    });

    it('answers CANCEL_ERROR when the database write fails after Stripe agreed', async () => {
      mockSubscriptionUpdate.mockRejectedValue(new Error('db down'));

      const { status, body } = await post();

      expect(status).toBe(500);
      expect(body['code']).toBe('CANCEL_ERROR');
      // A retry is allowed: the flag is false in the row, and Stripe's call is
      // idempotent.
      expect(mockSendCanceled).not.toHaveBeenCalled();
    });
  });

  describe('money-service', () => {
    it('forwards to the money-service endpoint when the flag is on, and touches no database', async () => {
      mockUseMoneyService.mockReturnValue(true);
      mockForward.mockResolvedValue({ success: true, cancelAtPeriodEnd: true });

      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body).toEqual({ success: true, cancelAtPeriodEnd: true });
      expect(mockForward).toHaveBeenCalledWith(
        expect.anything(),
        '/v1/stripe/subscriptions/cancel'
      );
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('passes money-service refusals through with their status and body', async () => {
      mockUseMoneyService.mockReturnValue(true);
      mockForward.mockRejectedValue(
        new MoneyServiceError(400, { code: 'DLOCAL_NO_CANCEL' })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body).toEqual({ code: 'DLOCAL_NO_CANCEL' });
    });
  });
});
