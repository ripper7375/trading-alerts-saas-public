/**
 * Stripe Service Tests (Session 4A-9, File 1/10)
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { StripeService } from './stripe.service';

const mockCouponsCreate = jest.fn();
const mockSessionsCreate = jest.fn();
const mockSubscriptionsCancel = jest.fn();
const mockWebhooksConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    coupons: { create: mockCouponsCreate },
    checkout: { sessions: { create: mockSessionsCreate } },
    subscriptions: { cancel: mockSubscriptionsCancel },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  }));
});

describe('StripeService', () => {
  let service: StripeService;
  let configMock: { get: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    configMock = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_PRO_PRICE_ID: 'price_pro_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_123',
        };
        return values[key];
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = moduleRef.get(StripeService);
  });

  describe('buildCheckoutIdempotencyKey', () => {
    it('is deterministic for the same user/code within the same window', () => {
      const a = service.buildCheckoutIdempotencyKey('user-1', 'CODE1');
      const b = service.buildCheckoutIdempotencyKey('user-1', 'CODE1');
      expect(a).toBe(b);
    });

    it('differs for different affiliate codes', () => {
      const a = service.buildCheckoutIdempotencyKey('user-1', 'CODE1');
      const b = service.buildCheckoutIdempotencyKey('user-1', 'CODE2');
      expect(a).not.toBe(b);
    });
  });

  describe('createCheckoutSession', () => {
    it('creates a session with the PRO price and 7-day trial, no idempotency key', async () => {
      mockSessionsCreate.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/pay/cs_123',
      });

      const result = await service.createCheckoutSession(
        'user-1',
        'user@example.com',
        'https://app/success',
        'https://app/cancel'
      );

      expect(result.id).toBe('cs_123');
      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'user@example.com',
          mode: 'subscription',
          line_items: [{ price: 'price_pro_123', quantity: 1 }],
          allow_promotion_codes: true,
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          billing_address_collection: 'required',
        })
      );
      // Called with exactly one arg (no options) when no idempotency key.
      expect(mockSessionsCreate.mock.calls[0]).toHaveLength(1);
    });

    it('attaches customer + customer_update when an existing Stripe customer ID is passed (davintrade-vat-stack)', async () => {
      mockSessionsCreate.mockResolvedValue({ id: 'cs_existing' });

      await service.createCheckoutSession(
        'user-1',
        'user@example.com',
        'https://app/success',
        'https://app/cancel',
        undefined,
        undefined,
        undefined,
        'cus_existing_1'
      );

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing_1',
          customer_email: undefined,
          customer_update: { address: 'auto', name: 'auto' },
        })
      );
    });

    it('propagates the idempotency key to the Stripe SDK call', async () => {
      mockSessionsCreate.mockResolvedValue({ id: 'cs_456' });

      await service.createCheckoutSession(
        'user-1',
        'user@example.com',
        'https://app/success',
        'https://app/cancel',
        undefined,
        undefined,
        'idem-key-abc'
      );

      expect(mockSessionsCreate).toHaveBeenCalledWith(expect.any(Object), {
        idempotencyKey: 'idem-key-abc',
      });
    });

    it('creates a one-time coupon and applies it as a discount when an affiliate discount is present', async () => {
      mockCouponsCreate.mockResolvedValue({ id: 'coupon_123' });
      mockSessionsCreate.mockResolvedValue({ id: 'cs_789' });

      await service.createCheckoutSession(
        'user-1',
        'user@example.com',
        'https://app/success',
        'https://app/cancel',
        'AFFCODE',
        20,
        'idem-key-xyz'
      );

      expect(mockCouponsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ percent_off: 20, duration: 'once' }),
        { idempotencyKey: 'idem-key-xyz:coupon' }
      );
      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ discounts: [{ coupon: 'coupon_123' }] }),
        { idempotencyKey: 'idem-key-xyz' }
      );
    });

    it('throws if STRIPE_PRO_PRICE_ID is not configured', async () => {
      configMock.get.mockImplementation((key: string) =>
        key === 'STRIPE_PRO_PRICE_ID' ? undefined : 'sk_test_123'
      );

      await expect(
        service.createCheckoutSession(
          'user-1',
          'user@example.com',
          'https://app/success',
          'https://app/cancel'
        )
      ).rejects.toThrow('STRIPE_PRO_PRICE_ID environment variable is not set');
    });
  });

  describe('cancelSubscription', () => {
    it('cancels the subscription via the Stripe SDK', async () => {
      mockSubscriptionsCancel.mockResolvedValue({
        id: 'sub_123',
        status: 'canceled',
      });

      const result = await service.cancelSubscription('sub_123');

      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_123');
      expect(result.status).toBe('canceled');
    });
  });

  describe('constructEvent', () => {
    it('verifies and constructs the event via the Stripe SDK', () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
      });

      const event = service.constructEvent('raw-body', 'sig-header');

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        'raw-body',
        'sig-header',
        'whsec_123'
      );
      expect(event.type).toBe('checkout.session.completed');
    });

    it('throws if STRIPE_WEBHOOK_SECRET is not configured', () => {
      configMock.get.mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? undefined : 'sk_test_123'
      );

      expect(() => service.constructEvent('raw-body', 'sig-header')).toThrow(
        'STRIPE_WEBHOOK_SECRET environment variable is not set'
      );
    });
  });
});
