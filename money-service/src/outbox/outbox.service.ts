/**
 * Outbox Service (Session 4A-8, Step 2, F14)
 *
 * F14 ("Tier-update: outbox vs direct call") resolves to the Transactional
 * Outbox pattern: every tier-update / billing state change money-service
 * makes writes an `OutboxEvent` row in the SAME Prisma transaction as the
 * domain-state write itself, so the two can never diverge -- a committed
 * tier change always has a corresponding event row, and a rolled-back one
 * never does. This service owns only that atomic write; `OutboxPublisherCron`
 * (Step 3) is the sole reader of the rows it produces.
 *
 * Callers pass their OWN transaction client (`tx`), not `PrismaService`
 * directly -- this only works wrapped in the same `$transaction(...)` call
 * that writes the domain state (see dlocal-webhook.controller.ts's
 * `handlePaymentCompleted` and crons/subscription.service.ts's
 * `downgradeExpiredSubscriptions`).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export interface OutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class OutboxService {
  async recordInTransaction(
    tx: Prisma.TransactionClient,
    input: OutboxEventInput
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
  }
}
