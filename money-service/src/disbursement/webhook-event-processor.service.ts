/**
 * Webhook Event Processor (Session 4A-4, File 3/4)
 *
 * Ported from lib/disbursement/webhook/event-processor.ts. Converted to a
 * real `@Injectable()` with `PrismaService` and `TransactionLoggerService`
 * constructor-injected (was a plain class taking a raw `PrismaClient`
 * positional argument, mirroring the same conversion Session 4A-2 applied
 * to the rest of the disbursement tree). Query/mutation logic
 * byte-identical. Reuses `WebhookEvent` from `./disbursement.types` (Session
 * 4A-2, File 3/6) instead of a local redeclaration — identical shape
 * (`event`/`data`/`timestamp`).
 *
 * Processes RiseWorks webhook events idempotently.
 * Handles payment completion, payment failure, and invite acceptance events.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { WebhookEvent } from './disbursement.types';
import { TransactionLoggerService } from './transaction-logger.service';

export interface ProcessingResult {
  processed: boolean;
  eventType: string;
  message: string;
}

/**
 * Webhook event processor for RiseWorks events
 */
@Injectable()
export class WebhookEventProcessorService {
  private readonly logger = new Logger(WebhookEventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionLogger: TransactionLoggerService
  ) {}

  /**
   * Process webhook events idempotently
   * Safe to call multiple times with the same event
   *
   * @param event The webhook event to process
   * @returns Processing result
   */
  async processEvent(event: WebhookEvent): Promise<ProcessingResult> {
    const eventType = event.event;

    switch (eventType) {
      case 'payment.completed':
        return this.handlePaymentCompleted(event);
      case 'payment.failed':
        return this.handlePaymentFailed(event);
      case 'invite.accepted':
        return this.handleInviteAccepted(event);
      default:
        this.logger.log(`Unhandled webhook event: ${eventType}`);
        return {
          processed: false,
          eventType,
          message: `Unhandled event type: ${eventType}`,
        };
    }
  }

  /**
   * Handle payment.completed webhook event
   * Idempotent: Only updates if transaction is not already completed
   */
  private async handlePaymentCompleted(
    event: WebhookEvent
  ): Promise<ProcessingResult> {
    const providerTxId = event.data['providerTxId'] as string | undefined;
    const amount = event.data['amount'] as number | undefined;

    if (!providerTxId) {
      this.logger.error('Payment completed webhook missing providerTxId');
      return {
        processed: false,
        eventType: event.event,
        message: 'Missing providerTxId in webhook payload',
      };
    }

    // Find transaction by provider transaction ID
    const transaction = await this.prisma.disbursementTransaction.findFirst({
      where: { providerTxId },
      select: {
        id: true,
        transactionId: true,
        commissionId: true,
        status: true,
      },
    });

    if (!transaction) {
      this.logger.error(
        `Transaction not found for providerTxId: ${providerTxId}`
      );
      return {
        processed: false,
        eventType: event.event,
        message: `Transaction not found for providerTxId: ${providerTxId}`,
      };
    }

    // Idempotent: Only update if not already completed
    if (transaction.status === 'COMPLETED') {
      this.logger.log(
        `Transaction ${transaction.transactionId} already completed`
      );
      return {
        processed: true,
        eventType: event.event,
        message: 'Transaction already completed (idempotent)',
      };
    }

    // Atomically: complete transaction, mark commission PAID, and move the
    // affiliate's balance from pending to paid so dashboards stay accurate.
    await this.prisma.$transaction(async (tx) => {
      await tx.disbursementTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const commission = await tx.commission.update({
        where: { id: transaction.commissionId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
        select: {
          affiliateProfileId: true,
          commissionAmount: true,
        },
      });

      // Move balance: pendingCommissions -> paidCommissions
      await tx.affiliateProfile.update({
        where: { id: commission.affiliateProfileId },
        data: {
          pendingCommissions: { decrement: commission.commissionAmount },
          paidCommissions: { increment: commission.commissionAmount },
        },
      });
    });

    await this.transactionLogger.logPaymentCompleted(
      transaction.transactionId,
      amount || 0
    );

    return {
      processed: true,
      eventType: event.event,
      message: `Payment completed for transaction ${transaction.transactionId}`,
    };
  }

  /**
   * Handle payment.failed webhook event
   * Idempotent: Only updates if transaction is not already failed
   */
  private async handlePaymentFailed(
    event: WebhookEvent
  ): Promise<ProcessingResult> {
    const providerTxId = event.data['providerTxId'] as string | undefined;
    const error = event.data['error'] as string | undefined;

    if (!providerTxId) {
      this.logger.error('Payment failed webhook missing providerTxId');
      return {
        processed: false,
        eventType: event.event,
        message: 'Missing providerTxId in webhook payload',
      };
    }

    const transaction = await this.prisma.disbursementTransaction.findFirst({
      where: { providerTxId },
      select: {
        id: true,
        transactionId: true,
        status: true,
      },
    });

    if (!transaction) {
      return {
        processed: false,
        eventType: event.event,
        message: `Transaction not found for providerTxId: ${providerTxId}`,
      };
    }

    // Idempotent: Only update if not already failed
    if (transaction.status === 'FAILED') {
      this.logger.log(
        `Transaction ${transaction.transactionId} already marked failed`
      );
      return {
        processed: true,
        eventType: event.event,
        message: 'Transaction already failed (idempotent)',
      };
    }

    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED',
        errorMessage: error || 'Payment failed',
        failedAt: new Date(),
      },
    });

    await this.transactionLogger.logPaymentFailed(
      transaction.transactionId,
      error || 'Unknown error'
    );

    return {
      processed: true,
      eventType: event.event,
      message: `Payment failed for transaction ${transaction.transactionId}`,
    };
  }

  /**
   * Handle invite.accepted webhook event
   * Idempotent: Only updates if not already accepted
   */
  private async handleInviteAccepted(
    event: WebhookEvent
  ): Promise<ProcessingResult> {
    const riseId = event.data['riseId'] as string | undefined;
    const email = event.data['email'] as string | undefined;

    if (!email) {
      this.logger.error('Invite accepted webhook missing email');
      return {
        processed: false,
        eventType: event.event,
        message: 'Missing email in webhook payload',
      };
    }

    // Idempotent: Update only if not already accepted
    const result = await this.prisma.affiliateRiseAccount.updateMany({
      where: {
        email,
        invitationAcceptedAt: null, // Only update if not already accepted
      },
      data: {
        invitationAcceptedAt: new Date(),
        kycStatus: 'SUBMITTED',
        riseId: riseId || undefined,
      },
    });

    if (result.count > 0) {
      await this.transactionLogger.log({
        action: 'rise.invite_accepted',
        status: 'SUCCESS',
        details: { riseId, email },
      });

      return {
        processed: true,
        eventType: event.event,
        message: `Invite accepted for ${email}`,
      };
    }

    return {
      processed: true,
      eventType: event.event,
      message: 'Invite already accepted (idempotent)',
    };
  }
}
