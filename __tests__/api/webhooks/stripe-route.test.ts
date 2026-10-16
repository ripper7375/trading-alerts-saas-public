/**
 * POST /api/webhooks/stripe (Remediation Tier 2 §6.1): each handled event is
 * claimed once, so a redelivery, or the same event arriving at money-service's
 * endpoint too (4A-13 dual delivery), does not repeat the handler.
 */

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
  NextRequest: class {},
}));

let mockSignature: string | null = 'sig';
jest.mock('next/headers', () => ({
  __esModule: true,
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === 'stripe-signature' ? mockSignature : null,
  }),
}));

const mockConstructWebhookEvent = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  constructWebhookEvent: (...args: unknown[]) =>
    mockConstructWebhookEvent(...args),
}));

const mockHandlers = {
  handleCheckoutCompleted: jest.fn(),
  handleSubscriptionUpdated: jest.fn(),
  handleSubscriptionDeleted: jest.fn(),
  handleInvoiceFailed: jest.fn(),
  handleInvoiceSucceeded: jest.fn(),
  handleChargeRefunded: jest.fn(),
  handleChargeDisputeCreated: jest.fn(),
};
jest.mock('@/lib/stripe/webhook-handlers', () => ({
  __esModule: true,
  handleCheckoutCompleted: (...a: unknown[]) =>
    mockHandlers.handleCheckoutCompleted(...a),
  handleSubscriptionUpdated: (...a: unknown[]) =>
    mockHandlers.handleSubscriptionUpdated(...a),
  handleSubscriptionDeleted: (...a: unknown[]) =>
    mockHandlers.handleSubscriptionDeleted(...a),
  handleInvoiceFailed: (...a: unknown[]) =>
    mockHandlers.handleInvoiceFailed(...a),
  handleInvoiceSucceeded: (...a: unknown[]) =>
    mockHandlers.handleInvoiceSucceeded(...a),
  handleChargeRefunded: (...a: unknown[]) =>
    mockHandlers.handleChargeRefunded(...a),
  handleChargeDisputeCreated: (...a: unknown[]) =>
    mockHandlers.handleChargeDisputeCreated(...a),
}));

const mockClaim = jest.fn();
const mockComplete = jest.fn();
const mockRelease = jest.fn();
jest.mock('@/lib/webhooks/processed-event', () => ({
  __esModule: true,
  claimEvent: (...a: unknown[]) => mockClaim(...a),
  completeEvent: (...a: unknown[]) => mockComplete(...a),
  releaseEvent: (...a: unknown[]) => mockRelease(...a),
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const request = { text: async () => '{"raw":"body"}' } as never;

function event(type: string, id = 'evt_123') {
  return { id, type, data: { object: { marker: type } } };
}

async function call(): Promise<{ status: number; body: unknown }> {
  const response = await POST(request);
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('POST /api/webhooks/stripe', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    mockSignature = 'sig';
    mockClaim.mockResolvedValue('claimed');
    mockComplete.mockResolvedValue(undefined);
    mockRelease.mockResolvedValue(undefined);
    for (const handler of Object.values(mockHandlers)) {
      handler.mockResolvedValue(undefined);
    }
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects a request without a signature before claiming anything', async () => {
    mockSignature = null;

    const result = await call();

    expect(result.status).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('rejects a bad signature before claiming anything', async () => {
    mockConstructWebhookEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const result = await call();

    expect(result.status).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('claims the event by its id, runs the handler, and marks it completed', async () => {
    mockConstructWebhookEvent.mockReturnValue(
      event('invoice.payment_succeeded')
    );

    const result = await call();

    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(mockClaim).toHaveBeenCalledWith('stripe', 'evt_123');
    expect(mockHandlers.handleInvoiceSucceeded).toHaveBeenCalledWith({
      marker: 'invoice.payment_succeeded',
    });
    expect(mockComplete).toHaveBeenCalledWith('stripe', 'evt_123');
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockClaim.mock.invocationCallOrder[0]).toBeLessThan(
      mockHandlers.handleInvoiceSucceeded.mock.invocationCallOrder[0] as number
    );
  });

  it.each([
    ['checkout.session.completed', 'handleCheckoutCompleted'],
    ['customer.subscription.updated', 'handleSubscriptionUpdated'],
    ['customer.subscription.deleted', 'handleSubscriptionDeleted'],
    ['invoice.payment_failed', 'handleInvoiceFailed'],
    ['invoice.payment_succeeded', 'handleInvoiceSucceeded'],
    ['charge.refunded', 'handleChargeRefunded'],
    ['charge.dispute.created', 'handleChargeDisputeCreated'],
  ] as const)('routes %s to %s', async (type, handlerName) => {
    mockConstructWebhookEvent.mockReturnValue(event(type));

    await call();

    expect(mockHandlers[handlerName]).toHaveBeenCalledTimes(1);
  });

  it('skips a duplicate: no handler, 200 with duplicate:true, nothing completed or released', async () => {
    mockConstructWebhookEvent.mockReturnValue(
      event('invoice.payment_succeeded')
    );
    mockClaim.mockResolvedValue('duplicate');

    const result = await call();

    expect(result).toEqual({
      status: 200,
      body: { received: true, duplicate: true },
    });
    expect(mockHandlers.handleInvoiceSucceeded).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('releases the claim, then answers 500, when a CRITICAL handler fails (Stripe retries)', async () => {
    mockConstructWebhookEvent.mockReturnValue(
      event('checkout.session.completed', 'evt_crit')
    );
    mockHandlers.handleCheckoutCompleted.mockRejectedValue(
      new Error('db down')
    );

    const result = await call();

    expect(result.status).toBe(500);
    expect(mockRelease).toHaveBeenCalledWith('stripe', 'evt_crit');
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('releases the claim and answers 200 with a warning when a NON-critical handler fails', async () => {
    mockConstructWebhookEvent.mockReturnValue(event('invoice.payment_failed'));
    mockHandlers.handleInvoiceFailed.mockRejectedValue(new Error('email down'));

    const result = await call();

    expect(result).toEqual({
      status: 200,
      body: { received: true, warning: 'Handler error' },
    });
    expect(mockRelease).toHaveBeenCalledWith('stripe', 'evt_123');
  });

  it('still runs the handler, and neither completes nor releases, when the claim table is unavailable', async () => {
    mockConstructWebhookEvent.mockReturnValue(
      event('invoice.payment_succeeded')
    );
    mockClaim.mockResolvedValue('unavailable');

    const result = await call();

    expect(result.status).toBe(200);
    expect(mockHandlers.handleInvoiceSucceeded).toHaveBeenCalledTimes(1);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('does not claim an event type it ignores', async () => {
    mockConstructWebhookEvent.mockReturnValue(event('customer.created'));

    const result = await call();

    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(mockClaim).not.toHaveBeenCalled();
  });
});
