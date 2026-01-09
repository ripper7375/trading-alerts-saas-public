/**
 * RiseWorks Webhook Handler (Part 19C)
 *
 * POST /api/webhooks/riseworks
 *
 * Receives and processes webhooks from RiseWorks payment provider.
 * Verifies signatures and processes events idempotently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { WebhookVerifier } from '@/lib/disbursement/providers/rise/webhook-verifier';
import { WebhookEventProcessor } from '@/lib/disbursement/webhook/event-processor';

/**
 * Handle incoming RiseWorks webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const signature = request.headers.get('x-rise-signature');
    const payload = await request.text();

    // Log webhook receipt for debugging
    console.log('Received webhook:', {
      hasSignature: !!signature,
      payloadLength: payload.length,
    });

    if (!signature) {
      // Log attempt without signature
      await prisma.riseWorksWebhookEvent.create({
        data: {
          eventType: 'unknown',
          provider: 'RISE',
          payload: { error: 'Missing signature' },
          verified: false,
          processed: false,
          errorMessage: 'Missing x-rise-signature header',
        },
      });

      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const webhookSecret = process.env['RISE_WEBHOOK_SECRET'] || '';

    // Allow missing secret in development (for testing)
    if (!webhookSecret && process.env['NODE_ENV'] !== 'development') {
      console.error('RISE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
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

        await prisma.riseWorksWebhookEvent.create({
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

        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse webhook payload
    let webhookData: { event?: string; data?: Record<string, unknown> };
    try {
      webhookData = JSON.parse(payload);
    } catch {
      await prisma.riseWorksWebhookEvent.create({
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

      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = webhookData.event || 'unknown';

    // Store webhook event (idempotent - can insert duplicate events)
    const webhookEvent = await prisma.riseWorksWebhookEvent.create({
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
    const processor = new WebhookEventProcessor(prisma);
    const result = await processor.processEvent({
      event: eventType,
      data: webhookData.data || {},
      timestamp: new Date(),
    });

    // Mark as processed
    await prisma.riseWorksWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: result.processed,
        processedAt: new Date(),
        errorMessage: result.processed ? null : result.message,
      },
    });

    return NextResponse.json({
      received: true,
      eventId: webhookEvent.id,
      processed: result.processed,
      message: result.message,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);

    // Log the error
    try {
      await prisma.riseWorksWebhookEvent.create({
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

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
