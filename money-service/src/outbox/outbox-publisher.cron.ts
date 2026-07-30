/**
 * Outbox Publisher Cron (Session 4A-8, Step 3, F14)
 *
 * Polls PENDING OutboxEvent rows every 5s and attempts delivery, with
 * exponential backoff within a single delivery attempt and dead-letter
 * (status FAILED) once a row exhausts MAX_DELIVERY_ATTEMPTS across ticks.
 *
 * GATED OFF BY DEFAULT (Davin, 4A-8 session): the real consumer -- an
 * operation-service endpoint for tier-update/billing events -- doesn't
 * exist yet. `04-rise-to-wise-migration-plan.md`'s own roadmap assigns
 * that ("Slice 5, tier-update event path") to a later, separate session
 * pair (4A-11/12), not this one. `OUTBOX_PUBLISHER_ENABLED` must be
 * explicitly `'true'` for the scheduled tick to do anything -- same
 * pattern as `CronsScheduler.isCronEnabled()`'s own CRON_ENABLED gate,
 * chosen deliberately as a SEPARATE flag (this gate exists because the
 * delivery target doesn't exist, not because of a migration-timing
 * concern like CRON_ENABLED's). `publishPendingEvents()` itself is never
 * gated -- it's what 4A-11/12 (or a manual trigger) calls directly once a
 * real target is configured; only the scheduled entry point checks the
 * flag, mirroring CronsScheduler's own split between gated `@Cron()`
 * methods and their ungated `handleX()` bodies.
 */

import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { logger } from '../common/logger.util';
import { PrismaService } from '../prisma/prisma.service';

export const OUTBOX_POLL_INTERVAL_MS = 5000;
const OUTBOX_POLL_BATCH_SIZE = 20;
const MAX_DELIVERY_ATTEMPTS = 5;
/** Backoff between retries WITHIN a single delivery attempt, not across polling ticks. */
const RETRY_BACKOFF_DELAYS_MS = [1000, 2000, 4000];

export interface PublishOutboxEventsResult {
  published: number;
  failed: number;
  deadLettered: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class OutboxPublisherCron {
  constructor(private readonly prisma: PrismaService) {}

  private isEnabled(): boolean {
    return process.env['OUTBOX_PUBLISHER_ENABLED'] === 'true';
  }

  private getTargetUrl(): string | undefined {
    return process.env['OUTBOX_PUBLISHER_TARGET_URL'];
  }

  private getSvcToken(): string | undefined {
    return process.env['SVC_TOKEN'];
  }

  /**
   * Delivers a single event via HTTP, retrying with backoff before giving
   * up on this attempt. Throws if every retry within this attempt fails --
   * the caller is responsible for persisting attemptCount/status.
   */
  private async deliver(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
  }): Promise<void> {
    const targetUrl = this.getTargetUrl();
    if (!targetUrl) {
      throw new Error('OUTBOX_PUBLISHER_TARGET_URL is not configured');
    }

    let lastError: unknown;
    for (
      let attempt = 0;
      attempt <= RETRY_BACKOFF_DELAYS_MS.length;
      attempt++
    ) {
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getSvcToken()}`,
          },
          body: JSON.stringify({
            id: event.id,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload,
          }),
        });
        if (!response.ok) {
          throw new Error(`Delivery failed with status ${response.status}`);
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_BACKOFF_DELAYS_MS.length) {
          await sleep(RETRY_BACKOFF_DELAYS_MS[attempt] as number);
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Outbox event delivery failed');
  }

  /**
   * Never gated -- callable directly (manual trigger, or the real 4A-11/12
   * consumer) once OUTBOX_PUBLISHER_TARGET_URL is actually configured.
   */
  async publishPendingEvents(): Promise<PublishOutboxEventsResult> {
    const result: PublishOutboxEventsResult = {
      published: 0,
      failed: 0,
      deadLettered: 0,
    };

    const pending = await this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: OUTBOX_POLL_BATCH_SIZE,
    });

    for (const event of pending) {
      // Atomic claim -- only proceed if still PENDING, so a concurrent
      // replica's own poll tick can't double-process the same row.
      const claim = await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });
      if (claim.count === 0) {
        continue;
      }

      try {
        await this.deliver(event);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        result.published++;
      } catch (error) {
        const attemptCount = event.attemptCount + 1;
        const deadLettered = attemptCount >= MAX_DELIVERY_ATTEMPTS;
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: deadLettered ? 'FAILED' : 'PENDING',
            attemptCount,
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        result.failed++;
        if (deadLettered) {
          result.deadLettered++;
          logger.error('[OutboxPublisher] Event dead-lettered', {
            id: event.id,
            eventType: event.eventType,
            attemptCount,
          });
        } else {
          logger.warn('[OutboxPublisher] Delivery attempt failed, will retry', {
            id: event.id,
            eventType: event.eventType,
            attemptCount,
          });
        }
      }
    }

    return result;
  }

  @Interval(OUTBOX_POLL_INTERVAL_MS)
  async scheduledPublishPendingEvents(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    await this.publishPendingEvents();
  }
}
