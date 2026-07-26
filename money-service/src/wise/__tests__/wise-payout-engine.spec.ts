/**
 * Wise Payout Engine Integration Test Suite (Session 4A-W6, File 8/8)
 *
 * Composed coverage across Files 1-6: real `PaymentOrchestratorService`,
 * `WisePaymentProvider`, `WiseQuoteService`, `WiseTransferService`,
 * `WiseBatchGroupService`, `BatchManagerService`, `TransactionService`,
 * `TransactionLoggerService`, `RetryHandlerService` all resolved through
 * Nest's real DI container (same convention as
 * `disbursement-processor.service.spec.ts`) — only the two true I/O
 * boundaries are mocked: `PrismaService` (deep mock) and
 * `WiseApiClient.request` (HTTP). Each file already has its own isolated
 * unit tests; this proves the pieces actually work TOGETHER.
 *
 * Covers this order's own Test 1 (recipient → batch → isFundable-false
 * branch → AWAITING_MANUAL_FUNDING, Commission untouched) and Test 2 (crash
 * resumability at the composed level, not just inside
 * `WiseTransferService` alone). Test 3 (mark-funded + webhook reducer event
 * → Commission=PAID) is `wise-payout.e2e.spec.ts`.
 */
import { Test } from '@nestjs/testing';

import { BatchManagerService } from '../../disbursement/batch-manager.service';
import { PaymentOrchestratorService } from '../../disbursement/payment-orchestrator.service';
import { RetryHandlerService } from '../../disbursement/retry-handler.service';
import { TransactionLoggerService } from '../../disbursement/transaction-logger.service';
import { TransactionService } from '../../disbursement/transaction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WisePaymentProvider } from '../providers/wise-payment.provider';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';
import { WiseQuoteService } from '../services/wise-quote.service';
import { WiseStateMapper } from '../services/wise-state.mapper';
import { WiseTransferService } from '../services/wise-transfer.service';
import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';
import { WiseSignatureVerifier } from '../wise-signature.verifier';

describe('Wise payout engine (composed, Files 1-6)', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let orchestrator: PaymentOrchestratorService;
  let wisePaymentProvider: WisePaymentProvider;
  let requestMock: jest.Mock;

  const paymentBatch = {
    id: 'batch-1',
    batchNumber: 'BATCH-2026-1',
    status: 'PENDING' as const,
    currency: 'USD',
    provider: 'WISE' as const,
    totalAmount: 100,
  };

  const disbursementTransaction = {
    id: 'dtx-1',
    batchId: 'batch-1',
    commissionId: 'comm-1',
    transactionId: 'TXN-1',
    status: 'PENDING' as const,
    amount: 100,
    currency: 'USD',
    provider: 'WISE' as const,
    affiliateRiseAccount: null,
    commission: {
      id: 'comm-1',
      status: 'APPROVED' as const,
      commissionAmount: 100,
      affiliateProfileId: 'aff-1',
    },
  };

  const activeRecipient = {
    id: 'rec-1',
    affiliateProfileId: 'aff-1',
    wiseRecipientId: '999',
    targetCurrency: 'GBP',
    status: 'ACTIVE' as const,
  };

  function mockWiseApi() {
    requestMock.mockImplementation(
      (path: string, options?: { method?: string }) => {
        const method = options?.method ?? 'GET';
        if (path.endsWith('/batch-groups') && method === 'POST') {
          return Promise.resolve({ id: 'wise-batch-uuid-1', version: 1 });
        }
        if (path.endsWith('/quotes') && method === 'POST') {
          return Promise.resolve({
            id: 'quote-1',
            sourceCurrency: 'USD',
            targetCurrency: 'GBP',
            sourceAmount: 128.5,
            targetAmount: 100,
            rate: 0.78,
            paymentOptions: [
              {
                disabled: false,
                sourceAmount: 128.5,
                targetAmount: 100,
                fee: { total: 3.5 },
              },
            ],
          });
        }
        if (path.includes('/batch-groups/') && path.endsWith('/transfers')) {
          return Promise.resolve({ id: 4567890 });
        }
        if (path.includes('/batch-groups/') && method === 'PATCH') {
          return Promise.resolve({
            id: 'wise-batch-uuid-1',
            version: 2,
            status: 'COMPLETED',
            payInDetails: [
              {
                type: 'bank_transfer',
                reference: 'REF-1',
                amount: 128.5,
                currency: 'USD',
                accountHolderName: 'Trading Alerts Ltd',
                raw: {},
              },
            ],
          });
        }
        throw new Error(`Unexpected Wise API call: ${method} ${path}`);
      }
    );
  }

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    requestMock = jest.fn();
    mockWiseApi();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentOrchestratorService,
        BatchManagerService,
        TransactionLoggerService,
        TransactionService,
        RetryHandlerService,
        WisePaymentProvider,
        WiseQuoteService,
        WiseTransferService,
        WiseBatchGroupService,
        WiseStateMapper,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: requestMock } },
        {
          provide: WiseConfig,
          useValue: {
            profileId: '29617748',
            fundingMode: 'MANUAL',
            environment: 'sandbox',
          },
        },
        {
          provide: WiseSignatureVerifier,
          useValue: { verifySignature: jest.fn() },
        },
      ],
    }).compile();

    orchestrator = moduleRef.get(PaymentOrchestratorService);
    wisePaymentProvider = moduleRef.get(WisePaymentProvider);

    prismaMock.disbursementAuditLog.create.mockResolvedValue({} as never);
    prismaMock.paymentBatch.findUnique.mockResolvedValue({
      ...paymentBatch,
      transactions: [disbursementTransaction],
      auditLogs: [],
    } as never);
    prismaMock.paymentBatch.update.mockResolvedValue({} as never);
    prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
      activeRecipient as never
    );
    prismaMock.disbursementTransaction.findUnique.mockResolvedValue(
      disbursementTransaction as never
    );
  });

  it('Test 1: recipient -> batch -> isFundable-false branch -> AWAITING_MANUAL_FUNDING, Commission untouched', async () => {
    prismaMock.wiseBatchGroup.findUnique.mockResolvedValue(null); // no existing draft
    prismaMock.wiseBatchGroup.create.mockImplementation(
      (args) =>
        Promise.resolve({ id: 'wbg-1', status: 'NEW', ...args.data }) as never
    );
    prismaMock.wiseBatchGroup.update.mockImplementation(
      (args) => Promise.resolve({ id: 'wbg-1', ...args.data }) as never
    );
    prismaMock.wiseBatchGroup.findUniqueOrThrow.mockImplementation(
      () =>
        Promise.resolve({
          id: 'wbg-1',
          wiseBatchGroupId: 'wise-batch-uuid-1',
          wiseVersion: 1,
          status: 'NEW',
        }) as never
    );
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(null);
    prismaMock.wiseTransfer.create.mockImplementation(
      (args) => Promise.resolve({ id: 'wt-1', ...args.data }) as never
    );
    prismaMock.wiseTransfer.update.mockImplementation(
      (args) => Promise.resolve({ id: 'wt-1', ...args.data }) as never
    );

    const result = await orchestrator.executeBatch(
      'batch-1',
      wisePaymentProvider
    );

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);

    // The batch group ended up AWAITING_MANUAL_FUNDING (last update call).
    const batchGroupUpdateCalls = prismaMock.wiseBatchGroup.update.mock.calls;
    const lastUpdate = batchGroupUpdateCalls[batchGroupUpdateCalls.length - 1];
    expect((lastUpdate[0] as { data: { status?: string } }).data.status).toBe(
      'AWAITING_MANUAL_FUNDING'
    );

    // The whole point of the isFundable branch (Hard Invariant #1).
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
    // DisbursementTransaction.status was never advanced past its
    // creation-time PENDING by this branch.
    expect(prismaMock.disbursementTransaction.update).not.toHaveBeenCalled();
  });

  it('Test 2: crash resumability at the composed level -- a retry with an existing placeholder WiseTransfer reuses the same customerTransactionId and creates zero duplicate Wise transfers', async () => {
    prismaMock.wiseBatchGroup.findUnique.mockResolvedValue({
      id: 'wbg-1',
      wiseBatchGroupId: 'wise-batch-uuid-1',
      wiseVersion: 1,
      status: 'NEW',
    } as never);

    const placeholder = {
      id: 'wt-1',
      disbursementTransactionId: 'dtx-1',
      customerTransactionId: 'cid-fixed-crash-sim',
      wiseTransferId: 'cid-fixed-crash-sim', // still a placeholder -- simulates a crash right after this row was written but before Wise responded
    };
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(placeholder as never);
    prismaMock.wiseTransfer.update.mockImplementation(
      (args) => Promise.resolve({ ...placeholder, ...args.data }) as never
    );

    const prepared = await wisePaymentProvider.prepareBatch({
      paymentBatchId: 'batch-1',
      batchName: 'BATCH-2026-1',
      sourceCurrency: 'USD',
      items: [
        { commissionId: 'comm-1', affiliateProfileId: 'aff-1', amount: 100 },
      ],
    });

    expect(prismaMock.wiseTransfer.create).not.toHaveBeenCalled();
    expect(prepared.transfers).toHaveLength(1);
    expect(prepared.transfers[0].idempotencyKey).toBe('cid-fixed-crash-sim');
    // Exactly one call to Wise's transfer-creation endpoint -- the retry
    // reused the row instead of drafting a second one.
    const transferCalls = requestMock.mock.calls.filter(([path]) =>
      (path as string).endsWith('/transfers')
    );
    expect(transferCalls).toHaveLength(1);
    expect(
      (transferCalls[0][1] as { body: { customerTransactionId: string } }).body
        .customerTransactionId
    ).toBe('cid-fixed-crash-sim');
  });
});
