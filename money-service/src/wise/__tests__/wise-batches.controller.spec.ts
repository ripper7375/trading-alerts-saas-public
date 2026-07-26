/**
 * Wise Batches Controller Tests (Session 4A-W6, File 6/8)
 */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseBatchesController } from '../controllers/wise-batches.controller';
import { CapabilityUnavailableError } from '../providers/provider-capabilities';
import { WisePaymentProvider } from '../providers/wise-payment.provider';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';

describe('WiseBatchesController', () => {
  let controller: WiseBatchesController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let wisePaymentProviderMock: {
    prepareBatch: jest.Mock;
    completeBatch: jest.Mock;
    fundBatchFromBalance: jest.Mock;
  };
  let wiseBatchGroupServiceMock: {
    markFunded: jest.Mock;
    cancelBatch: jest.Mock;
  };

  const batchGroup = {
    id: 'wbg-1',
    paymentBatchId: 'batch-1',
    wiseBatchGroupId: 'wise-uuid-1',
    sourceCurrency: 'USD',
    transferCount: 1,
    totalSourceAmount: 128.5,
    status: 'AWAITING_MANUAL_FUNDING',
    payInDetails: [{ type: 'bank_transfer', reference: 'REF-1' }],
    fundingSource: null,
    fundedAt: null,
    completedAt: new Date('2026-07-26T00:00:00Z'),
    createdAt: new Date('2026-07-26T00:00:00Z'),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    wisePaymentProviderMock = {
      prepareBatch: jest.fn(),
      completeBatch: jest.fn(),
      fundBatchFromBalance: jest.fn(),
    };
    wiseBatchGroupServiceMock = {
      markFunded: jest.fn(),
      cancelBatch: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WiseBatchesController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: WisePaymentProvider, useValue: wisePaymentProviderMock },
        { provide: WiseBatchGroupService, useValue: wiseBatchGroupServiceMock },
      ],
    }).compile();

    controller = moduleRef.get(WiseBatchesController);
  });

  describe('get', () => {
    it('404s when the batch group does not exist', async () => {
      prismaMock.wiseBatchGroup.findUnique.mockResolvedValue(null);
      await expect(controller.get('missing')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('returns the batch group detail with an empty failures array (not persisted)', async () => {
      prismaMock.wiseBatchGroup.findUnique.mockResolvedValue(
        batchGroup as never
      );
      const result = await controller.get('wbg-1');
      expect(result.status).toBe('AWAITING_MANUAL_FUNDING');
      expect(result.payInDetails).toEqual([
        { type: 'bank_transfer', reference: 'REF-1' },
      ]);
      expect(result.failures).toEqual([]);
    });
  });

  describe('markFunded', () => {
    it('is idempotent: a second call returns the already-FUNDED batch group without re-processing', async () => {
      prismaMock.wiseBatchGroup.findUnique.mockResolvedValue(
        batchGroup as never
      );
      const fundedOnce = { ...batchGroup, status: 'FUNDED' };
      wiseBatchGroupServiceMock.markFunded.mockResolvedValue(fundedOnce);

      const body = { fundedAt: '2026-07-27T00:00:00.000Z' };
      const first = await controller.markFunded('wbg-1', body);
      const second = await controller.markFunded('wbg-1', body);

      expect(first.status).toBe('FUNDED');
      expect(second.status).toBe('FUNDED');
      expect(wiseBatchGroupServiceMock.markFunded).toHaveBeenCalledTimes(2);
      // The idempotency guarantee itself lives in WiseBatchGroupService
      // (File 2/8, tested there) -- this proves the controller doesn't add
      // its own conflicting side effect on a repeat call.
    });
  });

  describe('fund', () => {
    it('maps CapabilityUnavailableError (WISE_FUNDING_MODE=MANUAL) to a client error rather than a 500', async () => {
      prismaMock.wiseBatchGroup.findUnique.mockResolvedValue(
        batchGroup as never
      );
      wisePaymentProviderMock.fundBatchFromBalance.mockRejectedValue(
        new CapabilityUnavailableError(
          'unavailable under MANUAL',
          'fundBatchFromBalance'
        )
      );

      await expect(controller.fund('wbg-1')).rejects.toMatchObject({
        response: expect.objectContaining({ statusCodeOverride: 501 }),
      });
    });
  });

  describe('prepare', () => {
    it('rejects a PaymentBatch whose provider is not WISE', async () => {
      prismaMock.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-1',
        provider: 'MOCK',
        batchNumber: 'BATCH-1',
        currency: 'USD',
      } as never);

      await expect(
        controller.prepare({
          paymentBatchId: 'batch-1',
          idempotencyKey: '11111111-1111-1111-1111-111111111111',
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: expect.stringContaining('WISE'),
        }),
      });
      expect(wisePaymentProviderMock.prepareBatch).not.toHaveBeenCalled();
    });
  });
});
