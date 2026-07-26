/**
 * Wise Webhook Queue Processor (Session 4A-W5, File 3/8)
 *
 * money-service's FIRST BullMQ `@Processor` (design §8.0 / 4A-W4
 * prerequisite). Consumes jobs from `money:wise-webhook`, routes by
 * `WiseWebhookEvent.eventType` to the reducer (`transfers#state-change`) or
 * the auxiliary handlers (`transfers#payout-failure`, `balances#update`),
 * and marks any other event type persisted-and-skipped per design §5.5 /
 * the OpenAPI's own description ("Unhandled types are persisted and
 * skipped, never rejected").
 *
 * `onModuleDestroy` -> `worker.close()` is 4A-W4's drain policy (L25):
 * without it, `app.enableShutdownHooks()` in `main.ts` has nothing to wait
 * on for THIS worker, and an in-flight job would be severed mid-processing
 * on a Railway redeploy instead of finishing first.
 *
 * "Dead-letter routing" (Hard Invariant #5) is `WiseWebhookEvent` itself —
 * no separate dead-letter queue/table is introduced. `attemptCount` is
 * incremented on every attempt; a row with `processed=false AND
 * attemptCount >= max attempts` after BullMQ exhausts its bounded retries
 * IS the dead-letter surface a future reconciliation cron (design §6.5,
 * 4A-W6+) queries — matching the design doc's explicit "no new
 * infrastructure and no new dependency is required."
 */

import { OnModuleDestroy } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { logger } from '../../common/logger.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WiseEventHandlers } from '../services/wise-event-handlers';
import { WiseTransferStateReducer } from '../services/wise-transfer-state.reducer';

export interface WiseWebhookJobData {
  webhookEventId: string;
}

export const WISE_WEBHOOK_QUEUE = 'money-wise-webhook';

@Processor(WISE_WEBHOOK_QUEUE)
export class WiseWebhookProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly reducer: WiseTransferStateReducer,
    private readonly eventHandlers: WiseEventHandlers
  ) {
    super();
  }

  async process(job: Job<WiseWebhookJobData>): Promise<void> {
    const { webhookEventId } = job.data;

    await this.prisma.wiseWebhookEvent.update({
      where: { id: webhookEventId },
      data: { attemptCount: { increment: 1 } },
    });

    const event = await this.prisma.wiseWebhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      // Nothing to retry against — throwing here would just retry forever
      // against a row that will never exist.
      logger.error(
        'Wise webhook job references a missing WiseWebhookEvent row',
        { webhookEventId }
      );
      return;
    }

    try {
      switch (event.eventType) {
        case 'transfers#state-change':
          await this.reducer.reduceTransferEvent(event);
          break;
        case 'transfers#payout-failure':
          await this.eventHandlers.handlePayoutFailure(event);
          break;
        case 'balances#update':
          await this.eventHandlers.handleBalanceUpdate(event);
          break;
        default:
          logger.warn('Unhandled Wise webhook event type, skipping', {
            webhookEventId,
            eventType: event.eventType,
          });
          await this.prisma.wiseWebhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processed: true,
              processedAt: new Date(),
              skippedReason: 'unhandled-event-type',
            },
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Wise webhook processing failed', {
        webhookEventId,
        attemptsMade: job.attemptsMade,
        error: message,
      });
      await this.prisma.wiseWebhookEvent.update({
        where: { id: webhookEventId },
        data: { errorMessage: message },
      });
      // Re-throw so BullMQ's own bounded retry/backoff (set at enqueue
      // time, File 4/8) decides whether to retry — never swallow here.
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }
}
