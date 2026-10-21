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
  sendPlanSwitchScheduledEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionResumedEmail,
  sendSubscriptionUpgradedEmail,
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
  sendPlanSwitchScheduledEmail: jest.fn(),
  sendSubscriptionCanceledEmail: jest.fn(),
  sendSubscriptionResumedEmail: jest.fn(),
  sendSubscriptionUpgradedEmail: jest.fn(),
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
const mockSendSubscriptionResumedEmail =
  sendSubscriptionResumedEmail as jest.MockedFunction<
    typeof sendSubscriptionResumedEmail
  >;
const mockSendSubscriptionUpgradedEmail =
  sendSubscriptionUpgradedEmail as jest.MockedFunction<
    typeof sendSubscriptionUpgradedEmail
  >;
const mockSendPlanSwitchScheduledEmail =
  sendPlanSwitchScheduledEmail as jest.MockedFunction<
    typeof sendPlanSwitchScheduledEmail
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
    mockSendSubscriptionResumedEmail.mockResolvedValue({ success: true });
    mockSendSubscriptionUpgradedEmail.mockResolvedValue({ success: true });
    mockSendPlanSwitchScheduledEmail.mockResolvedValue({ success: true });
    mockSendAffiliateCommissionEmail.mockResolvedValue({ success: true });
    findUnique.mockResolvedValue({
      email: 'ada@example.com',
      name: 'Ada',
    });
  });

  it('dispatches TIER_UPGRADED to the subscription confirmation email with billingPeriod and priceUsd from the payload', async () => {
    const result = await service.processEvent(
      makeEvent('TIER_UPGRADED', {
        tier: 'PRO',
        billingPeriod: 'yearly',
        priceUsd: 350,
      })
    );
    expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      'yearly',
      350
    );
    expect(result).toEqual({ status: 'processed' });
  });

  it('passes a three_day billingPeriod on TIER_UPGRADED through to the confirmation email', async () => {
    await service.processEvent(
      makeEvent('TIER_UPGRADED', {
        tier: 'PRO',
        provider: 'DLOCAL',
        billingPeriod: 'three_day',
        priceUsd: 1.99,
      })
    );
    expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      'three_day',
      1.99
    );
  });

  it('defaults TIER_UPGRADED to monthly billing when the payload has no billingPeriod, keeping its priceUsd', async () => {
    await service.processEvent(
      makeEvent('TIER_UPGRADED', {
        tier: 'PRO',
        provider: 'DLOCAL',
        priceUsd: 35,
      })
    );
    expect(mockSendSubscriptionConfirmationEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      'monthly',
      35
    );
  });

  it.each([
    ['is absent', {}],
    ['is a string', { priceUsd: '35' }],
    ['is zero', { priceUsd: 0 }],
    ['is negative', { priceUsd: -35 }],
    ['is not finite', { priceUsd: Infinity }],
  ])(
    'skips TIER_UPGRADED without sending when priceUsd %s',
    async (_label, extra) => {
      const result = await service.processEvent(
        makeEvent('TIER_UPGRADED', { tier: 'PRO', ...extra })
      );
      expect(result).toEqual({ status: 'skipped', reason: 'missing-price' });
      expect(mockSendSubscriptionConfirmationEmail).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    }
  );

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

  // Manage Subscription S2 (W3): a cancellation at the period end keeps PRO,
  // so money-service sends the date PRO ends and the same e-mail is used.
  it('dispatches a scheduled SUBSCRIPTION_CANCELLED (tier still PRO, cancelAt = the period end) to the canceled-email template', async () => {
    const result = await service.processEvent(
      makeEvent('SUBSCRIPTION_CANCELLED', {
        tier: 'PRO',
        subscriptionId: 'row_1',
        provider: 'STRIPE',
        cancelAt: '2026-11-21T00:00:00.000Z',
        scheduled: true,
      })
    );
    expect(result).toEqual({ status: 'processed' });
    expect(mockSendSubscriptionCanceledEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'PRO',
      new Date('2026-11-21T00:00:00.000Z')
    );
    expect(mockSendCancellationEmail).not.toHaveBeenCalled();
  });

  describe('SUBSCRIPTION_RESUMED (S2, W4)', () => {
    it('dispatches to the resumed e-mail with the renewal date', async () => {
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_RESUMED', {
          tier: 'PRO',
          subscriptionId: 'row_1',
          provider: 'STRIPE',
          renewsAt: '2026-11-21T00:00:00.000Z',
        })
      );
      expect(result).toEqual({ status: 'processed' });
      expect(mockSendSubscriptionResumedEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Ada',
        'PRO',
        new Date('2026-11-21T00:00:00.000Z')
      );
    });

    it('is a known event type: it is not skipped as unrecognised', async () => {
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_RESUMED', {
          renewsAt: '2026-11-21T00:00:00.000Z',
        })
      );
      expect(result).not.toEqual({
        status: 'skipped',
        reason: 'unrecognized-event-type',
      });
    });

    it.each([
      ['is absent', {}],
      ['is a number', { renewsAt: 1795305600 }],
      ['is not a date', { renewsAt: 'soon' }],
      ['is empty', { renewsAt: '' }],
    ])(
      'skips the event, without sending or claiming it, when renewsAt %s',
      async (_label, payload) => {
        const result = await service.processEvent(
          makeEvent('SUBSCRIPTION_RESUMED', payload)
        );
        expect(result).toEqual({
          status: 'skipped',
          reason: 'missing-renews-at',
        });
        expect(mockSendSubscriptionResumedEmail).not.toHaveBeenCalled();
        expect(findUnique).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
      }
    );

    it('sends once when the publisher delivers the same event again (at-least-once)', async () => {
      const event = makeEvent('SUBSCRIPTION_RESUMED', {
        renewsAt: '2026-11-21T00:00:00.000Z',
      });

      const first = await service.processEvent(event);
      const second = await service.processEvent(event);

      expect(first).toEqual({ status: 'processed' });
      expect(second).toEqual({ status: 'skipped', reason: 'duplicate' });
      expect(mockSendSubscriptionResumedEmail).toHaveBeenCalledTimes(1);
    });

    it('lets the publisher retry when the send fails', async () => {
      mockSendSubscriptionResumedEmail.mockResolvedValue({
        success: false,
        error: 'resend down',
      });

      await expect(
        service.processEvent(
          makeEvent('SUBSCRIPTION_RESUMED', {
            renewsAt: '2026-11-21T00:00:00.000Z',
          })
        )
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('skips when the user cannot be found', async () => {
      findUnique.mockResolvedValue(null);

      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_RESUMED', {
          renewsAt: '2026-11-21T00:00:00.000Z',
        })
      );

      expect(result).toEqual({ status: 'skipped', reason: 'user-not-found' });
      expect(mockSendSubscriptionResumedEmail).not.toHaveBeenCalled();
    });
  });

  describe('SUBSCRIPTION_UPGRADED (S3, W5a)', () => {
    const payload = (over: Record<string, unknown> = {}) => ({
      tier: 'PRO',
      subscriptionId: 'row_1',
      provider: 'STRIPE',
      amountChargedUsd: 270.35,
      yearlyPriceUsd: 290,
      nextBillingDate: '2027-10-31T03:15:00.000Z',
      inTrial: false,
      ...over,
    });

    it('dispatches to the upgraded e-mail with the amount charged, the yearly price and the next billing date', async () => {
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_UPGRADED', payload())
      );
      expect(result).toEqual({ status: 'processed' });
      expect(mockSendSubscriptionUpgradedEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Ada',
        'PRO',
        270.35,
        290,
        new Date('2027-10-31T03:15:00.000Z'),
        false
      );
    });

    it('a free-trial switch charged nothing: 0 is a valid amount and the trial flag reaches the e-mail', async () => {
      await service.processEvent(
        makeEvent(
          'SUBSCRIPTION_UPGRADED',
          payload({ amountChargedUsd: 0, inTrial: true })
        )
      );
      expect(mockSendSubscriptionUpgradedEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Ada',
        'PRO',
        0,
        290,
        new Date('2027-10-31T03:15:00.000Z'),
        true
      );
    });

    it('reads anything but true as not in a trial', async () => {
      await service.processEvent(
        makeEvent('SUBSCRIPTION_UPGRADED', payload({ inTrial: 'yes' }))
      );
      expect(mockSendSubscriptionUpgradedEmail.mock.calls[0]![6]).toBe(false);
    });

    it('is a known event type: it is not skipped as unrecognised', async () => {
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_UPGRADED', payload())
      );
      expect(result).not.toEqual({
        status: 'skipped',
        reason: 'unrecognized-event-type',
      });
    });

    it.each([
      ['no amount charged', { amountChargedUsd: undefined }],
      ['a negative amount charged', { amountChargedUsd: -1 }],
      ['an amount charged that is not a number', { amountChargedUsd: '270' }],
      ['no yearly price', { yearlyPriceUsd: undefined }],
      ['a yearly price of 0', { yearlyPriceUsd: 0 }],
      ['no billing date', { nextBillingDate: undefined }],
      ['a billing date that is not a date', { nextBillingDate: 'soon' }],
    ])(
      'skips the event, without sending or claiming it, with %s',
      async (_label, over) => {
        const result = await service.processEvent(
          makeEvent('SUBSCRIPTION_UPGRADED', payload(over))
        );
        expect(result).toEqual({
          status: 'skipped',
          reason: 'missing-upgrade-details',
        });
        expect(mockSendSubscriptionUpgradedEmail).not.toHaveBeenCalled();
        expect(findUnique).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
      }
    );

    it('sends once when the publisher delivers the same event again (at-least-once)', async () => {
      const event = makeEvent('SUBSCRIPTION_UPGRADED', payload());
      const first = await service.processEvent(event);
      const second = await service.processEvent(event);
      expect(first).toEqual({ status: 'processed' });
      expect(second).toEqual({ status: 'skipped', reason: 'duplicate' });
      expect(mockSendSubscriptionUpgradedEmail).toHaveBeenCalledTimes(1);
    });

    it('lets the publisher retry when the send fails', async () => {
      mockSendSubscriptionUpgradedEmail.mockResolvedValue({
        success: false,
        error: 'resend down',
      });
      await expect(
        service.processEvent(makeEvent('SUBSCRIPTION_UPGRADED', payload()))
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('skips when the user cannot be found', async () => {
      findUnique.mockResolvedValue(null);
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_UPGRADED', payload())
      );
      expect(result).toEqual({ status: 'skipped', reason: 'user-not-found' });
      expect(mockSendSubscriptionUpgradedEmail).not.toHaveBeenCalled();
    });
  });

  describe('SUBSCRIPTION_DOWNGRADE_SCHEDULED (S3, W5b)', () => {
    const payload = (over: Record<string, unknown> = {}) => ({
      tier: 'PRO',
      subscriptionId: 'row_1',
      provider: 'STRIPE',
      effectiveAt: '2027-10-31T00:00:00.000Z',
      monthlyPriceUsd: 29,
      ...over,
    });

    it('dispatches to the switch-scheduled e-mail with the switch date and the monthly price', async () => {
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_DOWNGRADE_SCHEDULED', payload())
      );
      expect(result).toEqual({ status: 'processed' });
      expect(mockSendPlanSwitchScheduledEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Ada',
        'PRO',
        new Date('2027-10-31T00:00:00.000Z'),
        29
      );
    });

    it('is a known event type: it is not skipped as unrecognised', async () => {
      const result = await service.processEvent(
        makeEvent('SUBSCRIPTION_DOWNGRADE_SCHEDULED', payload())
      );
      expect(result).not.toEqual({
        status: 'skipped',
        reason: 'unrecognized-event-type',
      });
    });

    it.each([
      ['no switch date', { effectiveAt: undefined }],
      ['a switch date that is not a date', { effectiveAt: 'soon' }],
      ['a switch date that is a number', { effectiveAt: 1795305600 }],
      ['no monthly price', { monthlyPriceUsd: undefined }],
      ['a monthly price of 0', { monthlyPriceUsd: 0 }],
      ['a monthly price that is not a number', { monthlyPriceUsd: '29' }],
    ])(
      'skips the event, without sending or claiming it, with %s',
      async (_label, over) => {
        const result = await service.processEvent(
          makeEvent('SUBSCRIPTION_DOWNGRADE_SCHEDULED', payload(over))
        );
        expect(result).toEqual({
          status: 'skipped',
          reason: 'missing-switch-details',
        });
        expect(mockSendPlanSwitchScheduledEmail).not.toHaveBeenCalled();
        expect(findUnique).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
      }
    );

    it('sends once when the publisher delivers the same event again (at-least-once)', async () => {
      const event = makeEvent('SUBSCRIPTION_DOWNGRADE_SCHEDULED', payload());
      await service.processEvent(event);
      const second = await service.processEvent(event);
      expect(second).toEqual({ status: 'skipped', reason: 'duplicate' });
      expect(mockSendPlanSwitchScheduledEmail).toHaveBeenCalledTimes(1);
    });

    it('lets the publisher retry when the send fails', async () => {
      mockSendPlanSwitchScheduledEmail.mockResolvedValue({
        success: false,
        error: 'resend down',
      });
      await expect(
        service.processEvent(
          makeEvent('SUBSCRIPTION_DOWNGRADE_SCHEDULED', payload())
        )
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('does not send the cancellation or the upgrade mail', async () => {
      await service.processEvent(
        makeEvent('SUBSCRIPTION_DOWNGRADE_SCHEDULED', payload())
      );
      expect(mockSendCancellationEmail).not.toHaveBeenCalled();
      expect(mockSendSubscriptionUpgradedEmail).not.toHaveBeenCalled();
    });
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

  it('dispatches PAYMENT_FAILED with the failure reason, the subscriber price and the billing period', async () => {
    await service.processEvent(
      makeEvent('PAYMENT_FAILED', {
        provider: 'STRIPE',
        failureReason: 'Card declined',
        billingPeriod: 'yearly',
        priceUsd: 350,
      })
    );
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'Card declined',
      350,
      'yearly'
    );
  });

  it('passes a three_day billingPeriod on PAYMENT_FAILED through to the payment failed email', async () => {
    await service.processEvent(
      makeEvent('PAYMENT_FAILED', {
        provider: 'DLOCAL',
        failureReason: 'Card declined',
        billingPeriod: 'three_day',
        priceUsd: 1.99,
      })
    );
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'Card declined',
      1.99,
      'three_day'
    );
  });

  it('shows a PAYMENT_FAILED without a billingPeriod as monthly', async () => {
    await service.processEvent(
      makeEvent('PAYMENT_FAILED', {
        provider: 'STRIPE',
        failureReason: 'Card declined',
        priceUsd: 35,
      })
    );
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith(
      'ada@example.com',
      'Ada',
      'Card declined',
      35,
      'monthly'
    );
  });

  it('skips PAYMENT_FAILED without sending when the payload has no usable priceUsd', async () => {
    const result = await service.processEvent(
      makeEvent('PAYMENT_FAILED', {
        provider: 'STRIPE',
        failureReason: 'Card declined',
      })
    );
    expect(result).toEqual({ status: 'skipped', reason: 'missing-price' });
    expect(mockSendPaymentFailedEmail).not.toHaveBeenCalled();
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
