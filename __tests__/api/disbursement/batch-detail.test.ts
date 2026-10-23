/**
 * GET /api/disbursement/batches/[batchId]: the payout-details flags
 * (WS-9, CODE-06A).
 *
 * The batch page shows, for each transaction, whether the affiliate's Wise
 * recipient was added or changed since that affiliate was last paid, and until
 * when payouts to it are held. Both come from
 * `AffiliateWiseRecipient.detailsChangedAt`.
 */
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/disbursement/batches/[batchId]/route';

jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    affiliateWiseRecipient: { findMany: jest.fn() },
    disbursementTransaction: { findMany: jest.fn() },
  },
}));

const mockGetBatchById = jest.fn();
const mockGetCounts = jest.fn();
jest.mock('@/lib/disbursement/services/batch-manager', () => ({
  BatchManager: jest
    .fn()
    .mockImplementation(() => ({ getBatchById: mockGetBatchById })),
}));
jest.mock('@/lib/disbursement/services/transaction-service', () => ({
  TransactionService: jest.fn().mockImplementation(() => ({
    getTransactionCountsByStatus: mockGetCounts,
  })),
}));

const NOW = new Date('2026-10-26T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function transaction(id: string, affiliateProfileId: string) {
  return {
    id,
    transactionId: `T-${id}`,
    providerTxId: null,
    commissionId: `comm-${id}`,
    commission: { affiliateProfileId },
    affiliateRiseAccount: null,
    amount: 60,
    amountRiseUnits: null,
    currency: 'USD',
    status: 'PENDING',
    retryCount: 0,
    lastRetryAt: null,
    errorMessage: null,
    createdAt: new Date('2026-10-26T09:00:00.000Z'),
    completedAt: null,
    failedAt: null,
  };
}

function batchOf(transactions: ReturnType<typeof transaction>[]) {
  return {
    id: 'batch-1',
    batchNumber: 'BATCH-1',
    provider: 'WISE',
    status: 'PENDING',
    paymentCount: transactions.length,
    totalAmount: 60 * transactions.length,
    currency: 'USD',
    scheduledAt: null,
    executedAt: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
    metadata: null,
    createdAt: new Date('2026-10-26T09:00:00.000Z'),
    updatedAt: new Date('2026-10-26T09:00:00.000Z'),
    transactions,
    auditLogs: [],
  };
}

async function call() {
  const response = await GET(
    new NextRequest('http://localhost:3000/api/disbursement/batches/batch-1'),
    { params: Promise.resolve({ batchId: 'batch-1' }) }
  );
  return { response, body: await response.json() };
}

describe('GET /api/disbursement/batches/[batchId]: payout-details flags', () => {
  let prisma: {
    affiliateWiseRecipient: { findMany: jest.Mock };
    disbursementTransaction: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    // Only the clock is faked: the route and Next's Response use real timers.
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'hrtime',
        'performance',
      ],
    });
    jest.clearAllMocks();
    const { requireAdmin } = await import('@/lib/auth/session');
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    prisma = (await import('@/lib/db/prisma'))
      .prisma as unknown as typeof prisma;
    mockGetCounts.mockResolvedValue({});
    prisma.affiliateWiseRecipient.findMany.mockResolvedValue([]);
    prisma.disbursementTransaction.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flags nothing, and asks nothing about earlier payouts, when no recipient has a recorded change', async () => {
    mockGetBatchById.mockResolvedValue(
      batchOf([transaction('a', 'aff-1'), transaction('b', 'aff-2')])
    );

    const { response, body } = await call();

    expect(response.status).toBe(200);
    for (const tx of body.transactions) {
      expect(tx.payoutDetailsChangedAt).toBeNull();
      expect(tx.payoutDetailsChangedSinceLastPaid).toBe(false);
      expect(tx.payoutHoldUntil).toBeNull();
    }
    expect(prisma.disbursementTransaction.findMany).not.toHaveBeenCalled();
  });

  it('looks only at this batch’s affiliates and only at recipients with a recorded change', async () => {
    mockGetBatchById.mockResolvedValue(
      batchOf([
        transaction('a', 'aff-1'),
        transaction('b', 'aff-1'),
        transaction('c', 'aff-2'),
      ])
    );

    await call();

    expect(prisma.affiliateWiseRecipient.findMany).toHaveBeenCalledWith({
      where: {
        affiliateProfileId: { in: ['aff-1', 'aff-2'] },
        detailsChangedAt: { not: null },
      },
      select: { affiliateProfileId: true, detailsChangedAt: true },
    });
  });

  it('flags a recipient changed after the affiliate’s last completed payout, and says when the hold ends', async () => {
    const changedAt = new Date(NOW.getTime() - 10 * HOUR);
    mockGetBatchById.mockResolvedValue(
      batchOf([transaction('a', 'aff-1'), transaction('b', 'aff-2')])
    );
    prisma.affiliateWiseRecipient.findMany.mockResolvedValue([
      { affiliateProfileId: 'aff-1', detailsChangedAt: changedAt },
    ]);
    prisma.disbursementTransaction.findMany.mockResolvedValue([
      {
        completedAt: new Date('2026-09-01T00:00:00.000Z'),
        commission: { affiliateProfileId: 'aff-1' },
      },
    ]);

    const { body } = await call();

    const [first, second] = body.transactions;
    expect(first.payoutDetailsChangedAt).toBe(changedAt.toISOString());
    expect(first.payoutDetailsChangedSinceLastPaid).toBe(true);
    expect(first.payoutHoldUntil).toBe(
      new Date(changedAt.getTime() + 72 * HOUR).toISOString()
    );
    expect(second.payoutDetailsChangedAt).toBeNull();
    expect(second.payoutDetailsChangedSinceLastPaid).toBe(false);
  });

  it('asks for earlier completed payouts of the changed affiliates only, outside this batch', async () => {
    mockGetBatchById.mockResolvedValue(
      batchOf([transaction('a', 'aff-1'), transaction('b', 'aff-2')])
    );
    prisma.affiliateWiseRecipient.findMany.mockResolvedValue([
      { affiliateProfileId: 'aff-1', detailsChangedAt: NOW },
    ]);

    await call();

    expect(prisma.disbursementTransaction.findMany).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        batchId: { not: 'batch-1' },
        commission: { affiliateProfileId: { in: ['aff-1'] } },
      },
      select: {
        completedAt: true,
        commission: { select: { affiliateProfileId: true } },
      },
    });
  });

  it('does not flag a recipient that was changed before the affiliate’s last payout', async () => {
    mockGetBatchById.mockResolvedValue(batchOf([transaction('a', 'aff-1')]));
    prisma.affiliateWiseRecipient.findMany.mockResolvedValue([
      {
        affiliateProfileId: 'aff-1',
        detailsChangedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);
    prisma.disbursementTransaction.findMany.mockResolvedValue([
      {
        completedAt: new Date('2026-10-01T00:00:00.000Z'),
        commission: { affiliateProfileId: 'aff-1' },
      },
      {
        completedAt: new Date('2026-08-01T00:00:00.000Z'),
        commission: { affiliateProfileId: 'aff-1' },
      },
    ]);

    const { body } = await call();

    expect(body.transactions[0].payoutDetailsChangedSinceLastPaid).toBe(false);
    expect(body.transactions[0].payoutHoldUntil).toBeNull();
    // the date of the change is still shown
    expect(body.transactions[0].payoutDetailsChangedAt).toBe(
      '2026-09-01T00:00:00.000Z'
    );
  });

  it('flags an affiliate who has never been paid and has a recorded change, with no hold left once 72 hours have passed', async () => {
    mockGetBatchById.mockResolvedValue(batchOf([transaction('a', 'aff-1')]));
    prisma.affiliateWiseRecipient.findMany.mockResolvedValue([
      {
        affiliateProfileId: 'aff-1',
        detailsChangedAt: new Date(NOW.getTime() - 100 * HOUR),
      },
    ]);

    const { body } = await call();

    expect(body.transactions[0].payoutDetailsChangedSinceLastPaid).toBe(true);
    expect(body.transactions[0].payoutHoldUntil).toBeNull();
  });

  it('keeps the rest of the answer as it was', async () => {
    mockGetBatchById.mockResolvedValue(batchOf([transaction('a', 'aff-1')]));
    mockGetCounts.mockResolvedValue({ PENDING: 1 });

    const { body } = await call();

    expect(body.batch).toMatchObject({ id: 'batch-1', provider: 'WISE' });
    expect(body.transactions[0]).toMatchObject({
      id: 'a',
      affiliateProfileId: 'aff-1',
      amount: 60,
      status: 'PENDING',
    });
    expect(body.transactionCounts).toEqual({ PENDING: 1 });
  });

  it('still refuses a caller who is not an admin', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { AuthError } = await import('@/lib/auth/errors');
    (requireAdmin as jest.Mock).mockRejectedValueOnce(
      new AuthError('Forbidden', 'FORBIDDEN', 403)
    );

    const { response } = await call();

    expect(response.status).toBe(403);
    expect(prisma.affiliateWiseRecipient.findMany).not.toHaveBeenCalled();
  });
});
