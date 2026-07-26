/**
 * Wise Webhook Replay Test Suite (Session 4A-W5, File 8/8)
 *
 * Verification method per this order's own Deviations (Davin, live,
 * Option 2): "valid RSA-signed sandbox test payloads" hand-constructed
 * using the SAME RSA-keypair-substitution pattern
 * `wise-signature.verifier.spec.ts` already uses (4A-W3a) — a locally
 * generated key pair stands in for Wise's published public-key constants
 * via `jest.mock`, signed with the matching private key. This proves the
 * signature-verification, persistence, dedupe, and enqueue code paths
 * genuinely — it does NOT prove Wise's real Sandbox Simulation API
 * produces byte-identical payloads (that gap needs a write-scoped sandbox
 * token, same ask as Waiting-on #47; carried forward, not blocking this
 * session per Davin's live call).
 *
 * Test-notification handling deliberately asserts a DB write happens (a
 * `WiseWebhookEvent` row IS persisted) — design §5.5 step 3 says "persist,
 * mark processed, 200, do nothing else." This order's own File 8/8
 * description and Done-when list say "without DB write," which contradicts
 * the ground truth; ground truth governs (see this order's Deviations).
 */
import { generateKeyPairSync, sign as cryptoSign } from 'crypto';

const mockKeyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const mockWrongKeyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('../wise-signature.constants', () => ({
  __esModule: true,
  WISE_SANDBOX_PUBLIC_KEY_PEM: mockKeyPair.publicKey,
  WISE_PRODUCTION_PUBLIC_KEY_PEM: mockKeyPair.publicKey,
}));

// eslint-disable-next-line import/order
import type { RawBodyRequest } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseWebhookController } from '../controllers/wise-webhook.controller';
import { WISE_WEBHOOK_QUEUE } from '../queue/wise-webhook.processor';
import { WiseStateMapper } from '../services/wise-state.mapper';
import { WiseTransferStateReducer } from '../services/wise-transfer-state.reducer';
import { WiseConfig } from '../wise.config';
import { WiseSignatureVerifier } from '../wise-signature.verifier';

function signBody(body: string, privateKey: string): string {
  return cryptoSign('RSA-SHA256', Buffer.from(body), privateKey).toString(
    'base64'
  );
}

function mockRequest(
  body: string,
  headers: Record<string, string>
): RawBodyRequest<Request> {
  return {
    rawBody: Buffer.from(body, 'utf-8'),
    headers,
  } as unknown as RawBodyRequest<Request>;
}

function mockResponse(): Response {
  const response = {} as Response;
  response.status = jest.fn().mockReturnValue(response);
  return response;
}

function transferStateChangeBody(
  currentState: string,
  occurredAt: string,
  wiseTransferId = 555
): string {
  return JSON.stringify({
    event_type: 'transfers#state-change',
    schema_version: '4.0.0',
    data: {
      resource: { type: 'transfer', id: wiseTransferId },
      current_state: currentState,
      previous_state: null,
      occurred_at: occurredAt,
    },
  });
}

describe('Wise webhook replay (WiseWebhookController, RSA-signed sandbox test payloads)', () => {
  let controller: WiseWebhookController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let queueMock: { add: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    queueMock = { add: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [WiseWebhookController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseConfig, useValue: { environment: 'sandbox' } },
        WiseSignatureVerifier,
        { provide: getQueueToken(WISE_WEBHOOK_QUEUE), useValue: queueMock },
      ],
    }).compile();

    controller = moduleRef.get(WiseWebhookController);
  });

  it('a valid RSA-signed payload verifies, persists, and enqueues with jobId=wise:event:<deliveryId>', async () => {
    const body = transferStateChangeBody(
      'processing',
      '2026-07-26T10:00:00.000Z'
    );
    const signature = signBody(body, mockKeyPair.privateKey);
    prismaMock.wiseWebhookEvent.create.mockResolvedValue({
      id: 'evt-1',
    } as never);

    const result = await controller.handleWebhook(
      mockRequest(body, {
        'x-signature-sha256': signature,
        'x-delivery-id': 'delivery-1',
      }),
      mockResponse()
    );

    expect(result).toEqual({ status: 'ok' });
    expect(prismaMock.wiseWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryId: 'delivery-1',
          eventType: 'transfers#state-change',
          signatureVerified: true,
          currentState: 'processing',
          wiseResourceId: '555',
        }),
      })
    );
    expect(queueMock.add).toHaveBeenCalledWith(
      'wise-webhook-event',
      { webhookEventId: 'evt-1' },
      expect.objectContaining({ jobId: 'wise:event:delivery-1' })
    );
  });

  it('a full processing -> outgoing_payment_sent replay enqueues both events and the reducer applies Commission.PAID exactly once', async () => {
    const firstBody = transferStateChangeBody(
      'processing',
      '2026-07-26T10:00:00.000Z'
    );
    const secondBody = transferStateChangeBody(
      'outgoing_payment_sent',
      '2026-07-26T10:00:10.000Z'
    );

    prismaMock.wiseWebhookEvent.create
      .mockResolvedValueOnce({ id: 'evt-processing' } as never)
      .mockResolvedValueOnce({ id: 'evt-completed' } as never);

    await controller.handleWebhook(
      mockRequest(firstBody, {
        'x-signature-sha256': signBody(firstBody, mockKeyPair.privateKey),
        'x-delivery-id': 'delivery-processing',
      }),
      mockResponse()
    );
    await controller.handleWebhook(
      mockRequest(secondBody, {
        'x-signature-sha256': signBody(secondBody, mockKeyPair.privateKey),
        'x-delivery-id': 'delivery-completed',
      }),
      mockResponse()
    );

    expect(queueMock.add).toHaveBeenCalledTimes(2);

    // Simulate the queue draining: feed the persisted "outgoing_payment_sent"
    // event through the real reducer against the same mocked Prisma.
    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseTransferStateReducer,
        WiseStateMapper,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const reducer = moduleRef.get(WiseTransferStateReducer);

    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    prismaMock.wiseTransfer.findUnique.mockResolvedValue({
      id: 'wt-1',
      disbursementTransactionId: 'dt-1',
      wiseTransferId: '555',
      currentState: 'processing',
      lastEventOccurredAt: new Date('2026-07-26T10:00:00.000Z'),
      balanceAppliedAt: null,
      balanceRevertedAt: null,
    } as never);
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.wiseTransfer.findUniqueOrThrow.mockResolvedValue({
      id: 'wt-1',
      disbursementTransactionId: 'dt-1',
    } as never);
    prismaMock.disbursementTransaction.update.mockResolvedValue({
      id: 'dt-1',
      commissionId: 'comm-1',
    } as never);
    prismaMock.commission.update.mockResolvedValue({
      id: 'comm-1',
      affiliateProfileId: 'aff-1',
      commissionAmount: 100,
    } as never);

    await reducer.reduceTransferEvent({
      id: 'evt-completed',
      payload: JSON.parse(secondBody),
    } as never);

    expect(prismaMock.commission.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    });

    // Replay the identical event again — at-most-once guard must hold.
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.commission.update.mockClear();
    await reducer.reduceTransferEvent({
      id: 'evt-completed',
      payload: JSON.parse(secondBody),
    } as never);
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
  });

  it('a tampered payload fails signature verification, returns 401, and is persisted with signatureVerified=false', async () => {
    const body = transferStateChangeBody(
      'processing',
      '2026-07-26T10:00:00.000Z'
    );
    // Signed with the WRONG key — the mocked public key constant can never
    // verify it.
    const signature = signBody(body, mockWrongKeyPair.privateKey);
    const response = mockResponse();
    prismaMock.wiseWebhookEvent.create.mockResolvedValue({} as never);

    const result = await controller.handleWebhook(
      mockRequest(body, {
        'x-signature-sha256': signature,
        'x-delivery-id': 'delivery-tampered',
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(result).toEqual({ status: 'unauthorized' });
    expect(prismaMock.wiseWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryId: 'delivery-tampered',
          signatureVerified: false,
          skippedReason: 'invalid-signature',
        }),
      })
    );
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('a replayed duplicate X-Delivery-Id returns 200 duplicated without a second queue job or balance change', async () => {
    const body = transferStateChangeBody(
      'outgoing_payment_sent',
      '2026-07-26T10:00:00.000Z'
    );
    const signature = signBody(body, mockKeyPair.privateKey);

    prismaMock.wiseWebhookEvent.create
      .mockResolvedValueOnce({ id: 'evt-1' } as never)
      .mockRejectedValueOnce({ code: 'P2002' });

    const first = await controller.handleWebhook(
      mockRequest(body, {
        'x-signature-sha256': signature,
        'x-delivery-id': 'delivery-dup',
      }),
      mockResponse()
    );
    const second = await controller.handleWebhook(
      mockRequest(body, {
        'x-signature-sha256': signature,
        'x-delivery-id': 'delivery-dup',
      }),
      mockResponse()
    );

    expect(first).toEqual({ status: 'ok' });
    expect(second).toEqual({ status: 'ok', duplicated: true });
    expect(queueMock.add).toHaveBeenCalledTimes(1);
  });

  it('an X-Test-Notification: true ping is persisted and marked processed immediately, without enqueuing', async () => {
    const body = JSON.stringify({
      event_type: 'transfers#state-change',
      schema_version: '4.0.0',
      data: {},
    });
    const signature = signBody(body, mockKeyPair.privateKey);
    prismaMock.wiseWebhookEvent.create.mockResolvedValue({} as never);

    const result = await controller.handleWebhook(
      mockRequest(body, {
        'x-signature-sha256': signature,
        'x-delivery-id': 'delivery-test-ping',
        'x-test-notification': 'true',
      }),
      mockResponse()
    );

    expect(result).toEqual({ status: 'ok' });
    expect(prismaMock.wiseWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryId: 'delivery-test-ping',
          isTestNotification: true,
          processed: true,
        }),
      })
    );
    expect(queueMock.add).not.toHaveBeenCalled();
  });
});
