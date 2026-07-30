import { OutboxEventDto } from './dto/outbox-event.dto';
import { OutboxConsumerController } from './outbox-consumer.controller';
import { OutboxConsumerService } from './outbox-consumer.service';
import { SvcTokenGuard } from './svc-token.guard';

describe('OutboxConsumerController', () => {
  it('delegates to OutboxConsumerService.processEvent', async () => {
    const processEvent = jest.fn().mockResolvedValue({ status: 'processed' });
    const controller = new OutboxConsumerController({
      processEvent,
    } as unknown as OutboxConsumerService);

    const dto = new OutboxEventDto();
    dto.id = 'evt_1';
    dto.aggregateType = 'User';
    dto.aggregateId = 'user_1';
    dto.eventType = 'TIER_DOWNGRADED';
    dto.payload = {};

    const result = await controller.handleEvent(dto);

    expect(processEvent).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ status: 'processed' });
  });

  it('is guarded by SvcTokenGuard', () => {
    const guards: unknown[] = Reflect.getMetadata(
      '__guards__',
      OutboxConsumerController.prototype.handleEvent
    );
    expect(guards).toBeDefined();
    expect(guards[0]).toBe(SvcTokenGuard);
  });
});
