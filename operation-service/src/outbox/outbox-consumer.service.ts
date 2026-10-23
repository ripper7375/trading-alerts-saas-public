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

import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { OutboxEventDto } from './dto/outbox-event.dto';
import {
  sendAffiliateCommissionEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
} from '../email/subscription-email.util';
import {
  sendPayoutDetailsChangedEmail,
  sendSubscriptionConfirmationEmail,
} from '../email/email.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface OutboxProcessResult {
  status: 'processed' | 'skipped';
  reason?: string;
}

type EmailSendResult = { success: boolean; error?: string };

/**
 * Remediation Tier 2 §6.7: money-service's publisher is at-least-once (any
 * non-2xx, a timeout, or a crash between the send and its own bookkeeping makes
 * it deliver the same event again), and every event here is an email. Each
 * event.id is therefore claimed in Redis around the send:
 *   in flight  a short lease, so a delivery that dies mid-send does not block the event for long
 *   done       kept for a week, longer than the publisher keeps retrying
 * Redis being down is not a reason to stop sending a receipt: the claim fails open.
 */
const CLAIM_KEY_PREFIX = 'outbox-consumer:event:';
const IN_FLIGHT_LEASE_SECONDS = 300;
const DONE_TTL_SECONDS = 7 * 24 * 60 * 60;

type ClaimResult = 'claimed' | 'done' | 'in-flight' | 'unavailable';

const KNOWN_EVENT_TYPES = new Set([
  'TIER_UPGRADED',
  'SUBSCRIPTION_CANCELLED',
  'PAYMENT_FAILED',
  'PAYMENT_SUCCEEDED',
  'COMMISSION_CREDITED',
  'TIER_DOWNGRADED',
  'PAYOUT_DETAILS_CHANGED',
]);

/**
 * These two e-mails print the subscriber's price, and money-service puts it in
 * the payload as `priceUsd` (USD per billing period). There is no price of this
 * service's own to fall back on, so an event without one is skipped rather than
 * sent with a wrong figure (an event queued before money-service started
 * sending it can only be one of these).
 */
const PRICED_EVENT_TYPES = new Set(['TIER_UPGRADED', 'PAYMENT_FAILED']);

function priceUsdOf(payload: Record<string, unknown>): number | null {
  const price = payload['priceUsd'];
  return typeof price === 'number' && Number.isFinite(price) && price > 0
    ? price
    : null;
}

/**
 * What the PAYOUT_DETAILS_CHANGED notice needs from money-service's payload
 * (WS-9, CODE-06A): when the details changed, when payouts to them may start,
 * and how many hours the hold is. A payload without all three readable is
 * skipped rather than sent with a wrong date.
 */
interface PayoutNotice {
  changedAt: Date;
  holdUntil: Date;
  holdHours: number;
}

function payoutNoticeOf(payload: Record<string, unknown>): PayoutNotice | null {
  const changedAt = parseDate(payload['changedAt']);
  const holdUntil = parseDate(payload['holdUntil']);
  const holdHours = payload['holdHours'];
  if (
    changedAt === null ||
    holdUntil === null ||
    typeof holdHours !== 'number' ||
    !Number.isFinite(holdHours) ||
    holdHours <= 0
  ) {
    return null;
  }
  return { changedAt, holdUntil, holdHours };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class OutboxConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  private claimKey(eventId: string): string {
    return `${CLAIM_KEY_PREFIX}${eventId}`;
  }

  private async claim(eventId: string): Promise<ClaimResult> {
    try {
      const client = this.redis.getClient();
      const key = this.claimKey(eventId);
      const won = await client.set(
        key,
        'in-flight',
        'EX',
        IN_FLIGHT_LEASE_SECONDS,
        'NX'
      );
      if (won === 'OK') return 'claimed';
      return (await client.get(key)) === 'done' ? 'done' : 'in-flight';
    } catch (error) {
      console.warn('[Outbox] Idempotency claim unavailable, sending anyway', {
        outboxEventId: eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 'unavailable';
    }
  }

  private async markDone(eventId: string): Promise<void> {
    try {
      await this.redis
        .getClient()
        .set(this.claimKey(eventId), 'done', 'EX', DONE_TTL_SECONDS);
    } catch (error) {
      console.warn('[Outbox] Could not record the event as done', {
        outboxEventId: eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async release(eventId: string): Promise<void> {
    try {
      await this.redis.getClient().del(this.claimKey(eventId));
    } catch (error) {
      console.warn('[Outbox] Could not release the event claim', {
        outboxEventId: eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

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

    const priceUsd = priceUsdOf(event.payload);
    if (PRICED_EVENT_TYPES.has(event.eventType) && priceUsd === null) {
      console.warn(
        `[Outbox] ${event.eventType} event has no usable priceUsd, skipping`,
        { outboxEventId: event.id }
      );
      return { status: 'skipped', reason: 'missing-price' };
    }

    const isPayoutEvent = event.eventType === 'PAYOUT_DETAILS_CHANGED';
    const payoutNotice = isPayoutEvent ? payoutNoticeOf(event.payload) : null;
    if (isPayoutEvent && payoutNotice === null) {
      console.warn(
        `[Outbox] ${event.eventType} event has no usable dates or hold length, skipping`,
        { outboxEventId: event.id }
      );
      return { status: 'skipped', reason: 'invalid-payload' };
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

    const claim = await this.claim(event.id);
    if (claim === 'done') {
      // The publisher delivered this event before and we sent its email.
      return { status: 'skipped', reason: 'duplicate' };
    }
    if (claim === 'in-flight') {
      // Another delivery of the same event is sending right now. A 5xx makes the
      // publisher retry later: if that send fails, the retry sends it; if it
      // succeeds, the retry finds the event done.
      throw new ServiceUnavailableException(
        'Outbox event is already being delivered'
      );
    }

    try {
      const result = await this.dispatch(
        event.eventType,
        email,
        name,
        payload,
        priceUsd,
        payoutNotice
      );

      if (!result.success) {
        throw new InternalServerErrorException(
          result.error ?? 'Email send failed'
        );
      }
    } catch (error) {
      // Free the claim so the publisher's retry can send it.
      if (claim === 'claimed') await this.release(event.id);
      throw error;
    }

    // The in-app alert goes after the e-mail and never fails the event: a
    // retry would send the e-mail a second time.
    if (payoutNotice) {
      await this.recordPayoutAlert(event, payoutNotice);
    }

    if (claim === 'claimed') await this.markDone(event.id);
    return { status: 'processed' };
  }

  /**
   * The in-app side of the PAYOUT_DETAILS_CHANGED notice: a SecurityAlert on
   * the account (shown at /settings/security/activity). Title and message are
   * stored in English, as for every existing alert; the page labels the type
   * in the reader's language. Nothing about the bank account is stored.
   */
  private async recordPayoutAlert(
    event: OutboxEventDto,
    notice: PayoutNotice
  ): Promise<void> {
    try {
      await this.prisma.securityAlert.create({
        data: {
          userId: event.aggregateId,
          type: 'PAYOUT_DETAILS_CHANGED',
          title: 'Payout Details Changed',
          message: `Payout details were added or changed on your affiliate account. Payouts to them are on hold for ${notice.holdHours} hours. If this was not you, secure your account now.`,
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
    } catch (error) {
      console.warn('[Outbox] Could not write the payout-details alert', {
        outboxEventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async dispatch(
    eventType: string,
    email: string,
    name: string,
    payload: Record<string, unknown>,
    priceUsd: number | null,
    payoutNotice: PayoutNotice | null
  ): Promise<EmailSendResult> {
    switch (eventType) {
      case 'TIER_UPGRADED': {
        // processEvent skipped the event already when priceUsd is missing.
        if (priceUsd === null) {
          throw new InternalServerErrorException(
            `${eventType} reached dispatch without a priceUsd`
          );
        }
        // An event without a billingPeriod (one from before money-service
        // sent it) is shown as monthly rather than rejected.
        const billingPeriod =
          payload['billingPeriod'] === 'yearly'
            ? 'yearly'
            : payload['billingPeriod'] === 'three_day'
              ? 'three_day'
              : 'monthly';
        return sendSubscriptionConfirmationEmail(
          email,
          name,
          'PRO',
          billingPeriod,
          priceUsd
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
        if (priceUsd === null) {
          throw new InternalServerErrorException(
            `${eventType} reached dispatch without a priceUsd`
          );
        }
        const reason =
          typeof payload['failureReason'] === 'string'
            ? (payload['failureReason'] as string)
            : 'Payment method declined';
        const billingPeriod =
          payload['billingPeriod'] === 'yearly'
            ? 'yearly'
            : payload['billingPeriod'] === 'three_day'
              ? 'three_day'
              : 'monthly';
        return sendPaymentFailedEmail(
          email,
          name,
          reason,
          priceUsd,
          billingPeriod
        );
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
      case 'PAYOUT_DETAILS_CHANGED': {
        // processEvent skipped the event already when the payload is unusable.
        if (payoutNotice === null) {
          throw new InternalServerErrorException(
            `${eventType} reached dispatch without a usable payload`
          );
        }
        return sendPayoutDetailsChangedEmail(email, name, payoutNotice);
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
