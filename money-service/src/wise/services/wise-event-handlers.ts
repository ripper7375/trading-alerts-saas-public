/**
 * Wise Auxiliary Event Handlers (Session 4A-W5, File 5/8)
 *
 * Handlers for the two webhook event types that are NOT `transfers#state-change`
 * — `transfers#payout-failure` and `balances#update`. Both are processed
 * "separately and additively" (design §5.2's own instruction for payout
 * failure): neither ever touches `Commission.status` or
 * `AffiliateProfile.balance` — that stays the reducer's exclusive job (Hard
 * Invariant #4).
 */

import { Injectable } from '@nestjs/common';
import type { WiseWebhookEvent } from '@prisma/client';

import { logger } from '../../common/logger.util';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  WiseBalanceUpdateData,
  WisePayoutFailureData,
  WiseWebhookEnvelope,
} from '../wise.types';

@Injectable()
export class WiseEventHandlers {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `transfers#payout-failure` — writes failure details and raises an
   * alert. Design §5.2: "it never changes Commission.status or the balance
   * — because a payout failure does not always change transfer state."
   */
  async handlePayoutFailure(event: WiseWebhookEvent): Promise<void> {
    const envelope = event.payload as unknown as WiseWebhookEnvelope;
    const data = envelope?.data as WisePayoutFailureData | undefined;

    if (!data?.transfer_id || !data.failure_reason_code) {
      logger.error('Wise payout-failure event is missing required fields', {
        webhookEventId: event.id,
      });
      await this.markSkipped(event.id, 'malformed-payload');
      return;
    }

    const wiseTransferId = String(data.transfer_id);
    const wiseTransfer = await this.prisma.wiseTransfer.findUnique({
      where: { wiseTransferId },
    });

    if (!wiseTransfer) {
      logger.warn('Wise payout-failure event for unknown transfer', {
        webhookEventId: event.id,
        wiseTransferId,
      });
      await this.markSkipped(event.id, 'transfer-not-found');
      return;
    }

    await this.prisma.wiseTransfer.update({
      where: { id: wiseTransfer.id },
      data: {
        payoutFailureCode: data.failure_reason_code,
        payoutFailureDescription: data.failure_description ?? null,
        hasActiveIssues: true,
      },
    });

    logger.error('Wise transfer payout failure', {
      wiseTransferId,
      failureReasonCode: data.failure_reason_code,
    });

    await this.markProcessed(event.id);
  }

  /**
   * `balances#update` — best-effort funding-detection signal only (design
   * §6.2 step 6b, F37: funding stays MANUAL). Sets `fundingSource` for
   * admin visibility; deliberately does NOT transition
   * `WiseBatchGroup.status` to `FUNDED` — that's the authoritative
   * admin-confirm path's job (`mark-funded`, 4A-W6, not yet built), and
   * flipping a funding gate from a best-effort amount match here would be
   * scope creep into that session's own work.
   */
  async handleBalanceUpdate(event: WiseWebhookEvent): Promise<void> {
    const envelope = event.payload as unknown as WiseWebhookEnvelope;
    const data = envelope?.data as WiseBalanceUpdateData | undefined;
    const amount = data?.amount;

    if (!amount || typeof amount.value !== 'number' || !amount.currency) {
      logger.warn(
        'Wise balances#update event has no usable amount, skipping best-effort funding detection',
        { webhookEventId: event.id }
      );
      await this.markSkipped(event.id, 'no-usable-amount');
      return;
    }

    const candidates = await this.prisma.wiseBatchGroup.findMany({
      where: {
        status: 'AWAITING_MANUAL_FUNDING',
        sourceCurrency: amount.currency,
        totalSourceAmount: amount.value,
      },
    });

    if (candidates.length !== 1) {
      logger.warn(
        'Wise balances#update best-effort match found zero or multiple candidate batch groups, skipping',
        {
          webhookEventId: event.id,
          matchCount: candidates.length,
          amount: amount.value,
          currency: amount.currency,
        }
      );
      await this.markSkipped(event.id, 'ambiguous-funding-match');
      return;
    }

    await this.prisma.wiseBatchGroup.update({
      where: { id: candidates[0].id },
      data: { fundingSource: 'MANUAL_DETECTED' },
    });

    await this.markProcessed(event.id);
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
