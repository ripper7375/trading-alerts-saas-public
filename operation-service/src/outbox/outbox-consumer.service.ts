/**
 * Outbox Consumer Service (Session 4A-11, File 3/5)
 *
 * The receiving end of money-service's OutboxPublisherCron (4A-8). Dispatches
 * by eventType to the ported/existing send functions, resolving the
 * recipient via `aggregateId` -> `User.id`. For every eventType, `aggregateId`
 * is the `User` who should receive the notification -- for `COMMISSION_CREDITED`
 * (F50) that is the affiliate who earned the commission, not the paying
 * subscriber; money-service's `stripe-webhook.service.ts` sets `aggregateId`
 * accordingly at emission time.
 *
 * Response-code discipline (order's own Invariants): a transient send
 * failure (Resend API error) throws so the controller 5xx's and
 * money-service's cron retries; a structurally-valid event this service
 * will never be able to act on (unknown eventType, user not found, an
 * unresolvable recipient) returns a 'skipped' status instead -- retrying
 * those would just spam the dead-letter queue with unrecoverable rows
 * forever.
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { OutboxEventDto } from './dto/outbox-event.dto';
import {
  sendAffiliateCommissionEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
} from '../email/subscription-email.util';
import { sendSubscriptionConfirmationEmail } from '../email/email.util';
import { PrismaService } from '../prisma/prisma.service';

export interface OutboxProcessResult {
  status: 'processed' | 'skipped';
  reason?: string;
}

type EmailSendResult = { success: boolean; error?: string };

const KNOWN_EVENT_TYPES = new Set([
  'TIER_UPGRADED',
  'SUBSCRIPTION_CANCELLED',
  'PAYMENT_FAILED',
  'PAYMENT_SUCCEEDED',
  'COMMISSION_CREDITED',
  'TIER_DOWNGRADED',
]);

@Injectable()
export class OutboxConsumerService {
  constructor(private readonly prisma: PrismaService) {}

  async processEvent(event: OutboxEventDto): Promise<OutboxProcessResult> {
    if (!KNOWN_EVENT_TYPES.has(event.eventType)) {
      // Forward-compatible: money-service may ship a new eventType before
      // this consumer knows about it. Never 500/retry-storm for that --
      // a future release adds the case, not a retry.
      console.warn(
        `[Outbox] Unrecognized eventType '${event.eventType}', skipping`,
        { outboxEventId: event.id }
      );
      return { status: 'skipped', reason: 'unrecognized-event-type' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: event.aggregateId },
      select: { email: true, name: true },
    });

    if (!user || !user.email) {
      console.warn('[Outbox] User not found for outbox event, skipping', {
        outboxEventId: event.id,
        aggregateId: event.aggregateId,
      });
      return { status: 'skipped', reason: 'user-not-found' };
    }

    const email = user.email;
    const name = user.name ?? 'User';
    const payload = event.payload;

    const result = await this.dispatch(event.eventType, email, name, payload);

    if (!result.success) {
      throw new InternalServerErrorException(
        result.error ?? 'Email send failed'
      );
    }

    return { status: 'processed' };
  }

  private async dispatch(
    eventType: string,
    email: string,
    name: string,
    payload: Record<string, unknown>
  ): Promise<EmailSendResult> {
    switch (eventType) {
      case 'TIER_UPGRADED': {
        // dLocal's TIER_UPGRADED payload has no billingPeriod field (it has
        // no recurring monthly/yearly concept the way Stripe does) --
        // default to 'monthly' rather than reject the event. Cosmetic only
        // (affects displayed pricing text), and this consumer carries zero
        // production traffic until 4A-12 flips OUTBOX_PUBLISHER_ENABLED.
        const billingPeriod =
          payload['billingPeriod'] === 'yearly' ? 'yearly' : 'monthly';
        return sendSubscriptionConfirmationEmail(
          email,
          name,
          'PRO',
          billingPeriod
        );
      }
      case 'SUBSCRIPTION_CANCELLED': {
        // Discriminator per this order's own Design decisions: cancelAt
        // present -> the Stripe-webhook path (stripe-webhook.service.ts:281,
        // 4-arg template); absent -> the user-initiated path
        // (stripe-subscription.controller.ts:112, 2-arg template). Plan is
        // hardcoded 'PRO' matching the monolith's own original caller
        // (lib/stripe/webhook-handlers.ts:269) -- this event only ever
        // fires on a PRO subscription being canceled.
        const cancelAt = payload['cancelAt'];
        if (typeof cancelAt === 'string') {
          return sendSubscriptionCanceledEmail(
            email,
            name,
            'PRO',
            new Date(cancelAt)
          );
        }
        return sendCancellationEmail(email, name);
      }
      case 'TIER_DOWNGRADED':
        // Design decisions point 3: reuse the cancellation copy -- no
        // monolith precedent exists for this event (the downgrade cron
        // never sent email before this session).
        return sendCancellationEmail(email, name);
      case 'PAYMENT_FAILED': {
        const reason =
          typeof payload['failureReason'] === 'string'
            ? (payload['failureReason'] as string)
            : 'Payment method declined';
        return sendPaymentFailedEmail(email, name, reason);
      }
      case 'PAYMENT_SUCCEEDED': {
        const amount =
          typeof payload['amountPaidUsd'] === 'number'
            ? (payload['amountPaidUsd'] as number)
            : 0;
        const nextBillingDate =
          typeof payload['nextBillingDate'] === 'string'
            ? new Date(payload['nextBillingDate'] as string)
            : new Date();
        return sendPaymentReceiptEmail(email, name, amount, nextBillingDate);
      }
      case 'COMMISSION_CREDITED': {
        const code =
          typeof payload['code'] === 'string'
            ? (payload['code'] as string)
            : '';
        const commissionAmount =
          typeof payload['commissionAmount'] === 'number'
            ? (payload['commissionAmount'] as number)
            : 0;
        const totalEarnings =
          typeof payload['totalEarnings'] === 'number'
            ? (payload['totalEarnings'] as number)
            : 0;
        return sendAffiliateCommissionEmail(
          email,
          name,
          code,
          commissionAmount,
          totalEarnings
        );
      }
      default:
        // Unreachable: KNOWN_EVENT_TYPES already filtered to exactly this
        // set. Kept as a defensive throw rather than a silent fallthrough.
        throw new InternalServerErrorException(
          `Unhandled known eventType '${eventType}'`
        );
    }
  }
}
