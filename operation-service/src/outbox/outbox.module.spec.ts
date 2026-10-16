import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';

import { OutboxConsumerService } from './outbox-consumer.service';
import { OutboxModule } from './outbox.module';

/**
 * Remediation Tier 2 §6.7 gave OutboxConsumerService a RedisService dependency.
 * RedisModule is @Global() and AppModule imports it, so OutboxModule needs no
 * import of its own; this proves Nest resolves it the way AppModule wires it.
 */
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class PrismaStubModule {}

describe('OutboxModule wiring', () => {
  it('resolves OutboxConsumerService with PrismaService and the global RedisService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaStubModule, RedisModule, OutboxModule],
    })
      .overrideProvider(RedisService)
      .useValue({ getClient: () => ({}) })
      .compile();

    expect(moduleRef.get(OutboxConsumerService)).toBeInstanceOf(
      OutboxConsumerService
    );
  });
});
