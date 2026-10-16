/**
 * Processed Webhook Event claims (Remediation Tier 2 §6.1)
 *
 * Stripe delivers at least once, and since Session 4A-13 the same event can
 * reach both the monolith (`/api/webhooks/stripe`) and money-service
 * (`/v1/webhooks/stripe`). A handler that is not itself idempotent (an outbox
 * event that becomes an email, a counter increment) would run twice.
 *
 * Protocol, per (provider, eventId):
 *   claim()    insert the row before the handler runs.
 *              'claimed'     we own the event: run the handler.
 *              'duplicate'   someone else finished it, or is running it now: skip.
 *              'unavailable' the table cannot be used (not migrated yet, a missing
 *                            grant, a database blip): run the handler anyway. The
 *                            commission uniqueness indexes are the money guard;
 *                            failing closed here would stop every billing webhook.
 *   complete() the handler succeeded: stamp `completedAt`.
 *   release()  the handler failed: delete the unfinished claim so the retry runs.
 *
 * A claim that never completes (the process died mid-handler) is taken over
 * once it is older than the lease, so a crash cannot swallow an event for good.
 *
 * The schema lives in prisma/non-market-data/schema.prisma; the monolith has
 * the same protocol in lib/webhooks/processed-event.ts.
 */

import { Injectable } from '@nestjs/common';

import { logger } from '../common/logger.util';
import { PrismaService } from '../prisma/prisma.service';

export type ClaimResult = 'claimed' | 'duplicate' | 'unavailable';

/** An unfinished claim older than this belongs to a handler that crashed. */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;

@Injectable()
export class ProcessedWebhookEventService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(provider: string, eventId: string): Promise<ClaimResult> {
    try {
      // INSERT ... ON CONFLICT DO NOTHING: atomic, and a duplicate is a count of
      // 0 instead of a unique-violation error (which Prisma would also print to
      // stderr as an error for every redelivered webhook).
      // createdAt is written here, from the same clock as the lease cutoff below,
      // rather than left to the column default (the database session's time zone).
      const inserted = await this.prisma.processedWebhookEvent.createMany({
        data: [{ provider, eventId, createdAt: new Date() }],
        skipDuplicates: true,
      });
      if (inserted.count === 1) return 'claimed';
    } catch (error) {
      logger.error(
        '[Webhook] Event claim unavailable; processing without deduplication',
        { provider, eventId, error: describe(error) }
      );
      return 'unavailable';
    }

    // The row exists. Take it over only if its owner never finished and is
    // long gone; the conditional update lets exactly one retry win.
    try {
      const takenOver = await this.prisma.processedWebhookEvent.updateMany({
        where: {
          provider,
          eventId,
          completedAt: null,
          createdAt: { lt: new Date(Date.now() - CLAIM_LEASE_MS) },
        },
        data: { createdAt: new Date() },
      });
      return takenOver.count === 1 ? 'claimed' : 'duplicate';
    } catch (error) {
      logger.error(
        '[Webhook] Event claim unavailable; processing without deduplication',
        { provider, eventId, error: describe(error) }
      );
      return 'unavailable';
    }
  }

  /** Marks the event handled. Best effort: a failure only means a later duplicate waits for the lease. */
  async complete(provider: string, eventId: string): Promise<void> {
    try {
      await this.prisma.processedWebhookEvent.updateMany({
        where: { provider, eventId },
        data: { completedAt: new Date() },
      });
    } catch (error) {
      logger.error('[Webhook] Could not mark event completed', {
        provider,
        eventId,
        error: describe(error),
      });
    }
  }

  /** Drops an unfinished claim so a retry of a failed event is processed. Best effort. */
  async release(provider: string, eventId: string): Promise<void> {
    try {
      await this.prisma.processedWebhookEvent.deleteMany({
        where: { provider, eventId, completedAt: null },
      });
    } catch (error) {
      logger.error('[Webhook] Could not release event claim', {
        provider,
        eventId,
        error: describe(error),
      });
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
