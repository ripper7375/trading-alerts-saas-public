/**
 * RiseWorks Webhook Controller (Session 4A-4, File 3/4), ARCHIVED (F42)
 *
 * Route path is `/v1/webhooks/riseworks` (main.ts's global `/v1` prefix, F16).
 * RiseWorks payouts were replaced by Wise (Part 19.5), so this route no longer
 * accepts webhooks: every request gets 410 Gone, the body is never read and
 * the database is never touched. The former handler is preserved, with its
 * body unchanged, in archived-riseworks-webhook.handler.ts (F42: nothing
 * RiseWorks-related is deleted).
 */

import { Controller, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

@Controller('webhooks/riseworks')
export class RiseworksWebhookController {
  // Session 4A-8, Step 4 (CC-D audit): this route had no per-route
  // override, relying on the app-wide ThrottlerGuard default (100 req/60s)
  // -- the same gap 4A-W4 fixed on the dLocal webhook (a legitimate
  // provider retry burst gets 429'd and read as a permanent delivery
  // failure) and the standing policy that fix established for "all future
  // payment-provider webhooks." Zero live-traffic risk either way (route
  // archived/dormant per F42, dashboard still pointed at the monolith).
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @Post()
  handleWebhook(@Res() response: Response): void {
    response
      .status(410)
      .json({ error: 'RiseWorks webhook endpoint is archived' });
  }
}
