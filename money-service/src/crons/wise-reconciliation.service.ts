/**
 * Wise Reconciliation Service (Session 4A-W6, File 7/8)
 *
 * Hourly reconciliation per design §6.5 — webhook delivery is explicitly
 * best-effort, so a money system cannot rely on it alone:
 *  1. Polls every non-terminal `WiseTransfer` older than 30 minutes and
 *     feeds Wise's current state through the SAME reducer 4A-W5 built
 *     (`WiseTransferStateReducer`), as a synthetic event whose
 *     `deliveryId = "recon:<transferId>:<state>:<isoHour>"` dedupes
 *     naturally via `WiseWebhookEvent.deliveryId`'s own `@unique` — same
 *     reducer, same at-most-once guards, so reconciliation can never
 *     double-apply a balance (design's own words).
 *  2. **REQUIRED Funding-SLA Alarm**: any `WiseBatchGroup` still
 *     `AWAITING_MANUAL_FUNDING` past `WISE_FUNDING_SLA_HOURS` (default 72h
 *     — this order's own text said 24h, corrected against design §6.2/§7.2
 *     and the frozen OpenAPI, `LESSONS-LEARNED.md` L27) is the human gate's
 *     dead-man switch. F43 (decided this session, Davin): alerts via Resend
 *     REST called directly (no new dependency), not the `resend` npm
 *     package operation-service uses.
 *
 * TARGET path follows this order's own File 7/8 (`money-service/src/crons/`),
 * matching this repo's existing convention that cron-triggered services live
 * under `src/crons/` (`affiliate.service.ts`, `subscription.service.ts`) —
 * design §8's module layout suggested `wise/services/`, another
 * order-vs-design location disagreement (same class as File 1/6's, see
 * their own Deviations).
 */

import { Injectable } from '@nestjs/common';
import type { WiseTransfer, WiseBatchGroup, Prisma } from '@prisma/client';

import { logger } from '../common/logger.util';
import { PrismaService } from '../prisma/prisma.service';
import { WiseTransferStateReducer } from '../wise/services/wise-transfer-state.reducer';
import { WiseApiClient } from '../wise/wise-api.client';
import { WiseConfig } from '../wise/wise.config';

/** Pragmatic terminal set for reconciliation-polling purposes (design §5.2's
 * table shows `charged_back`/`bounced_back` can technically follow ANY
 * state, so no state is perfectly "final" — but a real webhook still
 * reaches 4A-W5's receiver normally regardless of whether this cron keeps
 * polling, so re-polling forever past these four outcomes isn't necessary). */
const RECONCILIATION_TERMINAL_STATES = [
  'outgoing_payment_sent',
  'funds_refunded',
  'charged_back',
  'cancelled',
];

const NON_TERMINAL_MIN_AGE_MS = 30 * 60 * 1000;

export interface ReconciliationResult {
  transfersChecked: number;
  transfersFailed: number;
  fundingSlaBreaches: number;
}

interface WiseTransferGetResponse {
  id: number;
  status?: string;
  state?: string;
}

@Injectable()
export class WiseReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseApiClient: WiseApiClient,
    private readonly wiseConfig: WiseConfig,
    private readonly wiseTransferStateReducer: WiseTransferStateReducer
  ) {}

  async reconcile(): Promise<ReconciliationResult> {
    const transfersChecked = await this.reconcileNonTerminalTransfers();
    const fundingSlaBreaches = await this.checkFundingSla();

    return {
      transfersChecked: transfersChecked.checked,
      transfersFailed: transfersChecked.failed,
      fundingSlaBreaches,
    };
  }

  private async reconcileNonTerminalTransfers(): Promise<{
    checked: number;
    failed: number;
  }> {
    const cutoff = new Date(Date.now() - NON_TERMINAL_MIN_AGE_MS);
    const transfers = await this.prisma.wiseTransfer.findMany({
      where: {
        currentState: { notIn: RECONCILIATION_TERMINAL_STATES },
        createdAt: { lte: cutoff },
      },
    });

    let checked = 0;
    let failed = 0;
    for (const transfer of transfers) {
      try {
        await this.reconcileTransfer(transfer);
        checked++;
      } catch (error) {
        failed++;
        logger.error('Wise reconciliation failed for transfer', {
          wiseTransferId: transfer.wiseTransferId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return { checked, failed };
  }

  private async reconcileTransfer(transfer: WiseTransfer): Promise<void> {
    const response = await this.wiseApiClient.request<WiseTransferGetResponse>(
      `/v1/transfers/${transfer.wiseTransferId}`
    );
    const currentState = response.status ?? response.state ?? 'unknown';
    const occurredAt = new Date();
    const isoHour = occurredAt.toISOString().slice(0, 13);
    const deliveryId = `recon:${transfer.wiseTransferId}:${currentState}:${isoHour}`;

    let event;
    try {
      event = await this.prisma.wiseWebhookEvent.create({
        data: {
          deliveryId,
          eventType: 'transfers#state-change',
          schemaVersion: '4.0.0',
          resourceType: 'transfer',
          wiseResourceId: transfer.wiseTransferId,
          currentState,
          occurredAt,
          payload: {
            event_type: 'transfers#state-change',
            data: {
              resource: {
                type: 'transfer',
                id: Number(transfer.wiseTransferId),
              },
              current_state: currentState,
              occurred_at: occurredAt.toISOString(),
            },
          } as unknown as Prisma.InputJsonValue,
          // Synthetic, internally-sourced event, not a real webhook
          // delivery -- there is no signature to verify.
          signatureVerified: true,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        // Already reconciled this transfer/state within this hour --
        // deliveryId's own dedupe made this a no-op, same as a real
        // duplicate webhook delivery.
        return;
      }
      throw error;
    }

    await this.wiseTransferStateReducer.reduceTransferEvent(event);
  }

  private async checkFundingSla(): Promise<number> {
    const slaHours = this.wiseConfig.fundingSlaHours;
    const cutoff = new Date(Date.now() - slaHours * 60 * 60 * 1000);

    const breached = await this.prisma.wiseBatchGroup.findMany({
      where: {
        status: 'AWAITING_MANUAL_FUNDING',
        completedAt: { lte: cutoff },
      },
    });

    if (breached.length === 0) {
      return 0;
    }

    logger.error(
      'Funding-SLA breach: Wise batch group(s) awaiting manual funding past the SLA',
      { count: breached.length, slaHours }
    );
    await this.sendFundingSlaAlert(breached, slaHours);

    return breached.length;
  }

  /** F43 (Davin, decided this session): Resend REST called directly, no new
   * npm dependency. Fails closed -- a missing/broken alert channel must
   * never crash the reconciliation cron itself. */
  private async sendFundingSlaAlert(
    breachedBatches: WiseBatchGroup[],
    slaHours: number
  ): Promise<void> {
    const apiKey = process.env['RESEND_API_KEY'];
    const to = process.env['WISE_FUNDING_ALERT_EMAIL'];

    if (!apiKey || !to) {
      logger.error(
        'Funding-SLA alert could NOT be sent: RESEND_API_KEY / WISE_FUNDING_ALERT_EMAIL not configured on money-service',
        { breachedCount: breachedBatches.length }
      );
      return;
    }

    const rows = breachedBatches
      .map(
        (b) =>
          `<li>${b.wiseBatchGroupId} — ${String(b.totalSourceAmount)} ${b.sourceCurrency}, awaiting funding since ${b.completedAt?.toISOString() ?? 'unknown'}</li>`
      )
      .join('');
    const html = `<p><strong>${breachedBatches.length}</strong> Wise payout batch(es) have been awaiting manual funding for more than ${slaHours}h:</p><ul>${rows}</ul><p>Fund them in the Wise app, then confirm via <code>POST /v1/wise/batches/{id}/mark-funded</code>.</p>`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:
            process.env['RESEND_FROM_EMAIL'] ||
            'Trading Alerts <onboarding@resend.dev>',
          to,
          subject: `[URGENT] ${breachedBatches.length} Wise payout batch(es) awaiting funding past the ${slaHours}h SLA`,
          html,
        }),
      });
      if (!response.ok) {
        logger.error('Funding-SLA alert email failed to send', {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error('Funding-SLA alert email threw', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
