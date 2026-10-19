import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  DELETION_BATCH_SIZE,
  DELETION_CLAIM_STALE_MS,
  DELETION_GRACE_PERIOD_MS,
  DELETION_STATUS,
} from './account-deletion.constants';
import { BillingCanceller } from './billing-canceller';
import { revokeAllUserAccess } from './revoke-user-access';

export interface DeletionRunSummary {
  /** Requests found whose grace period was over. */
  due: number;
  completed: number;
  /** Cancelled, or taken by another run, between the search and the claim. */
  skipped: number;
  /** Left for the next run (billing could not be cancelled, or the database failed). */
  failed: number;
}

/**
 * The 24 h half of account deletion (F21, Option B: soft delete with an admin audit trail).
 *
 * UsersService.confirmDeletion already locked the account (isActive = false) and signed the user
 * out everywhere. Once the grace period is over, this finishes the job for each CONFIRMED request:
 *
 *   1. claim it (CONFIRMED -> PROCESSING, conditional): from here a cancel is refused, so the
 *      irreversible step below cannot be undone by a late click;
 *   2. stop every recurring charge (BillingCanceller; throws if it cannot be sure);
 *   3. in ONE transaction: delete the live artifacts (drawing alerts, alerts, drawings,
 *      notifications), sign the user out again, set User.deletedAt, mark the request COMPLETED.
 *
 * What stays, on purpose, for the admin and for accounting: the User row (isActive = false,
 * deletedAt set), Account, Payment, Commission, Subscription, login history, security alerts.
 *
 * Every step is safe to run again, so a crash anywhere leaves the request for a later run: step 1
 * takes over a PROCESSING claim older than DELETION_CLAIM_STALE_MS, step 2 is idempotent by
 * contract, and step 3 is all-or-nothing. A failure of one request never stops the others.
 *
 * Logs carry ids and counts only: no address, no token, no name.
 *
 * @module account-deletion/account-deletion.worker
 */
@Injectable()
export class AccountDeletionWorker {
  private readonly logger = new Logger(AccountDeletionWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingCanceller
  ) {}

  async processDueRequests(
    now: Date = new Date(),
    batchSize: number = DELETION_BATCH_SIZE
  ): Promise<DeletionRunSummary> {
    const graceCutoff = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS);
    const staleCutoff = new Date(now.getTime() - DELETION_CLAIM_STALE_MS);

    const due = await this.prisma.accountDeletionRequest.findMany({
      where: {
        OR: [
          {
            status: DELETION_STATUS.CONFIRMED,
            confirmedAt: { lte: graceCutoff },
          },
          // A run that crashed after claiming: take the request over once the claim is stale.
          {
            status: DELETION_STATUS.PROCESSING,
            updatedAt: { lte: staleCutoff },
          },
        ],
      },
      orderBy: { confirmedAt: 'asc' },
      take: batchSize,
      select: { id: true, userId: true },
    });

    const summary: DeletionRunSummary = {
      due: due.length,
      completed: 0,
      skipped: 0,
      failed: 0,
    };

    for (const request of due) {
      try {
        const outcome = await this.processOne(
          request,
          now,
          graceCutoff,
          staleCutoff
        );
        summary[outcome] += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.error(
          'Account deletion failed, will retry on a later run',
          {
            requestId: request.id,
            userId: request.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }
    }

    if (due.length > 0) {
      this.logger.log('Account deletion run finished', { ...summary });
    }
    return summary;
  }

  private async processOne(
    request: { id: string; userId: string },
    now: Date,
    graceCutoff: Date,
    staleCutoff: Date
  ): Promise<'completed' | 'skipped'> {
    // 1. Claim. Conditional on the same test the search used, so a cancel that won in the
    //    meantime (count 0) or another worker that claimed first leaves this one with nothing
    //    to do. Nothing irreversible has happened yet.
    const claim = await this.prisma.accountDeletionRequest.updateMany({
      where: {
        id: request.id,
        OR: [
          {
            status: DELETION_STATUS.CONFIRMED,
            confirmedAt: { lte: graceCutoff },
          },
          {
            status: DELETION_STATUS.PROCESSING,
            updatedAt: { lte: staleCutoff },
          },
        ],
      },
      data: { status: DELETION_STATUS.PROCESSING },
    });
    if (claim.count === 0) return 'skipped';

    // 2. Billing, outside the transaction: it is an external call that cannot be rolled back.
    //    If it throws the request goes back to CONFIRMED so the next run does not wait out
    //    the stale-claim window; nothing else has changed.
    let stripeSubscriptionsCanceled: number;
    try {
      ({ stripeSubscriptionsCanceled } = await this.billing.cancelForUser(
        request.userId
      ));
    } catch (error) {
      await this.prisma.accountDeletionRequest
        .updateMany({
          where: { id: request.id, status: DELETION_STATUS.PROCESSING },
          data: { status: DELETION_STATUS.CONFIRMED },
        })
        .catch(() => undefined); // the stale-claim takeover covers a failed release
      throw error;
    }

    // 3. Everything else, or nothing.
    const removed = await this.prisma.$transaction(async (tx) => {
      const complete = await tx.accountDeletionRequest.updateMany({
        where: { id: request.id, status: DELETION_STATUS.PROCESSING },
        data: { status: DELETION_STATUS.COMPLETED, completedAt: now },
      });
      if (complete.count === 0) return null; // released or taken over meanwhile

      const userId = request.userId;
      // DrawingAlert cascades from both Alert and Drawing in the database; deleting it
      // first and by name keeps the counts below honest and the intent explicit.
      const drawingAlerts = await tx.drawingAlert.deleteMany({
        where: { OR: [{ alert: { userId } }, { drawing: { userId } }] },
      });
      const alerts = await tx.alert.deleteMany({ where: { userId } });
      const drawings = await tx.drawing.deleteMany({ where: { userId } });
      const notifications = await tx.notification.deleteMany({
        where: { userId },
      });
      // Confirm already did this; repeating it covers anything issued since (idempotent).
      await revokeAllUserAccess(tx, userId);
      // Soft delete: the row stays for the admin, locked and stamped. updateMany so a
      // user that is already gone does not fail the whole transaction.
      await tx.user.updateMany({
        where: { id: userId },
        data: { isActive: false, deletedAt: now },
      });

      return {
        drawingAlerts: drawingAlerts.count,
        alerts: alerts.count,
        drawings: drawings.count,
        notifications: notifications.count,
      };
    });
    if (removed === null) return 'skipped';

    this.logger.log('Account deletion completed', {
      requestId: request.id,
      userId: request.userId,
      stripeSubscriptionsCanceled,
      ...removed,
    });
    return 'completed';
  }
}
