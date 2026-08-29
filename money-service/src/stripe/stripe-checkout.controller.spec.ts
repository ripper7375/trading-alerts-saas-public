/**
 * Stripe Checkout Controller Tests (Session 4A-9, File 2/10)
 */
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { StripeCheckoutController } from './stripe-checkout.controller';
import { StripeService } from './stripe.service';

describe('StripeCheckoutController', () => {
  let controller: StripeCheckoutController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let stripeServiceMock: {
    createCheckoutSession: jest.Mock;
    buildCheckoutIdempotencyKey: jest.Mock;
  };

  const makeRequest = (
    overrides: Partial<AuthenticatedRequest['user']> = {}
  ): AuthenticatedRequest =>
    ({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
        ...overrides,
      },
    }) as AuthenticatedRequest;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    stripeServiceMock = {
      createCheckoutSession: jest.fn(),
      buildCheckoutIdempotencyKey: jest.fn().mockReturnValue('idem-key-1'),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeCheckoutController],
      providers: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        IdempotencyInterceptor,
        {
          provide: IdempotencyStore,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            claim: jest.fn().mockResolvedValue(true),
            save: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(StripeCheckoutController);
  });

  it('returns sessionId and url on success', async () => {
    stripeServiceMock.createCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/pay/cs_123',
    });

    const result = await controller.createCheckout(makeRequest(), undefined);

    expect(result).toEqual({
      sessionId: 'cs_123',
      url: 'https://checkout.stripe.com/pay/cs_123',
    });
  });

  it('passes an existing Stripe customer ID through when the user already has a subscription row (davintrade-vat-stack)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_returning_1',
    } as never);
    stripeServiceMock.createCheckoutSession.mockResolvedValue({
      id: 'cs_returning',
      url: 'https://checkout.stripe.com/pay/cs_returning',
    });

    await controller.createCheckout(makeRequest(), undefined);

    expect(stripeServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      'user@example.com',
      expect.any(String),
      expect.any(String),
      undefined,
      0,
      'idem-key-1',
      'cus_returning_1'
    );
  });

  it('throws 400 ALREADY_PRO if the user already holds PRO tier', async () => {
    await expect(
      controller.createCheckout(makeRequest({ tier: 'PRO' }), undefined)
    ).rejects.toMatchObject({
      response: { code: 'ALREADY_PRO' },
      status: 400,
    });
    expect(stripeServiceMock.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('throws 400 INVALID_AFFILIATE_CODE for an unknown/expired/inactive code', async () => {
    prismaMock.affiliateCode.findFirst.mockResolvedValue(null);

    await expect(
      controller.createCheckout(makeRequest(), { affiliateCode: 'BADCODE' })
    ).rejects.toMatchObject({
      response: { code: 'INVALID_AFFILIATE_CODE' },
      status: 400,
    });
    expect(stripeServiceMock.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('applies the discount from a valid affiliate code', async () => {
    prismaMock.affiliateCode.findFirst.mockResolvedValue({
      discountPercent: 15,
      affiliateProfile: { status: 'ACTIVE' },
    } as never);
    stripeServiceMock.createCheckoutSession.mockResolvedValue({
      id: 'cs_456',
      url: 'https://checkout.stripe.com/pay/cs_456',
    });

    await controller.createCheckout(makeRequest(), {
      affiliateCode: 'good10',
    });

    expect(stripeServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      'user@example.com',
      expect.any(String),
      expect.any(String),
      'GOOD10',
      15,
      'idem-key-1',
      undefined
    );
  });

  it('maps a STRIPE_PRO_PRICE_ID error to 500 STRIPE_CONFIG_ERROR', async () => {
    stripeServiceMock.createCheckoutSession.mockRejectedValue(
      new Error('STRIPE_PRO_PRICE_ID environment variable is not set')
    );

    await expect(
      controller.createCheckout(makeRequest(), undefined)
    ).rejects.toMatchObject({
      response: { code: 'STRIPE_CONFIG_ERROR' },
      status: 500,
    });
  });

  it('maps any other error to 500 CHECKOUT_ERROR', async () => {
    stripeServiceMock.createCheckoutSession.mockRejectedValue(
      new Error('network blip')
    );

    await expect(
      controller.createCheckout(makeRequest(), undefined)
    ).rejects.toMatchObject({
      response: { code: 'CHECKOUT_ERROR' },
      status: 500,
    });
  });
});

describe('StripeCheckoutController + IdempotencyInterceptor (duplicate header cache hit)', () => {
  it('returns the cached response on a duplicate Idempotency-Key without re-invoking the handler', async () => {
    const storeMock: Partial<jest.Mocked<IdempotencyStore>> = {
      get: jest.fn(),
      claim: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const interceptor = new IdempotencyInterceptor(
      storeMock as unknown as IdempotencyStore
    );

    const handlerBody = { sessionId: 'cs_first', url: 'https://x/cs_first' };
    const responseStub = { statusCode: 200, status: jest.fn() };
    const contextStub = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/v1/stripe/checkout',
          headers: { 'idempotency-key': 'dup-key' },
        }),
        getResponse: () => responseStub,
      }),
    } as never;

    // Duplicate delivery: the key already resolved to a cached response
    // from the first request -- the handler must not run again.
    (storeMock.get as jest.Mock).mockResolvedValue({
      statusCode: 200,
      body: handlerBody,
    });
    const next = { handle: jest.fn() };

    const result$ = await interceptor.intercept(contextStub, next as never);
    const emitted: unknown[] = [];
    result$.subscribe((v) => emitted.push(v));

    expect(next.handle).not.toHaveBeenCalled();
    expect(emitted).toEqual([handlerBody]);
    expect(responseStub.status).toHaveBeenCalledWith(200);
  });
});
