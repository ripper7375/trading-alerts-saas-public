import { InternalServerErrorException } from '@nestjs/common';

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

describe('OutboxConsumerService', () => {
  let service: OutboxConsumerService;
  let findUnique: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique = jest.fn();
    const prisma = {
      user: { findUnique },
    } as unknown as ConstructorParameters<typeof OutboxConsumerService>[0];
    service = new OutboxConsumerService(prisma);

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
});
