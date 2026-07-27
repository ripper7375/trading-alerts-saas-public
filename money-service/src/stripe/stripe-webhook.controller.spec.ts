/**
 * Stripe Webhook Controller Tests (Session 4A-9, File 4/10, File 9/10)
 */
import { Test } from '@nestjs/testing';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let stripeServiceMock: { constructEvent: jest.Mock };
  let webhookServiceMock: {
    handleCheckoutCompleted: jest.Mock;
    handleSubscriptionUpdated: jest.Mock;
    handleSubscriptionDeleted: jest.Mock;
    handleInvoiceFailed: jest.Mock;
    handleInvoiceSucceeded: jest.Mock;
  };

  const makeRequest = (
    signature: string | undefined
  ): RawBodyRequest<Request> =>
    ({
      rawBody: Buffer.from('{"type":"test"}'),
      headers: signature ? { 'stripe-signature': signature } : {},
    }) as unknown as RawBodyRequest<Request>;

  const makeResponse = (): Response => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  };

  beforeEach(async () => {
    stripeServiceMock = { constructEvent: jest.fn() };
    webhookServiceMock = {
      handleCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionUpdated: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionDeleted: jest.fn().mockResolvedValue(undefined),
      handleInvoiceFailed: jest.fn().mockResolvedValue(undefined),
      handleInvoiceSucceeded: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: StripeWebhookService, useValue: webhookServiceMock },
      ],
    }).compile();

    controller = moduleRef.get(StripeWebhookController);
  });

  it('returns 400 when the stripe-signature header is missing', async () => {
    const response = makeResponse();

    await controller.handleWebhook(makeRequest(undefined), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(stripeServiceMock.constructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when signature verification fails', async () => {
    stripeServiceMock.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('bad-sig'), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('invalid signature'),
      })
    );
  });

  it('routes checkout.session.completed to the service and returns 200', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {} },
    } as unknown as Stripe.Event);
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(webhookServiceMock.handleCheckoutCompleted).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });

  it('routes invoice.payment_succeeded to the service', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event);
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(webhookServiceMock.handleInvoiceSucceeded).toHaveBeenCalled();
  });

  it('acknowledges 200 for an unhandled event type without calling any handler', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'customer.created',
      data: { object: {} },
    } as unknown as Stripe.Event);
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(webhookServiceMock.handleCheckoutCompleted).not.toHaveBeenCalled();
  });

  it('returns 500 when a CRITICAL handler (checkout.session.completed) throws', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {} },
    } as unknown as Stripe.Event);
    webhookServiceMock.handleCheckoutCompleted.mockRejectedValue(
      new Error('db down')
    );
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('returns 500 when a CRITICAL handler (customer.subscription.deleted) throws', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: {} },
    } as unknown as Stripe.Event);
    webhookServiceMock.handleSubscriptionDeleted.mockRejectedValue(
      new Error('db down')
    );
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with a warning when a NON-critical handler throws', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: {} },
    } as unknown as Stripe.Event);
    webhookServiceMock.handleInvoiceFailed.mockRejectedValue(
      new Error('email service down')
    );
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, warning: 'Handler error' })
    );
  });
});
