import { IsObject, IsString } from 'class-validator';

// Mirrors the body money-service's OutboxPublisherCron.deliver() already
// sends (money-service/src/outbox/outbox-publisher.cron.ts:63-107):
// { id, aggregateType, aggregateId, eventType, payload }. eventType is
// intentionally a plain string, not an @IsIn(...) enum -- an unrecognized
// value must reach OutboxConsumerService's own no-op branch (200), not get
// rejected here as a 400, so money-service can add new eventTypes later
// without this DTO needing a matching release first.
export class OutboxEventDto {
  @IsString()
  id!: string;

  @IsString()
  aggregateType!: string;

  @IsString()
  aggregateId!: string;

  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
