/**
 * Outbox Consumer Controller (Session 4A-11, File 3/5)
 *
 * POST /v1/outbox/events -- receives money-service's OutboxPublisherCron
 * delivery calls. Guarded by SvcTokenGuard (File 2); global ValidationPipe
 * (main.ts) enforces OutboxEventDto's shape before this handler ever runs.
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { OutboxEventDto } from './dto/outbox-event.dto';
import {
  OutboxConsumerService,
  OutboxProcessResult,
} from './outbox-consumer.service';
import { SvcTokenGuard } from './svc-token.guard';

@Controller('outbox')
export class OutboxConsumerController {
  constructor(private readonly outboxConsumer: OutboxConsumerService) {}

  @UseGuards(SvcTokenGuard)
  @Post('events')
  async handleEvent(@Body() dto: OutboxEventDto): Promise<OutboxProcessResult> {
    return this.outboxConsumer.processEvent(dto);
  }
}
