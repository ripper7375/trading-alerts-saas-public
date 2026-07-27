/**
 * Session 4A-W4 (Defect 2, plan §13 CC-D) — proves the route-level
 * @Throttle({ default: { ttl: 60_000, limit: 300 } }) on
 * DlocalWebhookController.handleWebhook actually raises this route's
 * ceiling above the app-wide ThrottlerGuard default (app.module.ts,
 * { ttl: 60000, limit: 100 }), rather than asserting it via reasoning
 * alone — a real HTTP burst against a real Nest app + real ThrottlerGuard.
 *
 * Control group: a sibling route with NO route-level override, wired to
 * the SAME global default, in the SAME test app — this proves the global
 * cap really is 100 and really is enforced in this test environment (so a
 * "zero 429s" result on the dLocal route isn't just throttling being
 * silently inert), while the dLocal route tolerates a burst well past 100.
 */
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import request from 'supertest';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { DlocalWebhookController } from './dlocal-webhook.controller';
import { ThreeDayValidatorService } from './three-day-validator.service';

jest.mock('./dlocal-payment.service', () => ({
  ...jest.requireActual('./dlocal-payment.service'),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
}));

// Undecorated sibling controller — same global default applies, no
// per-route override. Fast, dependency-free handler so this is purely a
// throttling control, not a second business-logic test.
@Controller('control')
class UnthrottledControlController {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
  ],
  controllers: [DlocalWebhookController, UnthrottledControlController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: PrismaService, useValue: createPrismaMock() },
    {
      provide: ThreeDayValidatorService,
      useValue: { markThreeDayPlanUsed: jest.fn() },
    },
    {
      provide: ConversionProcessorService,
      useValue: { processAffiliateConversion: jest.fn() },
    },
    {
      provide: OutboxService,
      useValue: { recordInTransaction: jest.fn().mockResolvedValue(undefined) },
    },
  ],
})
class ThrottleTestModule {}

describe('dLocal webhook route-level throttle override (4A-W4 Defect 2)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottleTestModule],
    }).compile();

    // rawBody: true mirrors main.ts's real NestFactory.create() option —
    // handleWebhook reads request.rawBody for signature verification.
    // Without it every request here would 400 on "Invalid webhook
    // payload" before ever reaching the guard's throttling decision.
    app = moduleRef.createNestApplication({ rawBody: true });
    prismaMock = app.get(PrismaService);
    // Fastest real code path through handleWebhook: signature verifies,
    // payment lookup misses -> early 200. Business logic is already fully
    // covered by dlocal-webhook.controller.spec.ts; this file only cares
    // about the guard's decision to admit or reject the request.
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const webhookPayload = JSON.stringify({
    id: 'throttle-test',
    status: 'PAID',
    order_id: 'order-throttle-test',
  });

  // Sequential, not Promise.all: ThrottlerGuard counts requests within a
  // TTL window regardless of concurrency, and a real dLocal retry burst
  // arrives one delivery at a time anyway — sequential also avoids
  // overwhelming the ephemeral test server's socket pool (concurrent
  // bursts of 150 caused spurious ECONNRESET unrelated to throttling).
  it('control: the plain global default (limit 100) DOES reject a 150-request burst', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 150; i++) {
      const res = await request(app.getHttpServer()).get('/control');
      statuses.push(res.status);
    }

    const throttled = statuses.filter((s) => s === 429).length;

    expect(throttled).toBeGreaterThan(0);
  });

  it('the dLocal webhook route (limit 300 override) admits a 150-request burst with zero 429s', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 150; i++) {
      const res = await request(app.getHttpServer())
        .post('/webhooks/dlocal')
        .set('authorization', 'V2-HMAC-SHA256, Signature: valid-signature')
        .set('x-date', '2026-07-26T00:00:00.000Z')
        .set('x-login', 'test-merchant-login')
        .set('content-type', 'application/json')
        .send(webhookPayload);
      statuses.push(res.status);
    }

    const throttled = statuses.filter((s) => s === 429).length;

    expect(throttled).toBe(0);
    // Sanity: every request actually reached the handler (200, the
    // payment-not-found fast path), not silently failing some other way.
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});
