/**
 * Wise Transfer State Reducer (Session 4A-W5, File 2/8)
 *
 * The state-machine reducer that executes atomic transfer-state transitions
 * and balance mutations, per design §5.3 (at-most-once accounting guards)
 * and §5.4 (out-of-order delivery and dedupe). This is the ONLY service in
 * the codebase authorized to set `Commission.status = 'PAID'` (Hard
 * Invariant #4 / REDUCER EXCLUSIVITY INVARIANT) — payout creation (4A-W6)
 * drafts transfers but must never touch `Commission.status` or
 * `AffiliateProfile.balance`.
 *
 * Two independent guards, per design §5.4: the CALLER (the webhook
 * controller) dedupes on `WiseWebhookEvent.deliveryId` before a job is ever
 * enqueued; THIS reducer separately guards on `WiseTransfer.balanceAppliedAt`
 * / `balanceRevertedAt` so a reconciliation-cron-synthesised event (or any
 * other path that reaches this method more than once for the same
 * transfer) still can't double-apply or double-revert a balance.
 */

import { Injectable } from '@nestjs/common';
import type { WiseWebhookEvent } from '@prisma/client';

import { logger } from '../../common/logger.util';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  WiseTransferStateChangeData,
  WiseWebhookEnvelope,
} from '../wise.types';

import { WiseStateMapper } from './wise-state.mapper';

@Injectable()
export class WiseTransferStateReducer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMapper: WiseStateMapper
  ) {}

  async reduceTransferEvent(event: WiseWebhookEvent): Promise<void> {
    const envelope = event.payload as unknown as WiseWebhookEnvelope;
    const data = envelope?.data as WiseTransferStateChangeData | undefined;

    if (!data?.resource?.id || !data.current_state || !data.occurred_at) {
      logger.error(
        'Wise transfer state-change event is missing required fields, skipping',
        { webhookEventId: event.id }
      );
      await this.markSkipped(event.id, 'malformed-payload');
      return;
    }

    const wiseTransferId = String(data.resource.id);
    const occurredAt = new Date(data.occurred_at);

    const wiseTransfer = await this.prisma.wiseTransfer.findUnique({
      where: { wiseTransferId },
    });

    if (!wiseTransfer) {
      logger.warn('Wise transfer state-change event for unknown transfer', {
        webhookEventId: event.id,
        wiseTransferId,
      });
      await this.markSkipped(event.id, 'transfer-not-found');
      return;
    }

    // Ordering guard (Hard Invariant #2 / design §5.4): events may arrive
    // out of order over the wire. `charged_back` legitimately following any
    // earlier state is still handled correctly here — it's a NEWER event,
    // not a stale one, so the guard lets it through regardless of what
    // `current_state` it carries.
    if (
      wiseTransfer.lastEventOccurredAt &&
      occurredAt.getTime() <= wiseTransfer.lastEventOccurredAt.getTime()
    ) {
      logger.warn(
        'Wise transfer state-change event is stale (occurred_at <= lastEventOccurredAt), skipping mutation',
        {
          webhookEventId: event.id,
          wiseTransferId,
          occurredAt: occurredAt.toISOString(),
          lastEventOccurredAt: wiseTransfer.lastEventOccurredAt.toISOString(),
        }
      );
      await this.markSkipped(event.id, 'stale-order');
      return;
    }

    const mapping = this.stateMapper.mapTransferState(data.current_state);

    await this.prisma.wiseTransfer.update({
      where: { id: wiseTransfer.id },
      data: {
        previousState: wiseTransfer.currentState,
        currentState: data.current_state,
        lastEventOccurredAt: occurredAt,
        ...(mapping.setHasActiveIssues ? { hasActiveIssues: true } : {}),
      },
    });

    if (mapping.disbursementStatus) {
      await this.prisma.disbursementTransaction.update({
        where: { id: wiseTransfer.disbursementTransactionId },
        data: {
          status: mapping.disbursementStatus,
          ...(mapping.disbursementStatus === 'COMPLETED'
            ? { completedAt: occurredAt }
            : {}),
          ...(mapping.disbursementStatus === 'FAILED' ||
          mapping.disbursementStatus === 'CANCELLED'
            ? { failedAt: occurredAt }
            : {}),
        },
      });
    }

    if (mapping.commissionAction === 'MARK_PAID') {
      await this.applyCommissionPaid(wiseTransfer.id, occurredAt);
    } else if (mapping.commissionAction === 'REVERT_IF_PAID') {
      await this.revertCommissionIfPaid(wiseTransfer.id);
    }

    if (mapping.alert) {
      logger.error('Wise transfer needs admin attention', {
        wiseTransferId,
        currentState: data.current_state,
      });
    }

    if (mapping.skippedReason) {
      await this.markSkipped(event.id, mapping.skippedReason);
      return;
    }

    await this.markProcessed(event.id);
  }

  /**
   * Pending → paid, exactly once. Guarded by `balanceAppliedAt IS NULL`
   * (design §5.3) so a duplicate `outgoing_payment_sent` delivery — even
   * one that reaches this method via a different `deliveryId` than the
   * first, e.g. a future reconciliation-cron replay — is a no-op past the
   * `updateMany` lock.
   */
  private async applyCommissionPaid(
    wiseTransferId: string,
    paidAt: Date
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const guard = await tx.wiseTransfer.updateMany({
        where: { id: wiseTransferId, balanceAppliedAt: null },
        data: { balanceAppliedAt: new Date() },
      });
      if (guard.count === 0) return;

      const transfer = await tx.wiseTransfer.findUniqueOrThrow({
        where: { id: wiseTransferId },
      });

      const disbursement = await tx.disbursementTransaction.update({
        where: { id: transfer.disbursementTransactionId },
        data: { status: 'COMPLETED', completedAt: paidAt },
      });

      const commission = await tx.commission.update({
        where: { id: disbursement.commissionId },
        data: { status: 'PAID', paidAt },
      });

      await tx.affiliateProfile.update({
        where: { id: commission.affiliateProfileId },
        data: {
          pendingCommissions: { decrement: commission.commissionAmount },
          paidCommissions: { increment: commission.commissionAmount },
        },
      });
    });
  }

  /**
   * Paid → pending, exactly once, and ONLY if it was actually paid. Guarded
   * by `balanceAppliedAt IS NOT NULL AND balanceRevertedAt IS NULL` — the
   * `NOT NULL` half is what makes "revert if it was PAID" (§5.2's wording
   * for `cancelled`/`charged_back`) correct: a `cancelled` event on a
   * transfer that never reached `outgoing_payment_sent` matches
   * `balanceRevertedAt: null` trivially, so without the `balanceAppliedAt`
   * check this would incorrectly move a still-PENDING/APPROVED commission
   * or double-restore a balance that was never decremented.
   *
   * Reverts to `Commission.status = 'APPROVED'` (design §5.2: "revert PAID
   * → APPROVED, clear paidAt") — NOT `'FAILED'`, which is not a valid
   * `CommissionStatus` member (see this order's Deviations).
   */
  private async revertCommissionIfPaid(wiseTransferId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const guard = await tx.wiseTransfer.updateMany({
        where: {
          id: wiseTransferId,
          balanceAppliedAt: { not: null },
          balanceRevertedAt: null,
        },
        data: { balanceRevertedAt: new Date() },
      });
      if (guard.count === 0) return;

      const transfer = await tx.wiseTransfer.findUniqueOrThrow({
        where: { id: wiseTransferId },
      });

      const disbursement = await tx.disbursementTransaction.findUniqueOrThrow({
        where: { id: transfer.disbursementTransactionId },
      });

      const commission = await tx.commission.update({
        where: { id: disbursement.commissionId },
        data: { status: 'APPROVED', paidAt: null },
      });

      await tx.affiliateProfile.update({
        where: { id: commission.affiliateProfileId },
        data: {
          pendingCommissions: { increment: commission.commissionAmount },
          paidCommissions: { decrement: commission.commissionAmount },
        },
      });
    });
  }

  private async markProcessed(webhookEventId: string): Promise<void> {
    await this.prisma.wiseWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processed: true, processedAt: new Date() },
    });
  }

  private async markSkipped(
    webhookEventId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.wiseWebhookEvent.update({
      where: { id: webhookEventId },
      data: { processed: true, processedAt: new Date(), skippedReason: reason },
    });
  }
}
