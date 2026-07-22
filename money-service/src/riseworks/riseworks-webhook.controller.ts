/**
 * RiseWorks Webhook Controller (Session 4A-4, File 3/4)
 *
 * Maps app/api/webhooks/riseworks/route.ts to a NestJS controller. Route
 * path is `/v1/webhooks/riseworks` (main.ts's global `/v1` prefix, F16) — a
 * unique path the RiseWorks dashboard isn't pointed at yet (Safety Gate,
 * this order's own scope note); no live traffic until Session 4A-5 flips
 * the dashboard URL.
 *
 * Receives and processes webhooks from RiseWorks payment provider.
 * Verifies signatures and processes events idempotently.
 */

import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { WebhookVerifier } from '../disbursement/providers/rise/webhook-verifier';
import { WebhookEventProcessorService } from '../disbursement/webhook-event-processor.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhooks/riseworks')
export class RiseworksWebhookController {
  private readonly logger = new Logger(RiseworksWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventProcessor: WebhookEventProcessorService
  ) {}

  @Post()
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response
  ): Promise<void> {
    try {
      const signature = request.headers['x-rise-signature'] as
        | string
        | undefined;
      const payload = request.rawBody?.toString('utf-8') ?? '';

      this.logger.log(
        `Received webhook: hasSignature=${!!signature}, payloadLength=${payload.length}`
      );

      if (!signature) {
        // Log attempt without signature
        await this.prisma.riseWorksWebhookEvent.create({
          data: {
            eventType: 'unknown',
            provider: 'RISE',
            payload: { error: 'Missing signature' },
            verified: false,
            processed: false,
            errorMessage: 'Missing x-rise-signature header',
          },
        });

        response.status(401).json({ error: 'Missing signature' });
        return;
      }

      const webhookSecret = process.env['RISE_WEBHOOK_SECRET'] || '';

      // Allow missing secret in development (for testing)
      if (!webhookSecret && process.env['NODE_ENV'] !== 'development') {
        this.logger.error('RISE_WEBHOOK_SECRET not configured');
        response.status(500).json({ error: 'Webhook secret not configured' });
        return;
      }

      // Verify signature if secret is configured
      if (webhookSecret) {
        const verifier = new WebhookVerifier(webhookSecret);

        if (!verifier.verify(payload, signature)) {
          // Log invalid signature attempt
          let parsedPayload: unknown = { error: 'Invalid JSON' };
          try {
            parsedPayload = JSON.parse(payload);
          } catch {
            // Keep default error payload
          }

          await this.prisma.riseWorksWebhookEvent.create({
            data: {
              eventType: 'unknown',
              provider: 'RISE',
              payload: parsedPayload as Prisma.InputJsonValue,
              signature,
              verified: false,
              processed: false,
              errorMessage: 'Invalid signature',
            },
          });

          response.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Parse webhook payload
      let webhookData: { event?: string; data?: Record<string, unknown> };
      try {
        webhookData = JSON.parse(payload);
      } catch {
        await this.prisma.riseWorksWebhookEvent.create({
          data: {
            eventType: 'parse_error',
            provider: 'RISE',
            payload: { raw: payload.substring(0, 1000) },
            signature,
            verified: false,
            processed: false,
            errorMessage: 'Invalid JSON payload',
          },
        });

        response.status(400).json({ error: 'Invalid JSON' });
        return;
      }

      const eventType = webhookData.event || 'unknown';

      // Store webhook event (idempotent - can insert duplicate events)
      const webhookEvent = await this.prisma.riseWorksWebhookEvent.create({
        data: {
          eventType,
          provider: 'RISE',
          payload: webhookData as Prisma.InputJsonValue,
          signature,
          verified: true,
          processed: false,
        },
      });

      // Process event (idempotent handlers)
      const result = await this.eventProcessor.processEvent({
        event: eventType,
        data: webhookData.data || {},
        timestamp: new Date(),
      });

      // Mark as processed
      await this.prisma.riseWorksWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: result.processed,
          processedAt: new Date(),
          errorMessage: result.processed ? null : result.message,
        },
      });

      response.status(200).json({
        received: true,
        eventId: webhookEvent.id,
        processed: result.processed,
        message: result.message,
      });
    } catch (error) {
      this.logger.error('Webhook processing error:', error);

      // Log the error
      try {
        await this.prisma.riseWorksWebhookEvent.create({
          data: {
            eventType: 'processing_error',
            provider: 'RISE',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            verified: false,
            processed: false,
            errorMessage:
              error instanceof Error ? error.message : 'Processing failed',
          },
        });
      } catch {
        // Ignore logging errors
      }

      response.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
