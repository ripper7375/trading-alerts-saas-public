/**
 * Wise Webhook Receiver Controller (Session 4A-W5, File 4/8)
 *
 * `POST /v1/webhooks/wise` — store-then-process (design §5.5): verify,
 * persist, enqueue, return 200 in < 500ms against Wise's 5s budget. No
 * guard — the RSA signature IS the authentication (design §7.5).
 *
 * Throttle: explicit `@Throttle({ default: { ttl: 60_000, limit: 300 } })`,
 * NOT `@SkipThrottle()`. Design §7.5 was corrected 2026-07-25 (rev 2) after
 * this session's own order text was drafted: `@SkipThrottle()` removes the
 * rate-limit ceiling entirely, trading a throttling fault for a flooding
 * fault. This mirrors `/v1/webhooks/dlocal`'s policy exactly
 * (`dlocal-webhook.controller.ts`, 4A-W4) and `LESSONS-LEARNED.md` L26 —
 * see this order's Deviations.
 */

import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Request, Response } from 'express';

import { logger } from '../../common/logger.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WISE_WEBHOOK_QUEUE } from '../queue/wise-webhook.processor';
import { WiseConfig } from '../wise.config';
import { WiseSignatureVerifier } from '../wise-signature.verifier';
import type {
  WisePayoutFailureData,
  WiseTransferStateChangeData,
  WiseWebhookEnvelope,
} from '../wise.types';

const SIGNATURE_HEADER = 'x-signature-sha256';
const DELIVERY_ID_HEADER = 'x-delivery-id';
const TEST_NOTIFICATION_HEADER = 'x-test-notification';

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Controller('webhooks/wise')
export class WiseWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseConfig: WiseConfig,
    private readonly signatureVerifier: WiseSignatureVerifier,
    @InjectQueue(WISE_WEBHOOK_QUEUE) private readonly queue: Queue
  ) {}

  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ status: string; duplicated?: boolean }> {
    const rawBody = request.rawBody ?? Buffer.from('');
    const signature = (request.headers[SIGNATURE_HEADER] as string) || '';
    const deliveryId = (request.headers[DELIVERY_ID_HEADER] as string) || '';
    const isTestNotification =
      (request.headers[TEST_NOTIFICATION_HEADER] as string) === 'true';

    const signatureVerified = this.signatureVerifier.verifySignature(
      rawBody,
      signature,
      this.wiseConfig.environment
    );

    if (!signatureVerified) {
      logger.warn('Wise webhook signature verification failed', {
        deliveryId,
      });
      await this.persistBestEffort({
        deliveryId,
        rawSignature: signature,
        signatureVerified: false,
        isTestNotification,
        skippedReason: 'invalid-signature',
        payload: {},
        eventType: 'unknown',
      });
      response.status(401);
      return { status: 'unauthorized' };
    }

    let envelope: WiseWebhookEnvelope;
    try {
      envelope = JSON.parse(rawBody.toString('utf-8')) as WiseWebhookEnvelope;
    } catch {
      logger.error('Wise webhook body is not valid JSON', { deliveryId });
      await this.persistBestEffort({
        deliveryId,
        rawSignature: signature,
        signatureVerified: true,
        isTestNotification,
        skippedReason: 'invalid-json',
        payload: {},
        eventType: 'unknown',
      });
      response.status(400);
      return { status: 'invalid-json' };
    }

    if (!deliveryId) {
      // Hard Invariant #1's dedupe guarantee depends entirely on this
      // header. Without it we cannot safely persist (deliveryId is
      // @unique, non-nullable) or dedupe — treat as a malformed request
      // rather than silently generating a fake key.
      logger.error('Wise webhook missing X-Delivery-Id, cannot dedupe', {
        eventType: envelope.event_type,
      });
      response.status(400);
      return { status: 'missing-delivery-id' };
    }

    const denormalized = this.denormalize(envelope);

    if (isTestNotification) {
      await this.persistBestEffort({
        deliveryId,
        rawSignature: signature,
        signatureVerified: true,
        isTestNotification: true,
        payload: envelope as unknown as Record<string, unknown>,
        eventType: envelope.event_type,
        processedImmediately: true,
        ...denormalized,
      });
      return { status: 'ok' };
    }

    let created;
    try {
      created = await this.prisma.wiseWebhookEvent.create({
        data: {
          deliveryId,
          subscriptionId: envelope.subscription_id ?? null,
          eventType: envelope.event_type,
          schemaVersion: envelope.schema_version ?? null,
          sentAt: envelope.sent_at ? new Date(envelope.sent_at) : null,
          payload: envelope as unknown as Prisma.InputJsonValue,
          rawSignature: signature,
          signatureVerified: true,
          isTestNotification: false,
          ...denormalized,
        },
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        logger.info('Wise webhook duplicate delivery, not re-queuing', {
          deliveryId,
        });
        return { status: 'ok', duplicated: true };
      }
      throw error;
    }

    await this.queue.add(
      'wise-webhook-event',
      { webhookEventId: created.id },
      {
        jobId: `wise:event:${deliveryId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    return { status: 'ok' };
  }

  private denormalize(envelope: WiseWebhookEnvelope): {
    resourceType: string | null;
    wiseResourceId: string | null;
    currentState: string | null;
    previousState: string | null;
    occurredAt: Date | null;
  } {
    if (envelope.event_type === 'transfers#state-change') {
      const data = envelope.data as WiseTransferStateChangeData;
      return {
        resourceType: data?.resource?.type ?? null,
        wiseResourceId:
          data?.resource?.id !== undefined ? String(data.resource.id) : null,
        currentState: data?.current_state ?? null,
        previousState: data?.previous_state ?? null,
        occurredAt: data?.occurred_at ? new Date(data.occurred_at) : null,
      };
    }
    if (envelope.event_type === 'transfers#payout-failure') {
      const data = envelope.data as WisePayoutFailureData;
      return {
        resourceType: 'transfer',
        wiseResourceId:
          data?.transfer_id !== undefined ? String(data.transfer_id) : null,
        currentState: null,
        previousState: null,
        occurredAt: data?.occurred_at ? new Date(data.occurred_at) : null,
      };
    }
    return {
      resourceType: null,
      wiseResourceId: null,
      currentState: null,
      previousState: null,
      occurredAt: null,
    };
  }

  /** Best-effort persistence for the 401/400/test-notification paths —
   * never lets a persistence failure change the HTTP response Wise sees. */
  private async persistBestEffort(params: {
    deliveryId: string;
    rawSignature: string;
    signatureVerified: boolean;
    isTestNotification: boolean;
    payload: Record<string, unknown>;
    eventType: string;
    skippedReason?: string;
    processedImmediately?: boolean;
    resourceType?: string | null;
    wiseResourceId?: string | null;
    currentState?: string | null;
    previousState?: string | null;
    occurredAt?: Date | null;
  }): Promise<void> {
    if (!params.deliveryId) return;
    try {
      await this.prisma.wiseWebhookEvent.create({
        data: {
          deliveryId: params.deliveryId,
          eventType: params.eventType,
          payload: params.payload as Prisma.InputJsonValue,
          rawSignature: params.rawSignature,
          signatureVerified: params.signatureVerified,
          isTestNotification: params.isTestNotification,
          processed: Boolean(
            params.skippedReason || params.processedImmediately
          ),
          processedAt:
            params.skippedReason || params.processedImmediately
              ? new Date()
              : null,
          skippedReason: params.skippedReason ?? null,
          resourceType: params.resourceType ?? null,
          wiseResourceId: params.wiseResourceId ?? null,
          currentState: params.currentState ?? null,
          previousState: params.previousState ?? null,
          occurredAt: params.occurredAt ?? null,
        },
      });
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        logger.error('Failed to persist Wise webhook event', {
          deliveryId: params.deliveryId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
}
