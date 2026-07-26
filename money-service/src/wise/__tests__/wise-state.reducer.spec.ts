/**
 * Wise State Mapper & Transfer State Reducer Tests (Session 4A-W5, File 7/8)
 *
 * `WiseStateMapper` coverage enumerates the FULL design §5.2 table (10
 * named states + the unrecognised-fallback), not just the 7 this order's
 * own File 1/8 prose originally listed — see this order's Deviations for
 * why the real table governs. `WiseTransferStateReducer` coverage proves
 * the at-most-once guards (§5.3) and the staleness guard (§5.4) against a
 * mocked `PrismaService`, mirroring `dlocal-webhook.controller.spec.ts`'s
 * `$transaction` mock pattern.
 */
import { Test } from '@nestjs/testing';
import type { WiseWebhookEvent } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseStateMapper } from '../services/wise-state.mapper';
import { WiseTransferStateReducer } from '../services/wise-transfer-state.reducer';
import type { WiseWebhookEnvelope } from '../wise.types';

describe('WiseStateMapper', () => {
  const mapper = new WiseStateMapper();

  it.each([
    ['incoming_payment_waiting', 'PENDING', 'NONE', false, false],
    ['incoming_payment_initiated', 'PROCESSING', 'NONE', false, false],
    ['processing', 'PROCESSING', 'NONE', false, false],
    ['funds_converted', 'PROCESSING', 'NONE', false, false],
    ['outgoing_payment_sent', 'COMPLETED', 'MARK_PAID', false, false],
    ['bounced_back', 'PROCESSING', 'NONE', true, true],
    ['funds_refunded', 'FAILED', 'REVERT_IF_PAID', false, false],
    ['charged_back', 'FAILED', 'REVERT_IF_PAID', false, false],
    ['cancelled', 'CANCELLED', 'REVERT_IF_PAID', false, false],
    ['unknown', 'PROCESSING', 'NONE', false, true],
  ] as const)(
    'maps %s -> disbursementStatus=%s, action=%s',
    (state, disbursementStatus, action, setHasActiveIssues, alert) => {
      const result = mapper.mapTransferState(state);
      expect(result.disbursementStatus).toBe(disbursementStatus);
      expect(result.commissionAction).toBe(action);
      expect(result.setHasActiveIssues).toBe(setHasActiveIssues);
      expect(result.alert).toBe(alert);
      expect(result.skippedReason).toBeUndefined();
    }
  );

  it('never throws on an unrecognised state and signals unknown-state', () => {
    expect(() =>
      mapper.mapTransferState('some-future-wise-state')
    ).not.toThrow();
    const result = mapper.mapTransferState('some-future-wise-state');
    expect(result.disbursementStatus).toBeNull();
    expect(result.commissionAction).toBe('NONE');
    expect(result.alert).toBe(true);
    expect(result.skippedReason).toBe('unknown-state');
  });
});

describe('WiseTransferStateReducer', () => {
  let reducer: WiseTransferStateReducer;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const wiseTransfer = {
    id: 'wt-1',
    disbursementTransactionId: 'dt-1',
    wiseTransferId: '555',
    currentState: 'processing',
    previousState: null as string | null,
    lastEventOccurredAt: null as Date | null,
    balanceAppliedAt: null as Date | null,
    balanceRevertedAt: null as Date | null,
    hasActiveIssues: false,
  };

  const disbursementTransaction = {
    id: 'dt-1',
    commissionId: 'comm-1',
  };

  const commission = {
    id: 'comm-1',
    affiliateProfileId: 'aff-1',
    commissionAmount: 100,
  };

  function stateChangeEvent(
    currentState: string,
    occurredAt: string,
    previousState: string | null = null
  ): WiseWebhookEvent {
    const envelope: WiseWebhookEnvelope = {
      event_type: 'transfers#state-change',
      schema_version: '4.0.0',
      data: {
        resource: { type: 'transfer', id: 555 },
        current_state: currentState,
        previous_state: previousState,
        occurred_at: occurredAt,
      },
    };
    return {
      id: 'evt-1',
      payload: envelope,
    } as unknown as WiseWebhookEvent;
  }

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseTransferStateReducer,
        WiseStateMapper,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    reducer = moduleRef.get(WiseTransferStateReducer);

    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(wiseTransfer as never);
    prismaMock.wiseTransfer.update.mockResolvedValue(wiseTransfer as never);
    prismaMock.wiseTransfer.findUniqueOrThrow.mockResolvedValue(
      wiseTransfer as never
    );
    prismaMock.disbursementTransaction.update.mockResolvedValue(
      disbursementTransaction as never
    );
    prismaMock.disbursementTransaction.findUniqueOrThrow.mockResolvedValue(
      disbursementTransaction as never
    );
    prismaMock.commission.update.mockResolvedValue(commission as never);
    prismaMock.affiliateProfile.update.mockResolvedValue({} as never);
    prismaMock.wiseWebhookEvent.update.mockResolvedValue({} as never);
  });

  it('outgoing_payment_sent stamps balanceAppliedAt, sets Commission PAID, and moves the balance', async () => {
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 1 });

    await reducer.reduceTransferEvent(
      stateChangeEvent('outgoing_payment_sent', '2026-07-26T10:00:00.000Z')
    );

    expect(prismaMock.wiseTransfer.updateMany).toHaveBeenCalledWith({
      where: { id: 'wt-1', balanceAppliedAt: null },
      data: { balanceAppliedAt: expect.any(Date) },
    });
    expect(prismaMock.commission.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    });
    expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
      where: { id: 'aff-1' },
      data: {
        pendingCommissions: { decrement: 100 },
        paidCommissions: { increment: 100 },
      },
    });
    expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { processed: true, processedAt: expect.any(Date) },
    });
  });

  it('duplicate outgoing_payment_sent hits the atomic lock and makes zero additional balance changes', async () => {
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 0 });

    await reducer.reduceTransferEvent(
      stateChangeEvent('outgoing_payment_sent', '2026-07-26T10:00:00.000Z')
    );

    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
  });

  it('an out-of-order event (occurred_at <= lastEventOccurredAt) is skipped with stale-order', async () => {
    prismaMock.wiseTransfer.findUnique.mockResolvedValue({
      ...wiseTransfer,
      lastEventOccurredAt: new Date('2026-07-26T12:00:00.000Z'),
    } as never);

    await reducer.reduceTransferEvent(
      stateChangeEvent('processing', '2026-07-26T10:00:00.000Z')
    );

    expect(prismaMock.wiseTransfer.update).not.toHaveBeenCalled();
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        processed: true,
        processedAt: expect.any(Date),
        skippedReason: 'stale-order',
      },
    });
  });

  it('funds_refunded reverts a paid commission to APPROVED (not FAILED — not a valid CommissionStatus) and restores the balance, exactly once', async () => {
    prismaMock.wiseTransfer.findUnique.mockResolvedValue({
      ...wiseTransfer,
      balanceAppliedAt: new Date('2026-07-26T09:00:00.000Z'),
    } as never);
    prismaMock.wiseTransfer.findUniqueOrThrow.mockResolvedValue({
      ...wiseTransfer,
      balanceAppliedAt: new Date('2026-07-26T09:00:00.000Z'),
    } as never);
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 1 });

    await reducer.reduceTransferEvent(
      stateChangeEvent('funds_refunded', '2026-07-26T11:00:00.000Z')
    );

    expect(prismaMock.wiseTransfer.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wt-1',
        balanceAppliedAt: { not: null },
        balanceRevertedAt: null,
      },
      data: { balanceRevertedAt: expect.any(Date) },
    });
    expect(prismaMock.commission.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: { status: 'APPROVED', paidAt: null },
    });
    expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
      where: { id: 'aff-1' },
      data: {
        pendingCommissions: { increment: 100 },
        paidCommissions: { decrement: 100 },
      },
    });

    // Replay: guard now reports 0 (already reverted) — no further mutation.
    prismaMock.commission.update.mockClear();
    prismaMock.affiliateProfile.update.mockClear();
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 0 });

    await reducer.reduceTransferEvent(
      stateChangeEvent('funds_refunded', '2026-07-26T11:00:01.000Z')
    );
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
  });

  it('cancelled on a transfer that was never paid does not touch Commission or the balance', async () => {
    // balanceAppliedAt is null on the fixture, so the reversal guard's
    // `balanceAppliedAt: { not: null }` clause can never match.
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 0 });

    await reducer.reduceTransferEvent(
      stateChangeEvent('cancelled', '2026-07-26T10:00:00.000Z')
    );

    expect(prismaMock.disbursementTransaction.update).toHaveBeenCalledWith({
      where: { id: 'dt-1' },
      data: { status: 'CANCELLED', failedAt: expect.any(Date) },
    });
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
  });

  it('charged_back reverts a paid commission even though it can follow any prior state', async () => {
    prismaMock.wiseTransfer.findUnique.mockResolvedValue({
      ...wiseTransfer,
      currentState: 'outgoing_payment_sent',
      balanceAppliedAt: new Date('2026-07-26T09:00:00.000Z'),
    } as never);
    prismaMock.wiseTransfer.findUniqueOrThrow.mockResolvedValue({
      ...wiseTransfer,
      balanceAppliedAt: new Date('2026-07-26T09:00:00.000Z'),
    } as never);
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 1 });

    await reducer.reduceTransferEvent(
      stateChangeEvent('charged_back', '2026-07-26T15:00:00.000Z')
    );

    expect(prismaMock.commission.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: { status: 'APPROVED', paidAt: null },
    });
  });

  it('bounced_back flags hasActiveIssues and leaves Commission untouched (Wise may still deliver)', async () => {
    await reducer.reduceTransferEvent(
      stateChangeEvent('bounced_back', '2026-07-26T10:00:00.000Z')
    );

    expect(prismaMock.wiseTransfer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasActiveIssues: true }),
      })
    );
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
  });

  it('a malformed payload (missing resource/current_state/occurred_at) is skipped without throwing', async () => {
    const malformed = {
      id: 'evt-2',
      payload: { event_type: 'transfers#state-change', data: {} },
    } as unknown as WiseWebhookEvent;

    await expect(reducer.reduceTransferEvent(malformed)).resolves.not.toThrow();
    expect(prismaMock.wiseWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-2' },
      data: {
        processed: true,
        processedAt: expect.any(Date),
        skippedReason: 'malformed-payload',
      },
    });
  });

  it('an event for a transfer we have no record of is skipped without throwing', async () => {
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(null);

    await reducer.reduceTransferEvent(
      stateChangeEvent('processing', '2026-07-26T10:00:00.000Z')
    );

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
