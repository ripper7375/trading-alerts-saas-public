/**
 * Disbursement Processor Service Tests
 *
 * Session 4A-2, File 6/6. `processAutomatedDisbursements` has one real
 * assertion ported from __tests__/api/cron/process-pending.test.ts (the
 * "accept valid secret" smoke test, minus the now-guard-owned auth check:
 * with no payable commissions, the result shape is success/timestamp/result
 * — see that test's own describe block). `syncRiseWorksAccounts` and
 * `approveMaturedCommissions` are NEW backfill coverage — neither had any
 * test anywhere in the monolith (flagged at this order's CONFIRM).
 *
 * Only `PrismaService` is mocked — every other collaborator
 * (CommissionAggregatorService, BatchManagerService,
 * PaymentOrchestratorService, TransactionLoggerService) is the REAL class,
 * resolved through Nest's own DI container. This exercises the actual
 * wiring across all of File 3/6's dependency tree, not just this one
 * service in isolation.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { BatchManagerService } from './batch-manager.service';
import { CommissionAggregatorService } from './commission-aggregator.service';
import { DisbursementProcessorService } from './disbursement-processor.service';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { RetryHandlerService } from './retry-handler.service';
import { TransactionLoggerService } from './transaction-logger.service';
import { TransactionService } from './transaction.service';

describe('DisbursementProcessorService', () => {
  let service: DisbursementProcessorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DisbursementProcessorService,
        CommissionAggregatorService,
        BatchManagerService,
        PaymentOrchestratorService,
        TransactionLoggerService,
        TransactionService,
        RetryHandlerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(DisbursementProcessorService);

    prismaMock.disbursementAuditLog.create.mockResolvedValue({} as never);
  });

  describe('approveMaturedCommissions', () => {
    it('approves PENDING commissions past the default 14-day window', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue(null);
      prismaMock.commission.updateMany.mockResolvedValue({ count: 3 } as never);

      const approvedCount = await service.approveMaturedCommissions();

      expect(approvedCount).toBe(3);
      expect(prismaMock.commission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
          data: { status: 'APPROVED', approvedAt: expect.any(Date) },
        })
      );
    });

    it('uses the SystemConfig-tuned window when set', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        key: 'affiliate_commission_approval_days',
        value: '7',
        valueType: 'number',
        description: null,
        category: 'affiliate',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      prismaMock.commission.updateMany.mockResolvedValue({ count: 0 } as never);

      await service.approveMaturedCommissions();

      const call = prismaMock.commission.updateMany.mock.calls[0]?.[0] as {
        where: { earnedAt: { lte: Date } };
      };
      const maturityDate = call.where.earnedAt.lte;
      const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      // Within a few seconds of each other (both computed via Date.now()).
      expect(
        Math.abs(maturityDate.getTime() - expected.getTime())
      ).toBeLessThan(5000);
    });

    it('falls back to the default window if the config lookup throws', async () => {
      prismaMock.systemConfig.findUnique.mockRejectedValue(
        new Error('db down')
      );
      prismaMock.commission.updateMany.mockResolvedValue({ count: 0 } as never);

      await expect(service.approveMaturedCommissions()).resolves.toBe(0);
    });
  });

  describe('processAutomatedDisbursements', () => {
    it('returns a success result with zero batches when there are no payable affiliates', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue(null);
      prismaMock.commission.updateMany.mockResolvedValue({ count: 0 } as never);
      prismaMock.commission.findMany.mockResolvedValue([]);

      const result = await service.processAutomatedDisbursements();

      expect(result.success).toBe(true);
      expect(result.batchesCreated).toBe(0);
      expect(result.batchesExecuted).toBe(0);
      expect(result.affiliatesProcessed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('endTime');
      expect(result).toHaveProperty('durationMs');
    });

    it('reports failure and logs when the top-level flow throws', async () => {
      prismaMock.systemConfig.findUnique.mockResolvedValue(null);
      prismaMock.commission.updateMany.mockRejectedValue(
        new Error('unexpected db error')
      );

      const result = await service.processAutomatedDisbursements();

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('unexpected db error');
    });
  });

  describe('syncRiseWorksAccounts', () => {
    it('updates lastSyncAt for every Rise account (new backfill coverage)', async () => {
      const accounts = [
        { id: 'rise-1', riseId: 'addr-1' },
        { id: 'rise-2', riseId: 'addr-2' },
      ];
      prismaMock.affiliateRiseAccount.findMany.mockResolvedValue(
        accounts as never
      );
      prismaMock.affiliateRiseAccount.update.mockResolvedValue({} as never);

      const result = await service.syncRiseWorksAccounts();

      expect(result.success).toBe(true);
      expect(result.accountsSynced).toBe(2);
      expect(result.accountsUpdated).toBe(2);
      expect(prismaMock.affiliateRiseAccount.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.affiliateRiseAccount.update).toHaveBeenCalledWith({
        where: { id: 'rise-1' },
        data: { lastSyncAt: expect.any(Date) },
      });
    });

    it('collects per-account errors without aborting the whole sync', async () => {
      const accounts = [
        { id: 'rise-ok', riseId: 'addr-ok' },
        { id: 'rise-bad', riseId: 'addr-bad' },
      ];
      prismaMock.affiliateRiseAccount.findMany.mockResolvedValue(
        accounts as never
      );
      prismaMock.affiliateRiseAccount.update
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(new Error('update failed'));

      const result = await service.syncRiseWorksAccounts();

      expect(result.accountsSynced).toBe(2);
      expect(result.accountsUpdated).toBe(1);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('rise-bad');
    });

    it('handles zero Rise accounts gracefully', async () => {
      prismaMock.affiliateRiseAccount.findMany.mockResolvedValue([]);

      const result = await service.syncRiseWorksAccounts();

      expect(result.success).toBe(true);
      expect(result.accountsSynced).toBe(0);
      expect(result.accountsUpdated).toBe(0);
    });
  });
});
