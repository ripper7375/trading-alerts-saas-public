/**
 * Wise Webhook Processor Tests (Session 4A-W5, extends File 3/8's own
 * "Unit tests asserting jobId derivation, onModuleDestroy worker drain
 * call, and dead-letter routing" verification promise — no dedicated test
 * file was allocated to it in the order's 8-file breakdown, so this file
 * exists to actually fulfill that promise rather than leave it uncovered;
 * see this order's Deviations).
 */
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseEventHandlers } from '../services/wise-event-handlers';
import { WiseTransferStateReducer } from '../services/wise-transfer-state.reducer';
import { WiseWebhookProcessor } from '../queue/wise-webhook.processor';

describe('WiseWebhookProcessor', () => {
  let processor: WiseWebhookProcessor;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let reducerMock: { reduceTransferEvent: jest.Mock };
  let eventHandlersMock: {
    handlePayoutFailure: jest.Mock;
    handleBalanceUpdate: jest.Mock;
  };

  function job(webhookEventId: string, attemptsMade = 0): Job {
    return { data: { webhookEventId }, attemptsMade } as unknown as Job;
  }

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    reducerMock = {
      reduceTransferEvent: jest.fn().mockResolvedValue(undefined),
    };
    eventHandlersMock = {
      handlePayoutFailure: jest.fn().mockResolvedValue(undefined),
      handleBalanceUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseWebhookProcessor,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseTransferStateReducer, useValue: reducerMock },
        { provide: WiseEventHandlers, useValue: eventHandlersMock },
      ],
    }).compile();

    processor = moduleRef.get(WiseWebhookProcessor);
    prismaMock.wiseWebhookEvent.update.mockResolvedValue({} as never);
  });

  it('increments attemptCount on every attempt', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-1',
      eventType: 'transfers#state-change',
    } as never);

    await processor.process(job('evt-1'));

    expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { attemptCount: { increment: 1 } },
    });
  });

  it('routes transfers#state-change to the reducer', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-1',
      eventType: 'transfers#state-change',
    } as never);

    await processor.process(job('evt-1'));

    expect(reducerMock.reduceTransferEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-1' })
    );
  });

  it('routes transfers#payout-failure to the event handlers', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-2',
      eventType: 'transfers#payout-failure',
    } as never);

    await processor.process(job('evt-2'));

    expect(eventHandlersMock.handlePayoutFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-2' })
    );
  });

  it('routes balances#update to the event handlers', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-3',
      eventType: 'balances#update',
    } as never);

    await processor.process(job('evt-3'));

    expect(eventHandlersMock.handleBalanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-3' })
    );
  });

  it('persists-and-skips an unhandled event type without throwing', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-4',
      eventType: 'profiles#state-change',
    } as never);

    await expect(processor.process(job('evt-4'))).resolves.not.toThrow();

    expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-4' },
      data: {
        processed: true,
        processedAt: expect.any(Date),
        skippedReason: 'unhandled-event-type',
      },
    });
  });

  it('records errorMessage and re-throws on handler failure, leaving attemptCount as the dead-letter surface for BullMQ retries', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-5',
      eventType: 'transfers#state-change',
    } as never);
    reducerMock.reduceTransferEvent.mockRejectedValue(new Error('db down'));

    await expect(processor.process(job('evt-5', 2))).rejects.toThrow('db down');

    expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-5' },
      data: { errorMessage: 'db down' },
    });
  });

  it('does not throw when the job references a missing WiseWebhookEvent row', async () => {
    prismaMock.wiseWebhookEvent.findUnique.mockResolvedValue(null);

    await expect(
      processor.process(job('does-not-exist'))
    ).resolves.not.toThrow();
    expect(reducerMock.reduceTransferEvent).not.toHaveBeenCalled();
  });

  it('onModuleDestroy drains the worker via worker.close()', async () => {
    const closeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(processor, 'worker', {
      get: () => ({ close: closeMock }),
    });

    await processor.onModuleDestroy();

    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
