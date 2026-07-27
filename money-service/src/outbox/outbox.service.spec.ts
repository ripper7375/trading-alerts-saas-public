import { createPrismaMock } from '../test-utils/prisma-mock';

import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    service = new OutboxService();
    prismaMock = createPrismaMock();
  });

  it('writes an OutboxEvent row via the given transaction client', async () => {
    prismaMock.outboxEvent.create.mockResolvedValue({} as never);

    await service.recordInTransaction(prismaMock, {
      aggregateType: 'User',
      aggregateId: 'user-123',
      eventType: 'TIER_UPGRADED',
      payload: { tier: 'PRO' },
    });

    expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        aggregateType: 'User',
        aggregateId: 'user-123',
        eventType: 'TIER_UPGRADED',
        payload: { tier: 'PRO' },
      },
    });
  });

  it('never touches any model other than outboxEvent', async () => {
    prismaMock.outboxEvent.create.mockResolvedValue({} as never);

    await service.recordInTransaction(prismaMock, {
      aggregateType: 'User',
      aggregateId: 'user-456',
      eventType: 'TIER_DOWNGRADED',
      payload: { tier: 'FREE' },
    });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });
});
