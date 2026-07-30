import { Module } from '@nestjs/common';

import { OutboxConsumerController } from './outbox-consumer.controller';
import { OutboxConsumerService } from './outbox-consumer.service';

@Module({
  controllers: [OutboxConsumerController],
  providers: [OutboxConsumerService],
})
export class OutboxModule {}
