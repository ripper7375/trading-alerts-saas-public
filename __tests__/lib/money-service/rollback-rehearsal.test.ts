/**
 * 0ms Rollback Rehearsal Test Suite (Manual Smoke Test 3.5 Verification)
 *
 * Verifies that when feature flags:
 * - MIGRATE_WRITE_APIS_MONEY_STRIPE
 * - MIGRATE_WRITE_APIS_MONEY_DLOCAL
 * - MIGRATE_WRITE_APIS_MONEY_ADMIN
 * - MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT
 * are set to false (or omitted), all 5 Next.js Monolith route handlers
 * bypass money-service completely and execute local monolith logic.
 *
 * @module __tests__/lib/money-service/rollback-rehearsal.test
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('next-auth/providers/twitter', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('next-auth/providers/linkedin', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendCancellationEmail: jest.fn(async () => ({ success: true })),
}));

const mockForwardWriteRequestToMoneyService = jest.fn();
jest.mock('@/lib/money-service/write-routes', () => ({
  __esModule: true,
  MoneyServiceError: class MockMoneyServiceError extends Error {},
  forwardWriteRequestToMoneyService: (...args: unknown[]) =>
    mockForwardWriteRequestToMoneyService(...args),
}));

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: () => mockGetServerSession(),
}));

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  affiliateCode: {
    findFirst: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

// Mock Stripe SDK functions
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  buildCheckoutIdempotencyKey: jest.fn(() => 'idemp-123'),
  createCheckoutSession: jest.fn(async () => ({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
  })),
  cancelSubscription: jest.fn(async () => ({})),
}));

// Mock dLocal services
jest.mock('@/lib/dlocal/dlocal-payment.service', () => ({
  __esModule: true,
  createPayment: jest.fn(async () => ({
    paymentId: 'dl_123',
    orderId: 'ord_123',
    paymentUrl: 'https://dlocal.com/pay/dl_123',
    status: 'PENDING',
  })),
  acquireCreatePaymentLock: jest.fn(async () => true),
}));

jest.mock('@/lib/dlocal/currency-converter.service', () => ({
  __esModule: true,
  convertUSDToLocal: jest.fn(async () => ({
    localAmount: 3500,
    exchangeRate: 35.0,
  })),
}));

jest.mock('@/lib/dlocal/payment-methods.service', () => ({
  __esModule: true,
  isValidPaymentMethod: jest.fn(() => true),
}));

// Mock Admin code distribution
jest.mock('@/lib/admin/code-distribution', () => ({
  __esModule: true,
  distributeCodesAdmin: jest.fn(async () => ({ success: true, count: 1 })),
}));

// Mock Disbursement services
const mockGetBatchById = jest.fn();
jest.mock('@/lib/disbursement/services/batch-manager', () => ({
  __esModule: true,
  BatchManager: jest.fn().mockImplementation(() => ({
    getBatchById: (...args: unknown[]) => mockGetBatchById(...args),
  })),
}));

jest.mock('@/lib/disbursement/services/payment-orchestrator', () => ({
  __esModule: true,
  PaymentOrchestrator: jest.fn().mockImplementation(() => ({
    executeBatch: jest.fn(async () => ({
      success: true,
      batchId: 'batch-1',
      batchNumber: 'BATCH-001',
      totalAmount: 100,
      successCount: 1,
      failedCount: 0,
      errors: [],
    })),
  })),
}));

jest.mock('@/lib/disbursement/providers/provider-factory', () => ({
  __esModule: true,
  isProviderAvailable: jest.fn(() => true),
  createPaymentProvider: jest.fn(() => ({})),
}));

describe('0ms Rollback Rehearsal Procedure (Procedure 3.5)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Revert all write flags to false for rollback rehearsal
    process.env['MIGRATE_WRITE_APIS_MONEY_STRIPE'] = 'false';
    process.env['MIGRATE_WRITE_APIS_MONEY_DLOCAL'] = 'false';
    process.env['MIGRATE_WRITE_APIS_MONEY_ADMIN'] = 'false';
    process.env['MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT'] = 'false';
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  describe('Route 1: Stripe Checkout (POST /api/checkout)', () => {
    it('bypasses money-service and executes monolith logic when flag is false', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'usr_1', email: 'user@example.com', tier: 'FREE' },
      });

      const { POST } = await import('@/app/api/checkout/route');
      const req = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(mockForwardWriteRequestToMoneyService).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sessionId', 'cs_test_123');
    });
  });

  describe('Route 2: Stripe Subscription Cancel (POST /api/subscription/cancel)', () => {
    it('bypasses money-service and executes monolith logic when flag is false', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'usr_1', email: 'user@example.com', tier: 'PRO' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'usr_1',
        email: 'user@example.com',
        tier: 'PRO',
      });
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub_1',
        userId: 'usr_1',
        stripeSubscriptionId: 'sub_stripe_1',
        status: 'ACTIVE',
      });

      const { POST } = await import('@/app/api/subscription/cancel/route');
      const req = new NextRequest(
        'http://localhost:3000/api/subscription/cancel',
        { method: 'POST' }
      );

      const response = await POST(req);
      const data = await response.json();

      expect(mockForwardWriteRequestToMoneyService).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Subscription cancelled successfully',
        tier: 'FREE',
      });
    });
  });

  describe('Route 3: dLocal Payment Creation (POST /api/payments/dlocal/create)', () => {
    it('bypasses money-service and executes monolith logic when flag is false', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'usr_1', email: 'user@example.com' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'usr_1',
        tier: 'FREE',
      });
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay_1' });
      mockPrisma.payment.update.mockResolvedValue({ id: 'pay_1' });

      const { POST } = await import('@/app/api/payments/dlocal/create/route');
      const req = new NextRequest(
        'http://localhost:3000/api/payments/dlocal/create',
        {
          method: 'POST',
          body: JSON.stringify({
            country: 'TH',
            paymentMethod: 'P2P',
            planType: 'MONTHLY',
            currency: 'THB',
          }),
        }
      );

      const response = await POST(req);
      const data = await response.json();

      expect(mockForwardWriteRequestToMoneyService).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('paymentId', 'dl_123');
    });
  });

  describe('Route 4: Admin Code Distribution (POST /api/admin/affiliates/[id]/distribute-codes)', () => {
    it('bypasses money-service and executes monolith logic when flag is false', async () => {
      mockRequireAdmin.mockResolvedValue({
        user: { id: 'admin_1', role: 'ADMIN' },
      });

      const { POST } =
        await import('@/app/api/admin/affiliates/[id]/distribute-codes/route');
      const req = new NextRequest(
        'http://localhost:3000/api/admin/affiliates/aff_123/distribute-codes',
        {
          method: 'POST',
          body: JSON.stringify({ count: 1, reason: 'Rollback test' }),
        }
      );

      const response = await POST(req, {
        params: Promise.resolve({ id: 'aff_123' }),
      });
      const data = await response.json();

      expect(mockForwardWriteRequestToMoneyService).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, count: 1 });
    });
  });

  describe('Route 5: Disbursement Batch Execution (POST /api/disbursement/batches/[batchId]/execute)', () => {
    it('bypasses money-service and executes monolith logic when flag is false', async () => {
      mockRequireAdmin.mockResolvedValue({
        user: { id: 'admin_1', role: 'ADMIN' },
      });
      mockGetBatchById.mockResolvedValue({
        id: 'batch_123',
        batchNumber: 'BATCH-001',
        status: 'PENDING',
        provider: 'WISE',
      });

      const { POST } =
        await import('@/app/api/disbursement/batches/[batchId]/execute/route');
      const req = new NextRequest(
        'http://localhost:3000/api/disbursement/batches/batch_123/execute',
        { method: 'POST' }
      );

      const response = await POST(req, {
        params: Promise.resolve({ batchId: 'batch_123' }),
      });
      const data = await response.json();

      expect(mockForwardWriteRequestToMoneyService).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
    });
  });
});
