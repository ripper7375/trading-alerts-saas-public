/**
 * Wise Reconciliation Service Tests (Session 4A-W6, File 7/8)
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';
import { WiseTransferStateReducer } from '../wise/services/wise-transfer-state.reducer';
import { WiseApiClient } from '../wise/wise-api.client';
import { WiseConfig } from '../wise/wise.config';

import { WiseReconciliationService } from './wise-reconciliation.service';

describe('WiseReconciliationService', () => {
  let service: WiseReconciliationService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let requestMock: jest.Mock;
  let reduceTransferEventMock: jest.Mock;
  let fetchMock: jest.Mock;
  const originalEnv = process.env;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    requestMock = jest.fn();
    reduceTransferEventMock = jest.fn();
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env = { ...originalEnv };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseReconciliationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: requestMock } },
        {
          provide: WiseConfig,
          useValue: { fundingSlaHours: 72 },
        },
        {
          provide: WiseTransferStateReducer,
          useValue: { reduceTransferEvent: reduceTransferEventMock },
        },
      ],
    }).compile();

    service = moduleRef.get(WiseReconciliationService);
    prismaMock.wiseTransfer.findMany.mockResolvedValue([]);
    prismaMock.wiseBatchGroup.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('funding-SLA alarm (REQUIRED)', () => {
    it("fires when a batch has been AWAITING_MANUAL_FUNDING past the configured SLA (72h, not this order text's 24h)", async () => {
      process.env['RESEND_API_KEY'] = 'test-key';
      process.env['WISE_FUNDING_ALERT_EMAIL'] = 'davin@example.com';

      const breachedBatch = {
        id: 'wbg-1',
        wiseBatchGroupId: 'wise-uuid-1',
        totalSourceAmount: 128.5,
        sourceCurrency: 'USD',
        completedAt: new Date(Date.now() - 73 * 60 * 60 * 1000), // 73h ago
      };
      prismaMock.wiseBatchGroup.findMany.mockResolvedValue([
        breachedBatch,
      ] as never);

      const result = await service.reconcile();

      expect(result.fundingSlaBreaches).toBe(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.to).toBe('davin@example.com');
      expect(sentBody.html).toContain('wise-uuid-1');
    });

    it('does not fire for a batch still within the SLA window', async () => {
      process.env['RESEND_API_KEY'] = 'test-key';
      process.env['WISE_FUNDING_ALERT_EMAIL'] = 'davin@example.com';
      prismaMock.wiseBatchGroup.findMany.mockResolvedValue([]);

      const result = await service.reconcile();

      expect(result.fundingSlaBreaches).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails closed when RESEND_API_KEY is not configured -- never throws, never crashes the cron', async () => {
      delete process.env['RESEND_API_KEY'];
      prismaMock.wiseBatchGroup.findMany.mockResolvedValue([
        {
          id: 'wbg-1',
          wiseBatchGroupId: 'wise-uuid-1',
          totalSourceAmount: 100,
          sourceCurrency: 'USD',
          completedAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
        },
      ] as never);

      await expect(service.reconcile()).resolves.toMatchObject({
        fundingSlaBreaches: 1,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('non-terminal transfer reconciliation', () => {
    it('feeds a fresh Wise status through the SAME reducer as a synthetic event', async () => {
      prismaMock.wiseTransfer.findMany.mockResolvedValue([
        {
          id: 'wt-1',
          wiseTransferId: '4567890',
          currentState: 'processing',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ] as never);
      requestMock.mockResolvedValue({ status: 'funds_converted' });
      prismaMock.wiseWebhookEvent.create.mockResolvedValue({
        id: 'evt-1',
      } as never);

      await service.reconcile();

      expect(prismaMock.wiseWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryId: expect.stringMatching(
              /^recon:4567890:funds_converted:/
            ),
            currentState: 'funds_converted',
          }),
        })
      );
      expect(reduceTransferEventMock).toHaveBeenCalledWith({ id: 'evt-1' });
    });

    it('a duplicate reconciliation within the same hour is a no-op (deliveryId dedupe)', async () => {
      prismaMock.wiseTransfer.findMany.mockResolvedValue([
        {
          id: 'wt-1',
          wiseTransferId: '4567890',
          currentState: 'processing',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      ] as never);
      requestMock.mockResolvedValue({ status: 'processing' });
      prismaMock.wiseWebhookEvent.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.reconcile();

      expect(result.transfersChecked).toBe(1);
      expect(result.transfersFailed).toBe(0);
      expect(reduceTransferEventMock).not.toHaveBeenCalled();
    });

    it('only polls transfers older than 30 minutes, in a non-terminal state', async () => {
      await service.reconcile();

      expect(prismaMock.wiseTransfer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currentState: expect.objectContaining({ notIn: expect.any(Array) }),
            createdAt: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        })
      );
    });
  });
});
