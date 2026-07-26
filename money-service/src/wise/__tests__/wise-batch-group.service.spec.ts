/**
 * Wise Batch Group Service Tests (Session 4A-W6, File 2/8)
 *
 * `markFunded` idempotency is a Hard Invariant of the human funding gate
 * (OpenAPI `mark-funded`: "a second call is a no-op") and is explicitly
 * required in this order's own Done-when.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseApiClient } from '../wise-api.client';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';
import { WiseConfig } from '../wise.config';

describe('WiseBatchGroupService', () => {
  let service: WiseBatchGroupService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let requestMock: jest.Mock;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    requestMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseBatchGroupService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: requestMock } },
        { provide: WiseConfig, useValue: { profileId: '29617748' } },
      ],
    }).compile();

    service = moduleRef.get(WiseBatchGroupService);
  });

  describe('markFunded', () => {
    it('is idempotent -- a second call on an already-FUNDED batch is a no-op', async () => {
      const fundedBatch = {
        id: 'wbg-1',
        status: 'FUNDED',
        fundedAt: new Date('2026-07-26T00:00:00Z'),
      };
      prismaMock.wiseBatchGroup.findUniqueOrThrow.mockResolvedValue(
        fundedBatch as never
      );

      const result = await service.markFunded('wbg-1', {
        fundedAt: new Date(),
      });

      expect(result).toBe(fundedBatch);
      expect(prismaMock.wiseBatchGroup.update).not.toHaveBeenCalled();
    });

    it('the first call transitions AWAITING_MANUAL_FUNDING -> FUNDED with MANUAL_ADMIN evidence', async () => {
      prismaMock.wiseBatchGroup.findUniqueOrThrow.mockResolvedValue({
        id: 'wbg-1',
        status: 'AWAITING_MANUAL_FUNDING',
      } as never);
      prismaMock.wiseBatchGroup.update.mockImplementation(
        (args) => Promise.resolve({ id: 'wbg-1', ...args.data }) as never
      );

      const fundedAt = new Date('2026-07-27T00:00:00Z');
      const result = await service.markFunded('wbg-1', {
        fundedAt,
        bankReference: 'REF-123',
      });

      expect(prismaMock.wiseBatchGroup.update).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('FUNDED');
      expect(result.fundingSource).toBe('MANUAL_ADMIN');
    });
  });

  describe('completeBatch', () => {
    it('closes NEW -> AWAITING_MANUAL_FUNDING under MANUAL mode and stores payInDetails verbatim', async () => {
      requestMock.mockResolvedValue({
        id: 'wise-batch-uuid',
        version: 2,
        status: 'COMPLETED',
        payInDetails: [{ type: 'bank_transfer', reference: 'REF-1' }],
      });
      prismaMock.wiseBatchGroup.update.mockImplementation(
        (args) => Promise.resolve({ id: 'wbg-1', ...args.data }) as never
      );

      const { batchGroup, payInDetails } = await service.completeBatch(
        {
          id: 'wbg-1',
          status: 'NEW',
          wiseBatchGroupId: 'wise-batch-uuid',
          wiseVersion: 1,
        } as never,
        'MANUAL'
      );

      expect(batchGroup.status).toBe('AWAITING_MANUAL_FUNDING');
      expect(payInDetails).toEqual([
        { type: 'bank_transfer', reference: 'REF-1' },
      ]);
    });

    it('is a no-op past NEW -- does not call Wise again', async () => {
      const alreadyCompleted = {
        id: 'wbg-1',
        status: 'AWAITING_MANUAL_FUNDING',
        payInDetails: [{ type: 'bank_transfer', reference: 'REF-1' }],
      };

      const { batchGroup } = await service.completeBatch(
        alreadyCompleted as never,
        'MANUAL'
      );

      expect(requestMock).not.toHaveBeenCalled();
      expect(batchGroup).toBe(alreadyCompleted);
    });
  });
});
