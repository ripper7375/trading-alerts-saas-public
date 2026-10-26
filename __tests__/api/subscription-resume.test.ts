/**
 * POST /api/subscription/resume -- Manage Subscription S2, workflow W4 (undo a
 * scheduled cancellation, only while CANCEL_SCHEDULED and before the period
 * ends).
 *
 * @module __tests__/api/subscription-resume.test
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
const mockSubscriptionFindUnique = jest.fn();
const mockSubscriptionUpdate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
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

const mockSendResumed = jest.fn();
jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendSubscriptionResumedEmail: (...a: unknown[]) => mockSendResumed(...a),
}));

import { POST } from '@/app/api/subscription/resume/route';
import { MoneyServiceError } from '@/lib/money-service/write-routes';

const FUTURE = new Date(Date.now() + 5 * 86_400_000);
const FUTURE_SECONDS = Math.floor(FUTURE.getTime() / 1000);

function scheduledRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'row_1',
    status: 'ACTIVE',
    stripeSubscriptionId: 'sub_1',
    stripeCurrentPeriodEnd: FUTURE,
    dLocalPaymentId: null,
    cancelAtPeriodEnd: true,
    ...overrides,
  };
}

async function post(): Promise<{ status: number; body: Record<string, any> }> {
  const res = await POST({} as never);
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
  mockSubscriptionFindUnique.mockResolvedValue(scheduledRow());
  mockSubscriptionUpdate.mockResolvedValue({});
  mockSetCancelAtPeriodEnd.mockResolvedValue({
    current_period_end: FUTURE_SECONDS,
  });
  mockSendResumed.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/subscription/resume', () => {
  describe('the happy path', () => {
    it('tells Stripe to stop cancelling at the period end', async () => {
      const { status } = await post();

      expect(status).toBe(200);
      expect(mockSetCancelAtPeriodEnd).toHaveBeenCalledTimes(1);
      expect(mockSetCancelAtPeriodEnd).toHaveBeenCalledWith('sub_1', false);
    });

    it('clears the three cancellation columns and nothing else', async () => {
      await post();

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'row_1' },
        data: {
          cancelAtPeriodEnd: false,
          cancelRequestedAt: null,
          cancellationReason: null,
        },
      });
    });

    it('answers with the date the subscription renews', async () => {
      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body).toEqual({
        success: true,
        message: 'Your subscription will continue',
        tier: 'PRO',
        cancelAtPeriodEnd: false,
        renewsAt: new Date(FUTURE_SECONDS * 1000).toISOString(),
      });
    });

    it('sends the "will continue" e-mail with that date', async () => {
      await post();

      expect(mockSendResumed).toHaveBeenCalledWith(
        'user@example.com',
        'Una',
        'PRO',
        new Date(FUTURE_SECONDS * 1000)
      );
    });

    it('does not fail the resume when the e-mail fails', async () => {
      mockSendResumed.mockRejectedValue(new Error('resend down'));

      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body['success']).toBe(true);
    });

    it('resumes a trial that was set to end', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        scheduledRow({ status: 'TRIALING' })
      );

      const { status } = await post();

      expect(status).toBe(200);
    });

    it('reads the Subscription with an explicit select (F21)', async () => {
      await post();

      expect(mockSubscriptionFindUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: {
          id: true,
          status: true,
          stripeSubscriptionId: true,
          stripeCurrentPeriodEnd: true,
          dLocalPaymentId: true,
          cancelAtPeriodEnd: true,
        },
      });
    });

    it('resumes when the stored period end is unknown and lets Stripe judge', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        scheduledRow({ stripeCurrentPeriodEnd: null })
      );

      const { status } = await post();

      expect(status).toBe(200);
    });
  });

  describe('refusals (nothing is called or written)', () => {
    const expectUntouched = (): void => {
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockSendResumed).not.toHaveBeenCalled();
    };

    it('401 when not signed in', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { status, body } = await post();

      expect(status).toBe(401);
      expect(body['code']).toBe('UNAUTHORIZED');
      expectUntouched();
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
      expectUntouched();
    });

    it('NO_SUBSCRIPTION when there is no row', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('NO_SUBSCRIPTION');
    });

    it('NO_STRIPE_SUBSCRIPTION for a dLocal plan: nothing to resume (D8)', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        scheduledRow({ dLocalPaymentId: 'dl_1', stripeSubscriptionId: null })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('NO_STRIPE_SUBSCRIPTION');
      expectUntouched();
    });

    it('NOT_SCHEDULED when no cancellation is recorded', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        scheduledRow({ cancelAtPeriodEnd: false })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('NOT_SCHEDULED');
      expectUntouched();
    });

    it('PERIOD_ENDED once the period end has passed', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        scheduledRow({ stripeCurrentPeriodEnd: new Date(Date.now() - 1000) })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body['code']).toBe('PERIOD_ENDED');
      expectUntouched();
    });

    it.each(['PAST_DUE', 'UNPAID'])(
      'ACTION_NOT_ALLOWED while the payment is %s: pay first',
      async (state) => {
        mockSubscriptionFindUnique.mockResolvedValue(
          scheduledRow({ status: state })
        );

        const { status, body } = await post();

        expect(status).toBe(400);
        expect(body['code']).toBe('ACTION_NOT_ALLOWED');
        expectUntouched();
      }
    );
  });

  describe('failures', () => {
    it('writes nothing and sends nothing when Stripe refuses (for example the subscription just ended)', async () => {
      mockSetCancelAtPeriodEnd.mockRejectedValue(new Error('No such sub'));

      const { status, body } = await post();

      expect(status).toBe(500);
      expect(body['code']).toBe('RESUME_ERROR');
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockSendResumed).not.toHaveBeenCalled();
    });

    it('answers RESUME_ERROR when the database write fails after Stripe agreed', async () => {
      mockSubscriptionUpdate.mockRejectedValue(new Error('db down'));

      const { status, body } = await post();

      expect(status).toBe(500);
      expect(body['code']).toBe('RESUME_ERROR');
      expect(mockSendResumed).not.toHaveBeenCalled();
    });
  });

  describe('money-service', () => {
    it('forwards to the money-service endpoint when the flag is on, and touches no database', async () => {
      mockUseMoneyService.mockReturnValue(true);
      mockForward.mockResolvedValue({
        success: true,
        cancelAtPeriodEnd: false,
      });

      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body).toEqual({ success: true, cancelAtPeriodEnd: false });
      expect(mockForward).toHaveBeenCalledWith(
        expect.anything(),
        '/v1/stripe/subscriptions/resume'
      );
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockSetCancelAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('passes money-service refusals through with their status and body', async () => {
      mockUseMoneyService.mockReturnValue(true);
      mockForward.mockRejectedValue(
        new MoneyServiceError(400, { code: 'PERIOD_ENDED' })
      );

      const { status, body } = await post();

      expect(status).toBe(400);
      expect(body).toEqual({ code: 'PERIOD_ENDED' });
    });
  });
});
