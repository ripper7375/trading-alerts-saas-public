import { DispatcherService } from './dispatcher.service';
import type { FireEvent } from './types';

describe('DispatcherService', () => {
  let notificationCreate: jest.Mock;
  let alertUpdate: jest.Mock;
  let publish: jest.Mock;
  let service: DispatcherService;

  const fire: FireEvent = {
    alertId: 'a1',
    userId: 'u1',
    symbol: 'XAUUSD',
    timeframe: 'M10',
    levelId: 'channel_top',
    levelPrice: 2050,
    touchPrice: 2050.4,
    time: 1717000000,
    oneShot: false,
  };

  beforeEach(() => {
    notificationCreate = jest.fn();
    alertUpdate = jest.fn();
    publish = jest.fn();

    const tx: {
      notification: { create: jest.Mock };
      alert: { update: jest.Mock };
    } = {
      notification: { create: notificationCreate },
      alert: { update: alertUpdate },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) =>
        cb(tx)
      ),
    } as unknown as ConstructorParameters<typeof DispatcherService>[0];
    const notifyBridge = {
      publish,
    } as unknown as ConstructorParameters<typeof DispatcherService>[1];

    service = new DispatcherService(prisma, notifyBridge);
  });

  it('creates an ALERT/HIGH Notification row for the fire', async () => {
    await service.dispatch(fire);

    expect(notificationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        type: 'ALERT',
        priority: 'HIGH',
        title: 'XAUUSD M10 alert',
        body: 'Price 2050.4 touched channel_top @ 2050',
        link: '/charts/XAUUSD/M10',
      },
    });
  });

  it('updates the Alert lastTriggered/triggerCount and never sets isActive false for a non-one-shot fire', async () => {
    await service.dispatch(fire);

    expect(alertUpdate).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: expect.objectContaining({
        lastTriggered: expect.any(Date),
        triggerCount: { increment: 1 },
      }),
    });
    const call = alertUpdate.mock.calls[0][0];
    expect(call.data.isActive).toBeUndefined();
  });

  it('deactivates the alert when oneShot is true', async () => {
    await service.dispatch({ ...fire, oneShot: true });

    expect(alertUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it('publishes the fired-alert message via the notify bridge after the DB transaction', async () => {
    await service.dispatch(fire);

    expect(publish).toHaveBeenCalledWith(fire, expect.any(String));
  });
});
