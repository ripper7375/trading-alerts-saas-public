import { AlertsController } from './alerts.controller';
import type { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function mockRequest(userId = 'user-1', tier = 'PRO') {
  return { user: { id: userId, tier } } as never;
}

describe('AlertsController', () => {
  function makeController(service: Partial<AlertsService>) {
    return new AlertsController(service as AlertsService);
  }

  it('delegates list() to AlertsService.list', async () => {
    const list = jest.fn().mockResolvedValue({ alerts: [] });
    const controller = makeController({ list });

    await controller.list(mockRequest(), 'active', 'XAUUSD');

    expect(list).toHaveBeenCalledWith('user-1', {
      status: 'active',
      symbol: 'XAUUSD',
    });
  });

  it('delegates create() to AlertsService.create with the caller tier', async () => {
    const create = jest.fn().mockResolvedValue({ alert: {} });
    const controller = makeController({ create });
    const dto = {
      symbol: 'XAUUSD',
      timeframe: 'M5',
      conditionType: 'price_above',
      targetValue: 1900,
    } as never;

    await controller.create(mockRequest('user-1', 'PRO'), dto);

    expect(create).toHaveBeenCalledWith('user-1', 'PRO', dto);
  });

  it('delegates getById() to AlertsService.getById', async () => {
    const getById = jest.fn().mockResolvedValue({ alert: {} });
    const controller = makeController({ getById });

    await controller.getById(mockRequest(), 'alert-1');

    expect(getById).toHaveBeenCalledWith('user-1', 'alert-1');
  });

  it('delegates update() to AlertsService.update with the caller tier', async () => {
    const update = jest.fn().mockResolvedValue({ alert: {} });
    const controller = makeController({ update });
    const dto = { isActive: false } as never;

    await controller.update(mockRequest('user-1', 'PRO'), 'alert-1', dto);

    expect(update).toHaveBeenCalledWith('user-1', 'PRO', 'alert-1', dto);
  });

  it('delegates remove() to AlertsService.remove', async () => {
    const remove = jest.fn().mockResolvedValue({ message: 'ok' });
    const controller = makeController({ remove });

    await controller.remove(mockRequest(), 'alert-1');

    expect(remove).toHaveBeenCalledWith('user-1', 'alert-1');
  });

  it('every route is guarded by JwtAuthGuard', () => {
    for (const method of [
      'list',
      'create',
      'getById',
      'update',
      'remove',
    ] as const) {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AlertsController.prototype[method]
      );
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    }
  });
});
