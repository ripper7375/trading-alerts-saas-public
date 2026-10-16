/**
 * Processed webhook event claims (Remediation Tier 2 §6.1), monolith side.
 *
 * Stripe delivers at least once, and since Session 4A-13 the same event can
 * reach both this app (`/api/webhooks/stripe`) and money-service
 * (`/v1/webhooks/stripe`). Both use the same `ProcessedWebhookEvent` table, so
 * whichever endpoint claims an event first runs its handler and the other skips.
 *
 * Same protocol as money-service/src/webhooks/processed-webhook-event.service.ts:
 *   claimEvent()      'claimed' run the handler | 'duplicate' skip |
 *                     'unavailable' the table cannot be used (not migrated yet, a
 *                     missing grant, a database blip): run the handler anyway. The
 *                     unique indexes on Commission are the money guard; failing
 *                     closed here would stop every billing webhook.
 *   completeEvent()   the handler succeeded: stamp `completedAt`.
 *   releaseEvent()    the handler failed: delete the unfinished claim so the retry runs.
 * An unfinished claim older than the lease is taken over (the handler crashed).
 */

import { prisma } from '@/lib/db/prisma';

export type ClaimResult = 'claimed' | 'duplicate' | 'unavailable';

/** An unfinished claim older than this belongs to a handler that crashed. */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function claimEvent(
  provider: string,
  eventId: string
): Promise<ClaimResult> {
  try {
    // INSERT ... ON CONFLICT DO NOTHING: atomic, and a duplicate is a count of 0
    // instead of an error that Prisma would also print for every redelivery.
    // createdAt comes from this process's clock, the same one the lease cutoff
    // below uses, not from the column default (the database's time zone).
    const inserted = await prisma.processedWebhookEvent.createMany({
      data: [{ provider, eventId, createdAt: new Date() }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return 'claimed';
  } catch (error) {
    console.error(
      '[Webhook] Event claim unavailable; processing without deduplication:',
      { provider, eventId, error: describe(error) }
    );
    return 'unavailable';
  }

  // The row exists. Take it over only if its owner never finished and is long
  // gone; the conditional update lets exactly one retry win.
  try {
    const takenOver = await prisma.processedWebhookEvent.updateMany({
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
    console.error(
      '[Webhook] Event claim unavailable; processing without deduplication:',
      { provider, eventId, error: describe(error) }
    );
    return 'unavailable';
  }
}

/** Marks the event handled. Best effort: a failure only means a later duplicate waits for the lease. */
export async function completeEvent(
  provider: string,
  eventId: string
): Promise<void> {
  try {
    await prisma.processedWebhookEvent.updateMany({
      where: { provider, eventId },
      data: { completedAt: new Date() },
    });
  } catch (error) {
    console.error('[Webhook] Could not mark event completed:', {
      provider,
      eventId,
      error: describe(error),
    });
  }
}

/** Drops an unfinished claim so a retry of a failed event is processed. Best effort. */
export async function releaseEvent(
  provider: string,
  eventId: string
): Promise<void> {
  try {
    await prisma.processedWebhookEvent.deleteMany({
      where: { provider, eventId, completedAt: null },
    });
  } catch (error) {
    console.error('[Webhook] Could not release event claim:', {
      provider,
      eventId,
      error: describe(error),
    });
  }
}
