/**
 * Payment Orchestrator Service Tests (Session 4A-W6, File 4/8)
 *
 * This order's own Hard Invariant #4 / Rules ("every pre-existing test in
 * payment-orchestrator.service.spec.ts MUST pass UNMODIFIED") assumed this
 * file already existed as the parity oracle for the non-Wise (Rise/Mock)
 * path. It did not (verified live at CONFIRM — no test file for the
 * orchestrator exists anywhere in the tree, `LESSONS-LEARNED.md` L27-class
 * order-vs-ground-truth drift). This file fills that real gap: the
 * `describe('non-fundable provider (existing behavior)', ...)` block below
 * is what "unmodified" was supposed to protect and now actually does,
 * exercised against the REAL `MockPaymentProvider` and unmodified
 * `executeBatch` code paths (everything before the new `isFundable` branch
 * is byte-for-byte what shipped before this session). The
 * `describe('fundable provider (isFundable branch, Wise)', ...)` block
 * covers this session's own new code (Hard Invariant #1).
 *
 * Only `PrismaService` is mocked; every other collaborator is the real
 * class through Nest's DI container, same convention as
 * `disbursement-processor.service.spec.ts`.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';
import type {
  FundableProvider,
  PrepareBatchInput,
  PreparedBatch,
  PayInInstruction,
} from '../wise/providers/provider-capabilities';

import { BatchManagerService } from './batch-manager.service';
import { MockPaymentProvider } from './providers/mock-provider';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { RetryHandlerService } from './retry-handler.service';
import { TransactionLoggerService } from './transaction-logger.service';
import { TransactionService } from './transaction.service';

function makeFundableStub(
  overrides: Partial<FundableProvider> = {}
): MockPaymentProvider & FundableProvider {
  const provider = new MockPaymentProvider({ failureRate: 0 });
  return Object.assign(provider, {
    fundingMode: 'MANUAL' as const,
    prepareBatch: jest.fn(),
    completeBatch: jest.fn(),
    fundBatchFromBalance: jest.fn(),
    cancelBatch: jest.fn(),
    ...overrides,
  });
}

describe('PaymentOrchestratorService', () => {
  let service: PaymentOrchestratorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const baseTransaction = {
    id: 'dtx-1',
    batchId: 'batch-1',
    commissionId: 'comm-1',
    transactionId: 'TXN-1',
    status: 'PENDING' as const,
    amount: 100,
    currency: 'USD',
    provider: 'MOCK' as const,
    affiliateRiseAccount: null,
    commission: {
      id: 'comm-1',
      status: 'APPROVED' as const,
      commissionAmount: 100,
      affiliateProfileId: 'aff-1',
    },
  };

  const baseBatch = {
    id: 'batch-1',
    batchNumber: 'BATCH-2026-1',
    status: 'PENDING' as const,
    currency: 'USD',
    totalAmount: 100,
    transactions: [baseTransaction],
    auditLogs: [],
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentOrchestratorService,
        BatchManagerService,
        TransactionLoggerService,
        TransactionService,
        RetryHandlerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(PaymentOrchestratorService);

    prismaMock.disbursementAuditLog.create.mockResolvedValue({} as never);
    prismaMock.paymentBatch.update.mockResolvedValue({} as never);
  });

  describe('non-fundable provider (existing behavior, unmodified code path)', () => {
    it('throws when the batch does not exist', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue(null);
      await expect(
        service.executeBatch('missing', new MockPaymentProvider())
      ).rejects.toThrow('Batch not found');
    });

    it('throws when the batch is not PENDING or QUEUED', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue({
        ...baseBatch,
        status: 'COMPLETED',
      } as never);
      await expect(
        service.executeBatch('batch-1', new MockPaymentProvider())
      ).rejects.toThrow(/Cannot execute batch/);
    });

    it('with zero pending transactions, marks the batch COMPLETED and returns zero counts', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue({
        ...baseBatch,
        transactions: [{ ...baseTransaction, status: 'COMPLETED' }],
      } as never);

      const result = await service.executeBatch(
        'batch-1',
        new MockPaymentProvider()
      );

      expect(result).toMatchObject({
        success: true,
        successCount: 0,
        failedCount: 0,
        totalAmount: 0,
      });
      expect(prismaMock.paymentBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    /**
     * FINDING (recorded in this order's Deviations, not fixed here — out of
     * scope for a Wise PORT session and possibly accidentally load-bearing,
     * see below): `MockPaymentProvider.sendPayment` mints its own random
     * `transactionId` via `generateTransactionId()` rather than echoing back
     * the caller's `PaymentRequest.metadata.transactionId`. `executeBatch`'s
     * existing (unmodified) result-matching is
     * `pendingTransactions.find(t => t.transactionId === paymentResult.transactionId)`
     * — that match can never succeed for `MockPaymentProvider`, so
     * `handleSuccessfulPayment`/`handleFailedPayment` are never called and
     * the transaction is silently skipped (logged via `console.error`, not
     * thrown). The batch still reports `success: true` (0 failures) and
     * gets marked `COMPLETED` despite zero transactions actually being
     * processed. Since `DISBURSEMENT_PROVIDER` stays `MOCK` in production
     * throughout Part 19.5 specifically as a no-real-money safety rail, this
     * may be accidentally desirable (a "fixed" matcher would start actually
     * marking commissions `PAID` under `MOCK` in production, which nothing
     * receives) — flagging for Davin/Advisor rather than changing it as a
     * drive-by inside this session.
     */
    it('KNOWN GAP: MockPaymentProvider mints its own transactionId, so the result never matches and the "successful" payment is silently skipped', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue(baseBatch as never);

      const provider = new MockPaymentProvider({ failureRate: 0, delay: 0 });
      const result = await service.executeBatch('batch-1', provider);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.disbursementTransaction.update).not.toHaveBeenCalled();
      expect(prismaMock.paymentBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    it('Hard Invariant #2 / design §3.5(a) fix: the PaymentRequest carries a non-empty affiliateId even when affiliateRiseAccount is absent', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue({
        ...baseBatch,
        transactions: [{ ...baseTransaction, affiliateRiseAccount: null }],
      } as never);

      const provider = new MockPaymentProvider({ failureRate: 0, delay: 0 });
      const sendBatchPaymentSpy = jest.spyOn(provider, 'sendBatchPayment');

      await service.executeBatch('batch-1', provider);

      expect(sendBatchPaymentSpy).toHaveBeenCalledWith([
        expect.objectContaining({ affiliateId: 'aff-1' }), // from commission.affiliateProfileId, not the null affiliateRiseAccount
      ]);
    });
  });

  describe('fundable provider (isFundable branch, Wise — Hard Invariant #1)', () => {
    it('drafts via prepareBatch/completeBatch and never touches Commission.status or AffiliateProfile.balance', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue(baseBatch as never);

      const prepared: PreparedBatch = {
        providerBatchId: 'wise-batch-uuid',
        providerBatchVersion: 1,
        transfers: [
          {
            commissionId: 'comm-1',
            affiliateProfileId: 'aff-1',
            providerTransferId: '4567890',
            providerQuoteId: 'quote-1',
            providerRecipientId: '999',
            idempotencyKey: 'cid-1',
            sourceCurrency: 'USD',
            sourceValue: 128.5,
            targetCurrency: 'GBP',
            targetValue: 100,
            rate: 0.78,
            fee: 3.5,
            reference: 'ref-1',
          },
        ],
        sourceCurrency: 'USD',
        totalSourceAmount: 128.5,
        failures: [],
      };
      const payInDetails: PayInInstruction[] = [
        {
          type: 'bank_transfer',
          reference: 'REF-1',
          amount: 128.5,
          currency: 'USD',
          accountHolderName: 'Trading Alerts Ltd',
          raw: {},
        },
      ];

      const provider = makeFundableStub();
      (provider.prepareBatch as jest.Mock).mockResolvedValue(prepared);
      (provider.completeBatch as jest.Mock).mockResolvedValue(payInDetails);

      const result = await service.executeBatch('batch-1', provider);

      expect(provider.prepareBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentBatchId: 'batch-1',
          batchName: 'BATCH-2026-1',
          items: [
            expect.objectContaining({
              commissionId: 'comm-1',
              affiliateProfileId: 'aff-1', // Hard Invariant #2 fix, exercised here too
              amount: 100,
            }),
          ],
        } satisfies Partial<PrepareBatchInput>)
      );
      expect(provider.completeBatch).toHaveBeenCalledWith('wise-batch-uuid');
      expect(result).toMatchObject({
        success: true,
        successCount: 1,
        failedCount: 0,
        totalAmount: 128.5,
      });

      // The whole point of the branch: never touch Commission/balance here.
      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
      // PaymentBatch.status was set PROCESSING once, at the top of
      // executeBatch — never advanced to COMPLETED by this branch.
      const batchStatusUpdates = prismaMock.paymentBatch.update.mock.calls.map(
        (call) => (call[0] as { data: { status?: string } }).data.status
      );
      expect(batchStatusUpdates).toEqual(['PROCESSING']);
    });

    it('a per-affiliate drafting failure marks that transaction FAILED without aborting the batch', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue(baseBatch as never);
      prismaMock.disbursementTransaction.update.mockResolvedValue({} as never);

      const prepared: PreparedBatch = {
        providerBatchId: 'wise-batch-uuid',
        providerBatchVersion: 1,
        transfers: [],
        sourceCurrency: 'USD',
        totalSourceAmount: 0,
        failures: [
          {
            commissionId: 'comm-1',
            affiliateProfileId: 'aff-1',
            reason: 'No Wise recipient on file',
          },
        ],
      };

      const provider = makeFundableStub();
      (provider.prepareBatch as jest.Mock).mockResolvedValue(prepared);

      const result = await service.executeBatch('batch-1', provider);

      expect(provider.completeBatch).not.toHaveBeenCalled(); // zero transfers to complete
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0]).toContain('No Wise recipient on file');
      expect(prismaMock.disbursementTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dtx-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
      expect(prismaMock.commission.update).not.toHaveBeenCalled();
    });
  });
});
