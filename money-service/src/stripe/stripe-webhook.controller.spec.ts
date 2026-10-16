/**
 * Stripe Webhook Controller Tests (Session 4A-9, File 4/10, File 9/10)
 */
import { Test } from '@nestjs/testing';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

import { ProcessedWebhookEventService } from '../webhooks/processed-webhook-event.service';

import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let eventClaimsMock: {
    claim: jest.Mock;
    complete: jest.Mock;
    release: jest.Mock;
  };
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

    eventClaimsMock = {
      claim: jest.fn().mockResolvedValue('claimed'),
      complete: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: StripeWebhookService, useValue: webhookServiceMock },
        { provide: ProcessedWebhookEventService, useValue: eventClaimsMock },
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

  it('returns 500 when invoice.payment_succeeded throws, so Stripe retries a renewal that failed to write (Remediation Tier 2 §6.4)', async () => {
    stripeServiceMock.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event);
    webhookServiceMock.handleInvoiceSucceeded.mockRejectedValue(
      new Error('db down')
    );
    const response = makeResponse();

    await controller.handleWebhook(makeRequest('sig'), response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Webhook handler failed',
    });
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

  // Remediation Tier 2 §6.1: each handled event is claimed once.
  describe('event claims (dual delivery / redelivery)', () => {
    const invoiceEvent = {
      id: 'evt_123',
      type: 'invoice.payment_succeeded',
      data: { object: {} },
    } as unknown as Stripe.Event;

    it('claims the event by its id before the handler runs, and marks it completed afterwards', async () => {
      stripeServiceMock.constructEvent.mockReturnValue(invoiceEvent);
      const response = makeResponse();

      await controller.handleWebhook(makeRequest('sig'), response);

      expect(eventClaimsMock.claim).toHaveBeenCalledWith('stripe', 'evt_123');
      expect(webhookServiceMock.handleInvoiceSucceeded).toHaveBeenCalledTimes(
        1
      );
      expect(eventClaimsMock.complete).toHaveBeenCalledWith(
        'stripe',
        'evt_123'
      );
      expect(eventClaimsMock.release).not.toHaveBeenCalled();
      expect(eventClaimsMock.claim.mock.invocationCallOrder[0]).toBeLessThan(
        webhookServiceMock.handleInvoiceSucceeded.mock
          .invocationCallOrder[0] as number
      );
    });

    it('skips a duplicate: no handler, 200 with duplicate:true, nothing completed or released', async () => {
      stripeServiceMock.constructEvent.mockReturnValue(invoiceEvent);
      eventClaimsMock.claim.mockResolvedValue('duplicate');
      const response = makeResponse();

      await controller.handleWebhook(makeRequest('sig'), response);

      expect(webhookServiceMock.handleInvoiceSucceeded).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        received: true,
        duplicate: true,
      });
      expect(eventClaimsMock.complete).not.toHaveBeenCalled();
      expect(eventClaimsMock.release).not.toHaveBeenCalled();
    });

    it('releases the claim when the handler fails, so the retry is processed', async () => {
      stripeServiceMock.constructEvent.mockReturnValue(invoiceEvent);
      webhookServiceMock.handleInvoiceSucceeded.mockRejectedValue(
        new Error('db down')
      );
      const response = makeResponse();

      await controller.handleWebhook(makeRequest('sig'), response);

      expect(eventClaimsMock.release).toHaveBeenCalledWith('stripe', 'evt_123');
      expect(eventClaimsMock.complete).not.toHaveBeenCalled();
    });

    it("releases the claim BEFORE answering 500 for a critical event, so Stripe's retry finds it free", async () => {
      stripeServiceMock.constructEvent.mockReturnValue({
        id: 'evt_crit',
        type: 'checkout.session.completed',
        data: { object: {} },
      } as unknown as Stripe.Event);
      webhookServiceMock.handleCheckoutCompleted.mockRejectedValue(
        new Error('db down')
      );
      const response = makeResponse();

      await controller.handleWebhook(makeRequest('sig'), response);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(eventClaimsMock.release).toHaveBeenCalledWith(
        'stripe',
        'evt_crit'
      );
      expect(eventClaimsMock.release.mock.invocationCallOrder[0]).toBeLessThan(
        (response.status as jest.Mock).mock.invocationCallOrder[0] as number
      );
    });

    it('still runs the handler, and neither completes nor releases, when the claim table is unavailable', async () => {
      stripeServiceMock.constructEvent.mockReturnValue(invoiceEvent);
      eventClaimsMock.claim.mockResolvedValue('unavailable');
      const response = makeResponse();

      await controller.handleWebhook(makeRequest('sig'), response);

      expect(webhookServiceMock.handleInvoiceSucceeded).toHaveBeenCalledTimes(
        1
      );
      expect(response.status).toHaveBeenCalledWith(200);
      expect(eventClaimsMock.complete).not.toHaveBeenCalled();
      expect(eventClaimsMock.release).not.toHaveBeenCalled();
    });

    it('does not claim an event type it ignores', async () => {
      stripeServiceMock.constructEvent.mockReturnValue({
        id: 'evt_ignored',
        type: 'customer.created',
        data: { object: {} },
      } as unknown as Stripe.Event);
      const response = makeResponse();

      await controller.handleWebhook(makeRequest('sig'), response);

      expect(eventClaimsMock.claim).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });
});
