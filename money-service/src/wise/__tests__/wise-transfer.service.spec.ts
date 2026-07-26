/**
 * Wise Transfer Service Tests (Session 4A-W6, File 2/8)
 *
 * Proves Hard Invariant #5's actual guarantee: a crash between persisting
 * the placeholder row and receiving Wise's response, followed by a retry,
 * reuses the SAME `customerTransactionId` and creates zero duplicate Wise
 * transfers. Also proves a fully-completed transfer is never re-sent.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseApiClient } from '../wise-api.client';
import { WiseTransferService } from '../services/wise-transfer.service';
import { WiseConfig } from '../wise.config';

describe('WiseTransferService', () => {
  let service: WiseTransferService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let requestMock: jest.Mock;

  const baseInput = {
    disbursementTransactionId: 'dtx-1',
    affiliateWiseRecipientId: 'rec-1',
    wiseBatchGroupDbId: 'wbg-db-1',
    wiseBatchGroupId: 'wbg-wise-uuid-1',
    wiseQuoteId: 'quote-1',
    targetAccountId: '999',
    reference: 'DavinTrade commission BATCH-1',
    sourceCurrency: 'USD',
    sourceValue: 128.5,
    targetCurrency: 'GBP',
    targetValue: 100,
    rate: 0.78,
    feeAmount: 3.5,
    feeBearer: 'PLATFORM',
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    requestMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseTransferService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: requestMock } },
        { provide: WiseConfig, useValue: { profileId: '29617748' } },
      ],
    }).compile();

    service = moduleRef.get(WiseTransferService);
  });

  it('creates a placeholder row before calling Wise, then overwrites it with the real transfer id', async () => {
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(null);
    prismaMock.wiseTransfer.create.mockImplementation(
      (args) =>
        Promise.resolve({
          id: 'wt-1',
          ...args.data,
        }) as never
    );
    prismaMock.wiseTransfer.update.mockImplementation(
      (args) => Promise.resolve({ id: 'wt-1', ...args.data }) as never
    );
    requestMock.mockResolvedValue({ id: 4567890 });

    const { transfer, created } =
      await service.createBatchGroupTransfer(baseInput);

    expect(prismaMock.wiseTransfer.create).toHaveBeenCalledTimes(1);
    const createCall = prismaMock.wiseTransfer.create.mock.calls[0][0];
    // Placeholder: wiseTransferId === customerTransactionId at creation time.
    expect(createCall.data.wiseTransferId).toBe(
      createCall.data.customerTransactionId
    );
    expect(requestMock).toHaveBeenCalledWith(
      '/v3/profiles/29617748/batch-groups/wbg-wise-uuid-1/transfers',
      expect.objectContaining({
        body: expect.objectContaining({
          customerTransactionId: createCall.data.customerTransactionId,
        }),
      })
    );
    expect(prismaMock.wiseTransfer.update).toHaveBeenCalledWith({
      where: { id: 'wt-1' },
      data: { wiseTransferId: '4567890' },
    });
    expect(transfer.wiseTransferId).toBe('4567890');
    expect(created).toBe(true);
  });

  it('a retry that finds an existing placeholder reuses the same customerTransactionId and creates zero new rows', async () => {
    const placeholder = {
      id: 'wt-1',
      disbursementTransactionId: 'dtx-1',
      customerTransactionId: 'cid-fixed-1234',
      wiseTransferId: 'cid-fixed-1234', // still a placeholder
    };
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(placeholder as never);
    prismaMock.wiseTransfer.update.mockImplementation(
      (args) => Promise.resolve({ ...placeholder, ...args.data }) as never
    );
    requestMock.mockResolvedValue({ id: 4567890 });

    const { transfer, created } =
      await service.createBatchGroupTransfer(baseInput);

    expect(prismaMock.wiseTransfer.create).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          customerTransactionId: 'cid-fixed-1234',
        }),
      })
    );
    expect(transfer.wiseTransferId).toBe('4567890');
    expect(created).toBe(true);
  });

  it('a transfer already completed on a prior attempt is never re-sent to Wise', async () => {
    const completed = {
      id: 'wt-1',
      disbursementTransactionId: 'dtx-1',
      customerTransactionId: 'cid-fixed-1234',
      wiseTransferId: '4567890', // real Wise id, no longer a placeholder
    };
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(completed as never);

    const { transfer, created } =
      await service.createBatchGroupTransfer(baseInput);

    expect(requestMock).not.toHaveBeenCalled();
    expect(prismaMock.wiseTransfer.create).not.toHaveBeenCalled();
    expect(prismaMock.wiseTransfer.update).not.toHaveBeenCalled();
    expect(transfer).toBe(completed);
    expect(created).toBe(false);
  });
});
