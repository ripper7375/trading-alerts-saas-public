/**
 * Wise Event Handlers Tests (Session 4A-W5, extends File 5/8's own "Unit
 * tests asserting zero side effects on commission or balance fields"
 * verification promise — see wise-webhook.processor.spec.ts's header for
 * why this exists as its own file).
 */
import { Test } from '@nestjs/testing';
import type { WiseWebhookEvent } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseEventHandlers } from '../services/wise-event-handlers';
import type { WiseWebhookEnvelope } from '../wise.types';

describe('WiseEventHandlers', () => {
  let handlers: WiseEventHandlers;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseEventHandlers,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    handlers = moduleRef.get(WiseEventHandlers);
    prismaMock.wiseWebhookEvent.update.mockResolvedValue({} as never);
  });

  describe('handlePayoutFailure', () => {
    function payoutFailureEvent(): WiseWebhookEvent {
      const envelope: WiseWebhookEnvelope = {
        event_type: 'transfers#payout-failure',
        schema_version: '4.0.0',
        data: {
          transfer_id: 555,
          failure_reason_code: 'WRONG_ID_NUMBER',
          failure_description: "Invalid recipient's ID document number",
          occurred_at: '2026-07-26T10:00:00.000Z',
        },
      };
      return { id: 'evt-1', payload: envelope } as unknown as WiseWebhookEvent;
    }

    it('writes failure fields and flags hasActiveIssues, never touching Commission or balance', async () => {
      prismaMock.wiseTransfer.findUnique.mockResolvedValue({
        id: 'wt-1',
        wiseTransferId: '555',
      } as never);
      prismaMock.wiseTransfer.update.mockResolvedValue({} as never);

      await handlers.handlePayoutFailure(payoutFailureEvent());

      expect(prismaMock.wiseTransfer.update).toHaveBeenCalledWith({
        where: { id: 'wt-1' },
        data: {
          payoutFailureCode: 'WRONG_ID_NUMBER',
          payoutFailureDescription: "Invalid recipient's ID document number",
          hasActiveIssues: true,
        },
      });
      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
    });

    it('skips without throwing when the transfer is unknown', async () => {
      prismaMock.wiseTransfer.findUnique.mockResolvedValue(null);

      await expect(
        handlers.handlePayoutFailure(payoutFailureEvent())
      ).resolves.not.toThrow();
      expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: {
          processed: true,
          processedAt: expect.any(Date),
          skippedReason: 'transfer-not-found',
        },
      });
    });
  });

  describe('handleBalanceUpdate', () => {
    function balanceUpdateEvent(): WiseWebhookEvent {
      const envelope: WiseWebhookEnvelope = {
        event_type: 'balances#update',
        schema_version: '4.0.0',
        data: { amount: { value: 500, currency: 'USD' } },
      };
      return { id: 'evt-2', payload: envelope } as unknown as WiseWebhookEvent;
    }

    it('sets fundingSource=MANUAL_DETECTED on exactly one amount-matched AWAITING_MANUAL_FUNDING batch group, never touching status', async () => {
      prismaMock.wiseBatchGroup.findMany.mockResolvedValue([
        { id: 'bg-1' } as never,
      ]);
      prismaMock.wiseBatchGroup.update.mockResolvedValue({} as never);

      await handlers.handleBalanceUpdate(balanceUpdateEvent());

      expect(prismaMock.wiseBatchGroup.findMany).toHaveBeenCalledWith({
        where: {
          status: 'AWAITING_MANUAL_FUNDING',
          sourceCurrency: 'USD',
          totalSourceAmount: 500,
        },
      });
      expect(prismaMock.wiseBatchGroup.update).toHaveBeenCalledWith({
        where: { id: 'bg-1' },
        data: { fundingSource: 'MANUAL_DETECTED' },
      });
    });

    it('skips a best-effort match with zero candidates without throwing', async () => {
      prismaMock.wiseBatchGroup.findMany.mockResolvedValue([]);

      await expect(
        handlers.handleBalanceUpdate(balanceUpdateEvent())
      ).resolves.not.toThrow();
      expect(prismaMock.wiseBatchGroup.update).not.toHaveBeenCalled();
      expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'evt-2' },
        data: {
          processed: true,
          processedAt: expect.any(Date),
          skippedReason: 'ambiguous-funding-match',
        },
      });
    });

    it('skips an ambiguous match with multiple candidates without throwing', async () => {
      prismaMock.wiseBatchGroup.findMany.mockResolvedValue([
        { id: 'bg-1' } as never,
        { id: 'bg-2' } as never,
      ]);

      await handlers.handleBalanceUpdate(balanceUpdateEvent());

      expect(prismaMock.wiseBatchGroup.update).not.toHaveBeenCalled();
    });
  });
});
