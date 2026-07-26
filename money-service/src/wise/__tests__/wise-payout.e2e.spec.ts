/**
 * Wise Payout Sandbox E2E Test Suite (Session 4A-W6, File 8/8)
 *
 * Verification method per this order's CONFIRM notes (Davin, live): Sandbox
 * E2E using the `mark-funded` endpoint + valid RSA-signed sandbox test
 * payloads, since live API funding access is read-only-scoped (Waiting-on
 * #47, unresolved) -- the SAME RSA-keypair-substitution technique
 * `wise-webhook.replay.spec.ts` used at 4A-W5 (a locally generated key pair
 * stands in for Wise's published public-key constants via `jest.mock`,
 * signed with the matching private key). This proves the signature
 * verification, `mark-funded`, and the reducer's money-movement guard
 * genuinely compose end-to-end -- it does NOT prove Wise's real Sandbox
 * Simulation API produces byte-identical payloads (same carried-forward gap
 * as 4A-W5's own Deviations).
 *
 * Covers this order's own Test 3: `mark-funded` + webhook reducer event ->
 * `Commission = PAID` and balance updated EXACTLY ONCE.
 */
import { generateKeyPairSync, sign as cryptoSign } from 'crypto';

const mockKeyPair = generateKeyPairSync('rsa', {
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
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';
import { WiseStateMapper } from '../services/wise-state.mapper';
import { WiseTransferStateReducer } from '../services/wise-transfer-state.reducer';
import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';
import { WiseSignatureVerifier } from '../wise-signature.verifier';

function signBody(body: string, privateKey: string): string {
  return cryptoSign('RSA-SHA256', Buffer.from(body), privateKey).toString(
    'base64'
  );
}

function transferStateChangeBody(
  wiseTransferId: number,
  currentState: string,
  occurredAt: string
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

describe('Wise payout sandbox E2E (mark-funded + RSA-signed reducer event)', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let batchGroupService: WiseBatchGroupService;
  let reducer: WiseTransferStateReducer;
  let signatureVerifier: WiseSignatureVerifier;

  const wiseTransfer = {
    id: 'wt-1',
    disbursementTransactionId: 'dtx-1',
    wiseTransferId: '4567890',
    currentState: 'processing',
    lastEventOccurredAt: null,
    balanceAppliedAt: null,
    balanceRevertedAt: null,
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseBatchGroupService,
        WiseStateMapper,
        WiseTransferStateReducer,
        WiseSignatureVerifier,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: jest.fn() } },
        { provide: WiseConfig, useValue: { profileId: '29617748' } },
      ],
    }).compile();

    batchGroupService = moduleRef.get(WiseBatchGroupService);
    reducer = moduleRef.get(WiseTransferStateReducer);
    signatureVerifier = moduleRef.get(WiseSignatureVerifier);
  });

  it('happy path: mark-funded (idempotent, moves no money) then a signed outgoing_payment_sent event marks Commission=PAID and the balance moves exactly once', async () => {
    // Step 1: admin asserts funding (design §6.2 step 6a). Never touches
    // Commission or the balance -- that's the reducer's job below.
    prismaMock.wiseBatchGroup.findUniqueOrThrow.mockResolvedValue({
      id: 'wbg-1',
      status: 'AWAITING_MANUAL_FUNDING',
    } as never);
    prismaMock.wiseBatchGroup.update.mockResolvedValue({
      id: 'wbg-1',
      status: 'FUNDED',
      fundingSource: 'MANUAL_ADMIN',
    } as never);

    const funded = await batchGroupService.markFunded('wbg-1', {
      fundedAt: new Date('2026-07-27T00:00:00Z'),
      bankReference: 'REF-1',
    });
    expect(funded.status).toBe('FUNDED');
    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();

    // Step 2: a real RSA-signed transfers#state-change event, verified with
    // the same signature verifier the live webhook controller uses.
    const body = transferStateChangeBody(
      4567890,
      'outgoing_payment_sent',
      '2026-07-27T01:00:00.000Z'
    );
    const signature = signBody(body, mockKeyPair.privateKey);
    expect(signatureVerifier.verifySignature(body, signature, 'sandbox')).toBe(
      true
    );

    const payload = JSON.parse(body);
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(wiseTransfer as never);
    prismaMock.wiseTransfer.update.mockResolvedValue(wiseTransfer as never);
    prismaMock.disbursementTransaction.update.mockResolvedValue({
      id: 'dtx-1',
      commissionId: 'comm-1',
    } as never);

    // $transaction runs the guarded callback against the same deep-mocked
    // client (jest-mock-extended's mockDeep auto-provides this).
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(fn(prismaMock))
    );
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.wiseTransfer.findUniqueOrThrow.mockResolvedValue(
      wiseTransfer as never
    );
    prismaMock.commission.update.mockResolvedValue({
      id: 'comm-1',
      affiliateProfileId: 'aff-1',
      commissionAmount: 100,
    } as never);
    prismaMock.affiliateProfile.update.mockResolvedValue({} as never);
    prismaMock.wiseWebhookEvent.update.mockResolvedValue({} as never);

    const event = { id: 'evt-1', payload } as never;
    await reducer.reduceTransferEvent(event);

    expect(prismaMock.commission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comm-1' },
        data: expect.objectContaining({ status: 'PAID' }),
      })
    );
    expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'aff-1' },
        data: expect.objectContaining({
          pendingCommissions: { decrement: 100 },
          paidCommissions: { increment: 100 },
        }),
      })
    );

    // Step 3: the SAME event replayed (e.g. reconciliation-cron overlap
    // with a real webhook) must not double-apply the balance -- the guard
    // lives on the row (balanceAppliedAt), not the handler.
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 0 } as never); // already applied
    prismaMock.commission.update.mockClear();
    prismaMock.affiliateProfile.update.mockClear();

    await reducer.reduceTransferEvent(event);

    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
  });

  it('unhappy path: outgoing_payment_sent (PAID) -> bounced_back (no revert, alert only) -> funds_refunded (revert exactly once)', async () => {
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(fn(prismaMock))
    );
    prismaMock.wiseWebhookEvent.update.mockResolvedValue({} as never);
    prismaMock.wiseTransfer.update.mockResolvedValue(wiseTransfer as never);
    prismaMock.wiseTransfer.findUniqueOrThrow.mockResolvedValue(
      wiseTransfer as never
    );
    prismaMock.disbursementTransaction.update.mockResolvedValue({
      id: 'dtx-1',
      commissionId: 'comm-1',
    } as never);
    prismaMock.disbursementTransaction.findUniqueOrThrow.mockResolvedValue({
      id: 'dtx-1',
      commissionId: 'comm-1',
    } as never);

    // Step 1: outgoing_payment_sent -> Commission=PAID (design section 5.2).
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(wiseTransfer as never);
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.commission.update.mockResolvedValue({
      id: 'comm-1',
      affiliateProfileId: 'aff-1',
      commissionAmount: 100,
    } as never);

    const sentBody = transferStateChangeBody(
      4567890,
      'outgoing_payment_sent',
      '2026-07-27T01:00:00.000Z'
    );
    const sentSignature = signBody(sentBody, mockKeyPair.privateKey);
    expect(
      signatureVerifier.verifySignature(sentBody, sentSignature, 'sandbox')
    ).toBe(true);
    await reducer.reduceTransferEvent({
      id: 'evt-sent',
      payload: JSON.parse(sentBody),
    } as never);

    expect(prismaMock.commission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      })
    );

    // Step 2: bounced_back -- Wise says it may still deliver or go to
    // funds_refunded. Design section 5.2: stays PAID, hasActiveIssues=true,
    // admin alert, deliberately NOT reverted here.
    prismaMock.commission.update.mockClear();
    prismaMock.affiliateProfile.update.mockClear();
    const paidTransfer = {
      ...wiseTransfer,
      lastEventOccurredAt: new Date('2026-07-27T01:00:00.000Z'),
      balanceAppliedAt: new Date('2026-07-27T01:00:00.000Z'),
    };
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(paidTransfer as never);

    const bouncedBody = transferStateChangeBody(
      4567890,
      'bounced_back',
      '2026-07-27T02:00:00.000Z'
    );
    const bouncedSignature = signBody(bouncedBody, mockKeyPair.privateKey);
    expect(
      signatureVerifier.verifySignature(
        bouncedBody,
        bouncedSignature,
        'sandbox'
      )
    ).toBe(true);
    await reducer.reduceTransferEvent({
      id: 'evt-bounced',
      payload: JSON.parse(bouncedBody),
    } as never);

    expect(prismaMock.commission.update).not.toHaveBeenCalled(); // left PAID
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();

    // Step 3: funds_refunded -- terminal-unhappy. Revert PAID -> APPROVED,
    // balance reverted exactly once (balanceAppliedAt set, balanceRevertedAt
    // still null -> guard passes).
    const bouncedTransfer = {
      ...paidTransfer,
      lastEventOccurredAt: new Date('2026-07-27T02:00:00.000Z'),
    };
    prismaMock.wiseTransfer.findUnique.mockResolvedValue(
      bouncedTransfer as never
    );

    const refundedBody = transferStateChangeBody(
      4567890,
      'funds_refunded',
      '2026-07-27T03:00:00.000Z'
    );
    const refundedSignature = signBody(refundedBody, mockKeyPair.privateKey);
    expect(
      signatureVerifier.verifySignature(
        refundedBody,
        refundedSignature,
        'sandbox'
      )
    ).toBe(true);
    const refundedEvent = {
      id: 'evt-refunded',
      payload: JSON.parse(refundedBody),
    } as never;
    await reducer.reduceTransferEvent(refundedEvent);

    expect(prismaMock.commission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comm-1' },
        data: expect.objectContaining({ status: 'APPROVED', paidAt: null }),
      })
    );
    expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingCommissions: { increment: 100 },
          paidCommissions: { decrement: 100 },
        }),
      })
    );

    // Step 4: replaying the SAME funds_refunded event again must not
    // double-revert -- the guard lives on the row (balanceRevertedAt), not
    // the handler.
    prismaMock.commission.update.mockClear();
    prismaMock.affiliateProfile.update.mockClear();
    prismaMock.wiseTransfer.updateMany.mockResolvedValue({ count: 0 } as never); // already reverted
    await reducer.reduceTransferEvent(refundedEvent);

    expect(prismaMock.commission.update).not.toHaveBeenCalled();
    expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();

    // KNOWN GAP (flagged, not fixed -- see this order's Deviations): design
    // section 10's own testing-strategy line for this exact scenario says
    // "assert revert exactly once, recipient -> INVALID". No code anywhere
    // in wise-transfer-state.reducer.ts or wise-event-handlers.ts touches
    // AffiliateWiseRecipient.status on any transfer state change -- this
    // was never built in 4A-W5 or 4A-W6. Asserting the REAL (gap-having)
    // behavior here, not the design doc's aspirational one.
    expect(prismaMock.affiliateWiseRecipient.update).not.toHaveBeenCalled();
  });
});
