/**
 * Webhook Event Processor Service Tests (Session 4A-4, File 4/4)
 *
 * NEW backfill coverage — event-processor.ts (the source this service was
 * ported from) had ZERO existing tests anywhere in the monolith (confirmed
 * at CONFIRM via a repo-wide grep), same zero-coverage-backfill precedent
 * as Session 4A-2 (daily-maintenance composition, syncRiseWorksAccounts,
 * approveMaturedCommissions).
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { TransactionLoggerService } from './transaction-logger.service';
import { WebhookEventProcessorService } from './webhook-event-processor.service';

describe('WebhookEventProcessorService', () => {
  let service: WebhookEventProcessorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let loggerMock: {
    logPaymentCompleted: jest.Mock;
    logPaymentFailed: jest.Mock;
    log: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    loggerMock = {
      logPaymentCompleted: jest.fn().mockResolvedValue(undefined),
      logPaymentFailed: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookEventProcessorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TransactionLoggerService, useValue: loggerMock },
      ],
    }).compile();

    service = moduleRef.get(WebhookEventProcessorService);
  });

  describe('processEvent', () => {
    it('should dispatch payment.completed to handlePaymentCompleted', async () => {
      prismaMock.disbursementTransaction.findFirst.mockResolvedValue({
        id: 'txn-db-1',
        transactionId: 'txn-1',
        commissionId: 'comm-1',
        status: 'PENDING',
      } as never);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.update.mockResolvedValue({
        affiliateProfileId: 'aff-1',
        commissionAmount: 10,
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as never);
      prismaMock.disbursementTransaction.update.mockResolvedValue({} as never);

      const result = await service.processEvent({
        event: 'payment.completed',
        data: { providerTxId: 'provider-tx-1', amount: 50 },
        timestamp: new Date(),
      });

      expect(result.processed).toBe(true);
      expect(result.message).toContain('Payment completed');
    });

    it('should return unprocessed for an unhandled event type', async () => {
      const result = await service.processEvent({
        event: 'some.unknown.event',
        data: {},
        timestamp: new Date(),
      });

      expect(result).toEqual({
        processed: false,
        eventType: 'some.unknown.event',
        message: 'Unhandled event type: some.unknown.event',
      });
    });
  });

  describe('payment.completed handling', () => {
    it('should return unprocessed when providerTxId is missing', async () => {
      const result = await service.processEvent({
        event: 'payment.completed',
        data: {},
        timestamp: new Date(),
      });

      expect(result).toEqual({
        processed: false,
        eventType: 'payment.completed',
        message: 'Missing providerTxId in webhook payload',
      });
    });

    it('should return unprocessed when the transaction is not found', async () => {
      prismaMock.disbursementTransaction.findFirst.mockResolvedValue(null);

      const result = await service.processEvent({
        event: 'payment.completed',
        data: { providerTxId: 'missing-tx' },
        timestamp: new Date(),
      });

      expect(result.processed).toBe(false);
      expect(result.message).toContain('Transaction not found');
    });

    it('should be idempotent when the transaction is already completed', async () => {
      prismaMock.disbursementTransaction.findFirst.mockResolvedValue({
        id: 'txn-db-1',
        transactionId: 'txn-1',
        commissionId: 'comm-1',
        status: 'COMPLETED',
      } as never);

      const result = await service.processEvent({
        event: 'payment.completed',
        data: { providerTxId: 'provider-tx-1' },
        timestamp: new Date(),
      });

      expect(result).toEqual({
        processed: true,
        eventType: 'payment.completed',
        message: 'Transaction already completed (idempotent)',
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should complete the transaction, mark commission PAID, and move balances', async () => {
      prismaMock.disbursementTransaction.findFirst.mockResolvedValue({
        id: 'txn-db-1',
        transactionId: 'txn-1',
        commissionId: 'comm-1',
        status: 'PENDING',
      } as never);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.disbursementTransaction.update.mockResolvedValue({} as never);
      prismaMock.commission.update.mockResolvedValue({
        affiliateProfileId: 'aff-1',
        commissionAmount: 10,
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as never);

      const result = await service.processEvent({
        event: 'payment.completed',
        data: { providerTxId: 'provider-tx-1', amount: 50 },
        timestamp: new Date(),
      });

      expect(prismaMock.disbursementTransaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-db-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(prismaMock.commission.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: { status: 'PAID', paidAt: expect.any(Date) },
        select: { affiliateProfileId: true, commissionAmount: true },
      });
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          pendingCommissions: { decrement: 10 },
          paidCommissions: { increment: 10 },
        },
      });
      expect(loggerMock.logPaymentCompleted).toHaveBeenCalledWith('txn-1', 50);
      expect(result.processed).toBe(true);
    });
  });

  describe('payment.failed handling', () => {
    it('should return unprocessed when providerTxId is missing', async () => {
      const result = await service.processEvent({
        event: 'payment.failed',
        data: {},
        timestamp: new Date(),
      });

      expect(result.processed).toBe(false);
      expect(result.message).toContain('Missing providerTxId');
    });

    it('should be idempotent when the transaction is already failed', async () => {
      prismaMock.disbursementTransaction.findFirst.mockResolvedValue({
        id: 'txn-db-1',
        transactionId: 'txn-1',
        status: 'FAILED',
      } as never);

      const result = await service.processEvent({
        event: 'payment.failed',
        data: { providerTxId: 'provider-tx-1' },
        timestamp: new Date(),
      });

      expect(result).toEqual({
        processed: true,
        eventType: 'payment.failed',
        message: 'Transaction already failed (idempotent)',
      });
    });

    it('should mark the transaction FAILED and log it', async () => {
      prismaMock.disbursementTransaction.findFirst.mockResolvedValue({
        id: 'txn-db-1',
        transactionId: 'txn-1',
        status: 'PENDING',
      } as never);
      prismaMock.disbursementTransaction.update.mockResolvedValue({} as never);

      const result = await service.processEvent({
        event: 'payment.failed',
        data: { providerTxId: 'provider-tx-1', error: 'insufficient funds' },
        timestamp: new Date(),
      });

      expect(prismaMock.disbursementTransaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-db-1' },
        data: {
          status: 'FAILED',
          errorMessage: 'insufficient funds',
          failedAt: expect.any(Date),
        },
      });
      expect(loggerMock.logPaymentFailed).toHaveBeenCalledWith(
        'txn-1',
        'insufficient funds'
      );
      expect(result.processed).toBe(true);
    });
  });

  describe('invite.accepted handling', () => {
    it('should return unprocessed when email is missing', async () => {
      const result = await service.processEvent({
        event: 'invite.accepted',
        data: {},
        timestamp: new Date(),
      });

      expect(result.processed).toBe(false);
      expect(result.message).toContain('Missing email');
    });

    it('should mark the invite accepted and log it', async () => {
      prismaMock.affiliateRiseAccount.updateMany.mockResolvedValue({
        count: 1,
      } as never);

      const result = await service.processEvent({
        event: 'invite.accepted',
        data: { email: 'affiliate@example.com', riseId: 'rise-1' },
        timestamp: new Date(),
      });

      expect(prismaMock.affiliateRiseAccount.updateMany).toHaveBeenCalledWith({
        where: {
          email: 'affiliate@example.com',
          invitationAcceptedAt: null,
        },
        data: {
          invitationAcceptedAt: expect.any(Date),
          kycStatus: 'SUBMITTED',
          riseId: 'rise-1',
        },
      });
      expect(loggerMock.log).toHaveBeenCalledWith({
        action: 'rise.invite_accepted',
        status: 'SUCCESS',
        details: { riseId: 'rise-1', email: 'affiliate@example.com' },
      });
      expect(result.processed).toBe(true);
    });

    it('should be idempotent when nothing matched (already accepted)', async () => {
      prismaMock.affiliateRiseAccount.updateMany.mockResolvedValue({
        count: 0,
      } as never);

      const result = await service.processEvent({
        event: 'invite.accepted',
        data: { email: 'affiliate@example.com' },
        timestamp: new Date(),
      });

      expect(result).toEqual({
        processed: true,
        eventType: 'invite.accepted',
        message: 'Invite already accepted (idempotent)',
      });
      expect(loggerMock.log).not.toHaveBeenCalled();
    });
  });
});
