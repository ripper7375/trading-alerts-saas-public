import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { sendSubscriptionConfirmationEmail } from '../email/email.util';
import {
  sendAffiliateCommissionEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
} from '../email/subscription-email.util';
import { OutboxEventDto } from './dto/outbox-event.dto';
import { OutboxConsumerService } from './outbox-consumer.service';

jest.mock('../email/email.util', () => ({
  sendSubscriptionConfirmationEmail: jest.fn(),
}));
jest.mock('../email/subscription-email.util', () => ({
  sendAffiliateCommissionEmail: jest.fn(),
  sendCancellationEmail: jest.fn(),
  sendPaymentFailedEmail: jest.fn(),
  sendPaymentReceiptEmail: jest.fn(),
  sendSubscriptionCanceledEmail: jest.fn(),
}));

const mockSendSubscriptionConfirmationEmail =
  sendSubscriptionConfirmationEmail as jest.MockedFunction<
    typeof sendSubscriptionConfirmationEmail
  >;
const mockSendCancellationEmail = sendCancellationEmail as jest.MockedFunction<
  typeof sendCancellationEmail
>;
const mockSendPaymentFailedEmail =
  sendPaymentFailedEmail as jest.MockedFunction<typeof sendPaymentFailedEmail>;
const mockSendPaymentReceiptEmail =
  sendPaymentReceiptEmail as jest.MockedFunction<
    typeof sendPaymentReceiptEmail
  >;
const mockSendSubscriptionCanceledEmail =
  sendSubscriptionCanceledEmail as jest.MockedFunction<
    typeof sendSubscriptionCanceledEmail
  >;
const mockSendAffiliateCommissionEmail =
  sendAffiliateCommissionEmail as jest.MockedFunction<
    typeof sendAffiliateCommissionEmail
  >;

function makeEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
  aggregateId = 'user_1'
): OutboxEventDto {
  const dto = new OutboxEventDto();
  dto.id = 'evt_1';
  dto.aggregateType = 'User';
  dto.aggregateId = aggregateId;
  dto.eventType = eventType;
  dto.payload = payload;
  return dto;
}

/** An in-memory stand-in for the ioredis calls the consumer makes: SET (EX, NX), GET, DEL. */
class FakeRedis {
  readonly store = new Map<
    string,
    { value: string; ttl: number | undefined }
  >();
  failing = false;
  readonly set = jest.fn(
    async (
      key: string,
      value: string,
      ...flags: Array<string | number>
    ): Promise<'OK' | null> => {
      if (this.failing) throw new Error('redis down');
      const nx = flags.includes('NX');
      const exIndex = flags.indexOf('EX');
      const ttl = exIndex >= 0 ? (flags[exIndex + 1] as number) : undefined;
      if (nx && this.store.has(key)) return null;
      this.store.set(key, { value, ttl });
      return 'OK';
    }
  );
  readonly get = jest.fn(async (key: string): Promise<string | null> => {
    if (this.failing) throw new Error('redis down');
    return this.store.get(key)?.value ?? null;
  });
  readonly del = jest.fn(async (key: string): Promise<number> => {
    if (this.failing) throw new Error('redis down');
    return this.store.delete(key) ? 1 : 0;
  });
}

describe('OutboxConsumerService', () => {
  let service: OutboxConsumerService;
  let findUnique: jest.Mock;
  let redis: FakeRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique = jest.fn();
    const prisma = {
      user: { findUnique },
    } as unknown as ConstructorParameters<typeof OutboxConsumerService>[0];
    redis = new FakeRedis();
    service = new OutboxConsumerService(prisma, {
      getClient: () => redis,
    } as unknown as ConstructorParameters<typeof OutboxConsumerService>[1]);

    mockSendSubscriptionConfirmationEmail.mockResolvedValue({
      success: true,
    });
    mockSendCancellationEmail.mockResolvedValue({ success: true });
    mockSendPaymentFailedEmail.mockResolvedValue({ success: true });
    mockSendPaymentReceiptEmail.mockResolvedValue({ success: true });
    mockSendSubscriptionCanceledEmail.mockResolvedValue({ success: true });
    mockSendAffiliateCommissionEmail.mockResolvedValue({ success: true });
    findUnique.mockResolvedValue({
      email: 'ada@example.com',
      name: 'Ada',
    });
  });

  it('dispatches TIER_UPGRADED to the subscription confirmation email with billingPeriod from the payload', async () => {
    const result = await service.processEvent(
      makeEvent('TIER_UPGRADED', { tier: 'PRO', billingPeriod: 'yearly' })
    );
    expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      'yearly'
    );
    expect(result).toEqual({ status: 'processed' });
  });

  it('defaults TIER_UPGRADED to monthly billing when the payload has no billingPeriod (dLocal case)', async () => {
    await service.processEvent(
      makeEvent('TIER_UPGRADED', { tier: 'PRO', provider: 'DLOCAL' })
    );
    expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      'monthly'
    );
  });

  it('dispatches SUBSCRIPTION_CANCELLED with cancelAt to the 4-arg canceled-email template', async () => {
    await service.processEvent(
      makeEvent('SUBSCRIPTION_CANCELLED', {
        tier: 'FREE',
        provider: 'STRIPE',
        cancelAt: '2026-08-15T00:00:00.000Z',
      })
    );
    expect(mockSendSubscriptionCanceledEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      new Date('2026-08-15T00:00:00.000Z')
    );
    expect(mockSendCancellationEmail).not.toHaveBeenCalled();
  });

  it('dispatches SUBSCRIPTION_CANCELLED without cancelAt to the 2-arg cancellation email', async () => {
    await service.processEvent(
      makeEvent('SUBSCRIPTION_CANCELLED', { tier: 'FREE' })
    );
    expect(mockSendCancellationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada'
    );
    expect(mockSendSubscriptionCanceledEmail).not.toHaveBeenCalled();
  });

  it('dispatches TIER_DOWNGRADED to the cancellation email', async () => {
    await service.processEvent(
      makeEvent('TIER_DOWNGRADED', { tier: 'FREE', reason: 'EXPIRED' })
    );
    expect(mockSendCancellationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada'
    );
  });

  it('dispatches PAYMENT_FAILED with the failure reason', async () => {
    await service.processEvent(
      makeEvent('PAYMENT_FAILED', {
        provider: 'STRIPE',
        failureReason: 'Card declined',
      })
    );
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'Card declined'
    );
  });

  it('dispatches PAYMENT_SUCCEEDED with the amount and next billing date', async () => {
    await service.processEvent(
      makeEvent('PAYMENT_SUCCEEDED', {
        provider: 'STRIPE',
        amountPaidUsd: 29,
        nextBillingDate: '2026-09-01T00:00:00.000Z',
      })
    );
    expect(mockSendPaymentReceiptEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      29,
      new Date('2026-09-01T00:00:00.000Z')
    );
  });

  it('dispatches COMMISSION_CREDITED to the affiliate commission email, resolving the recipient from aggregateId (F50)', async () => {
    findUnique.mockResolvedValue({
      email: 'affiliate@example.com',
      name: 'Affiliate Ada',
    });

    const result = await service.processEvent(
      makeEvent(
        'COMMISSION_CREDITED',
        {
          commissionId: 'comm_1',
          commissionAmount: 5.8,
          totalEarnings: 123.45,
          code: 'AFF10',
          provider: 'STRIPE',
        },
        'affiliate_user_1'
      )
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'affiliate_user_1' },
      select: { email: true, name: true },
    });
    expect(mockSendAffiliateCommissionEmail).toHaveBeenCalledWith(
      'affiliate@example.com',
      'Affiliate Ada',
      'AFF10',
      5.8,
      123.45
    );
    expect(result).toEqual({ status: 'processed' });
  });

  it('skips an unrecognized eventType without throwing', async () => {
    const result = await service.processEvent(
      makeEvent('SOME_FUTURE_EVENT', {})
    );
    expect(result).toEqual({
      status: 'skipped',
      reason: 'unrecognized-event-type',
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('skips when the user is not found', async () => {
    findUnique.mockResolvedValue(null);
    const result = await service.processEvent(
      makeEvent('TIER_DOWNGRADED', {}, 'missing_user')
    );
    expect(result).toEqual({ status: 'skipped', reason: 'user-not-found' });
    expect(mockSendCancellationEmail).not.toHaveBeenCalled();
  });

  it('skips when the user has no email', async () => {
    findUnique.mockResolvedValue({ email: null, name: 'Ada' });
    const result = await service.processEvent(makeEvent('TIER_DOWNGRADED'));
    expect(result).toEqual({ status: 'skipped', reason: 'user-not-found' });
  });

  it('throws so the caller 5xxs when the email send fails', async () => {
    mockSendCancellationEmail.mockResolvedValue({
      success: false,
      error: 'Resend API error',
    });
    await expect(
      service.processEvent(makeEvent('TIER_DOWNGRADED'))
    ).rejects.toThrow(InternalServerErrorException);
  });

  describe('at-least-once delivery (Remediation Tier 2 §6.7)', () => {
    const key = 'outbox-consumer:event:evt_1';

    it('claims the event before sending and records it as done for a week afterwards', async () => {
      await service.processEvent(makeEvent('TIER_DOWNGRADED'));

      expect(redis.set.mock.calls[0]).toEqual([
        key,
        'in-flight',
        'EX',
        300,
        'NX',
      ]);
      expect(redis.store.get(key)).toEqual({
        value: 'done',
        ttl: 7 * 24 * 60 * 60,
      });
      expect(mockSendCancellationEmail).toHaveBeenCalledTimes(1);
    });

    it('sends the email once when the publisher delivers the same event twice', async () => {
      const first = await service.processEvent(makeEvent('TIER_DOWNGRADED'));
      const second = await service.processEvent(makeEvent('TIER_DOWNGRADED'));

      expect(first).toEqual({ status: 'processed' });
      expect(second).toEqual({ status: 'skipped', reason: 'duplicate' });
      expect(mockSendCancellationEmail).toHaveBeenCalledTimes(1);
    });

    it('treats different event ids as different events', async () => {
      const other = makeEvent('TIER_DOWNGRADED');
      other.id = 'evt_2';

      await service.processEvent(makeEvent('TIER_DOWNGRADED'));
      await service.processEvent(other);

      expect(mockSendCancellationEmail).toHaveBeenCalledTimes(2);
    });

    it('answers 503 (the publisher retries) while another delivery of the event is still sending, and sends nothing itself', async () => {
      redis.store.set(key, { value: 'in-flight', ttl: 300 });

      await expect(
        service.processEvent(makeEvent('TIER_DOWNGRADED'))
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockSendCancellationEmail).not.toHaveBeenCalled();
    });

    it('lets exactly one of two concurrent deliveries send, and the other gets a 503', async () => {
      const results = await Promise.allSettled([
        service.processEvent(makeEvent('TIER_DOWNGRADED')),
        service.processEvent(makeEvent('TIER_DOWNGRADED')),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      expect(mockSendCancellationEmail).toHaveBeenCalledTimes(1);
    });

    it('releases the claim when the send fails, so the retry from the publisher sends it', async () => {
      mockSendCancellationEmail.mockResolvedValueOnce({
        success: false,
        error: 'Resend API error',
      });

      await expect(
        service.processEvent(makeEvent('TIER_DOWNGRADED'))
      ).rejects.toThrow(InternalServerErrorException);
      expect(redis.store.has(key)).toBe(false);

      const retry = await service.processEvent(makeEvent('TIER_DOWNGRADED'));
      expect(retry).toEqual({ status: 'processed' });
      expect(mockSendCancellationEmail).toHaveBeenCalledTimes(2);
    });

    it('releases the claim when the sender throws', async () => {
      mockSendCancellationEmail.mockRejectedValueOnce(new Error('network'));

      await expect(
        service.processEvent(makeEvent('TIER_DOWNGRADED'))
      ).rejects.toThrow('network');
      expect(redis.store.has(key)).toBe(false);
    });

    it('keeps sending (fails open) when Redis is down: a receipt is not held back by the dedupe store', async () => {
      redis.failing = true;
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      const result = await service.processEvent(makeEvent('TIER_DOWNGRADED'));

      expect(result).toEqual({ status: 'processed' });
      expect(mockSendCancellationEmail).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('does not claim an event it will skip (unknown type, unknown user)', async () => {
      await service.processEvent(makeEvent('SOME_FUTURE_EVENT', {}));
      findUnique.mockResolvedValueOnce(null);
      await service.processEvent(makeEvent('TIER_DOWNGRADED', {}, 'missing'));

      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
