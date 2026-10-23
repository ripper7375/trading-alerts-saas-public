/**
 * @jest-environment node
 *
 * T2-d: the API routes that used to put a raw `error.message` in the response
 * now log the full error on the server and answer with a fixed text:
 *
 *   POST /api/payments/dlocal/create
 *   POST /api/disbursement/pay
 *   POST /api/disbursement/batches/[batchId]/execute
 *
 * (The Stripe webhook and the active-indicator route are held in their own
 * test files, which already carry those suites.) Every case throws an error
 * whose text holds something that must not reach a caller (a connection
 * string, a key, a table name) and looks for it in the response.
 */

import { NextRequest } from 'next/server';

import { DisbursementConfigError } from '@/lib/disbursement/constants';

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

const mockAffiliateFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateProfile: {
      findUnique: (...a: unknown[]) => mockAffiliateFindUnique(...a),
    },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  shouldUseMoneyServiceForDisbursementWrite: () => false,
  shouldUseMoneyServiceForDlocalWrite: () => false,
}));
jest.mock('@/lib/money-service/write-routes', () => ({
  __esModule: true,
  forwardWriteRequestToMoneyService: jest.fn(),
  MoneyServiceError: class MoneyServiceError extends Error {},
}));

jest.mock('@/lib/disbursement/settings', () => ({
  __esModule: true,
  DISBURSEMENTS_PAUSED_BODY: { code: 'DISBURSEMENTS_PAUSED' },
  getDisbursementSettings: async () => ({
    effectiveEnabled: true,
    minimumPayoutUsd: 50,
  }),
}));
const mockGetBatch = jest.fn();
jest.mock('@/lib/disbursement/services/batch-manager', () => ({
  __esModule: true,
  BatchManager: class {
    getBatchById = (...a: unknown[]) => mockGetBatch(...a);
  },
}));
const mockExecuteBatch = jest.fn();
jest.mock('@/lib/disbursement/services/payment-orchestrator', () => ({
  __esModule: true,
  PaymentOrchestrator: class {
    executeBatch = (...a: unknown[]) => mockExecuteBatch(...a);
  },
}));
jest.mock('@/lib/disbursement/services/commission-aggregator', () => ({
  __esModule: true,
  CommissionAggregator: class {},
}));
const mockCreateProvider = jest.fn();
jest.mock('@/lib/disbursement/providers/provider-factory', () => ({
  __esModule: true,
  createPaymentProvider: (...a: unknown[]) => mockCreateProvider(...a),
  isProviderAvailable: () => true,
}));

jest.mock('@/lib/affiliate/db', () => ({
  __esModule: true,
  getAnnualPriceUsd: jest.fn(),
  getBasePriceUsd: jest.fn(),
  getThreeDayPriceUsd: jest.fn(),
}));
jest.mock('@/lib/dlocal/dlocal-payment.service', () => ({
  __esModule: true,
  createPayment: jest.fn(),
  acquireCreatePaymentLock: jest.fn(),
}));
jest.mock('@/lib/dlocal/currency-converter.service', () => ({
  __esModule: true,
  convertUSDToLocal: jest.fn(),
}));
jest.mock('@/lib/dlocal/payment-methods.service', () => ({
  __esModule: true,
  isValidPaymentMethod: () => true,
}));
const mockLoggerError = jest.fn();
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: (...a: unknown[]) => mockLoggerError(...a),
  },
}));

import { POST as dlocalCreate } from '@/app/api/payments/dlocal/create/route';
import { POST as quickPay } from '@/app/api/disbursement/pay/route';
import { POST as executeBatch } from '@/app/api/disbursement/batches/[batchId]/execute/route';

const post = (url: string, body?: unknown): NextRequest =>
  new NextRequest(url, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ADMIN = { user: { id: 'admin-1', role: 'ADMIN', email: 'a@x.test' } };
const batchContext = {
  params: Promise.resolve({ batchId: 'batch-1' }),
};
const callExecute = (): Promise<Response> =>
  executeBatch(
    post('https://davintrade.app/api/disbursement/batches/batch-1/execute'),
    batchContext
  );

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockRequireAdmin.mockResolvedValue(ADMIN);
  mockGetServerSession.mockResolvedValue(ADMIN);
});
afterEach(() => errorSpy.mockRestore());

describe('POST /api/payments/dlocal/create', () => {
  const body = {
    country: 'IN',
    paymentMethod: 'UPI',
    planType: 'MONTHLY',
    currency: 'INR',
  };

  it('answers a failure with a fixed text, and logs the real one', async () => {
    mockUserFindUnique.mockRejectedValue(
      new Error('connect ECONNREFUSED postgres://app:s3cret@10.0.0.5:5432/db')
    );

    const res = await dlocalCreate(
      post('https://davintrade.app/api/payments/dlocal/create', body)
    );

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Failed to create payment' });
    expect(text).not.toContain('s3cret');
    expect(text).not.toContain('ECONNREFUSED');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to create payment',
      expect.objectContaining({
        error: expect.stringContaining('ECONNREFUSED'),
      })
    );
  });

  it('a thrown value that is not an Error gets the same fixed text', async () => {
    mockUserFindUnique.mockRejectedValue('plain string with secret');

    const res = await dlocalCreate(
      post('https://davintrade.app/api/payments/dlocal/create', body)
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to create payment' });
  });
});

describe('POST /api/disbursement/pay', () => {
  const call = (): Promise<Response> =>
    quickPay(
      post('https://davintrade.app/api/disbursement/pay', {
        affiliateId: 'aff-1',
      })
    );

  it('answers a failure with a fixed text, and logs the real one', async () => {
    mockAffiliateFindUnique.mockRejectedValue(
      new Error('Invalid `prisma.affiliateProfile.findUnique()` invocation')
    );

    const res = await call();

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Failed to process payment' });
    expect(text).not.toContain('prisma');
    expect(errorSpy).toHaveBeenCalledWith(
      'Quick payment error:',
      expect.objectContaining({
        message: expect.stringContaining('affiliateProfile'),
      })
    );
  });

  it('a payout provider that is not configured: a fixed 503 that names nothing', async () => {
    mockAffiliateFindUnique.mockRejectedValue(
      new DisbursementConfigError(
        'DISBURSEMENT_PROVIDER must be set to a real provider outside development and test'
      )
    );

    const res = await call();

    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: 'Disbursement is not configured',
    });
    expect(text).not.toContain('DISBURSEMENT_PROVIDER');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('the "not yet implemented" provider case keeps its fixed 400 text', async () => {
    mockAffiliateFindUnique.mockRejectedValue(
      new Error('RISE provider not yet implemented')
    );

    const res = await call();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'RISE provider not available. Use MOCK provider.',
    });
  });
});

describe('POST /api/disbursement/batches/[batchId]/execute', () => {
  beforeEach(() => {
    mockGetBatch.mockResolvedValue({
      id: 'batch-1',
      status: 'PENDING',
      provider: 'MOCK',
    });
  });

  it('a provider that cannot start: a fixed text and no `details`', async () => {
    mockCreateProvider.mockImplementation(() => {
      throw new Error('RISE_API_KEY sk_live_abc123 is not valid');
    });

    const res = await callExecute();

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: 'Failed to initialize payment provider',
    });
    expect(text).not.toContain('sk_live_abc123');
    expect(errorSpy).toHaveBeenCalledWith(
      'Error initializing payment provider:',
      expect.objectContaining({
        message: expect.stringContaining('sk_live_abc123'),
      })
    );
  });

  it('a payout provider that is not configured: a fixed 503, no details, nothing executed', async () => {
    mockCreateProvider.mockImplementation(() => {
      throw new DisbursementConfigError(
        'DISBURSEMENT_PROVIDER must be set to a real provider outside development and test'
      );
    });

    const res = await callExecute();

    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: 'Disbursement is not configured',
    });
    expect(text).not.toContain('DISBURSEMENT_PROVIDER');
    expect(mockExecuteBatch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(DisbursementConfigError)
    );
  });

  it('any other failure while executing: 500 with a fixed text', async () => {
    mockExecuteBatch.mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`batchNumber`)')
    );

    const res = await callExecute();

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Failed to execute batch' });
    expect(text).not.toContain('batchNumber');
    expect(errorSpy).toHaveBeenCalledWith(
      'Error executing batch:',
      expect.any(Error)
    );
  });

  it('a "not found" failure keeps its 404 but not its wording', async () => {
    mockExecuteBatch.mockRejectedValue(
      new Error(
        'An operation failed because it depends on records that were required but not found (table "PaymentBatch")'
      )
    );

    const res = await callExecute();

    expect(res.status).toBe(404);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Batch not found' });
    expect(text).not.toContain('PaymentBatch');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('a "Cannot execute" failure keeps its 400 but not its wording', async () => {
    mockExecuteBatch.mockRejectedValue(
      new Error('Cannot execute batch: lock held by worker pid 4121')
    );

    const res = await callExecute();

    expect(res.status).toBe(400);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Cannot execute batch' });
    expect(text).not.toContain('4121');
  });

  it('the plain domain refusal for a finished batch is unchanged', async () => {
    mockGetBatch.mockResolvedValue({
      id: 'batch-1',
      status: 'COMPLETED',
      provider: 'MOCK',
    });

    const res = await callExecute();

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'Cannot execute batch with status COMPLETED',
    });
  });
});
