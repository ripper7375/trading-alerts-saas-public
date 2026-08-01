import { DrawingsController } from './drawings.controller';
import type { DrawingsService } from './drawings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function mockRequest(userId = 'user-1', tier = 'PRO') {
  return { user: { id: userId, tier } } as never;
}

describe('DrawingsController', () => {
  function makeController(service: Partial<DrawingsService>) {
    return new DrawingsController(service as DrawingsService);
  }

  it('delegates list() to DrawingsService.list', async () => {
    const list = jest.fn().mockResolvedValue({ success: true, drawings: [] });
    const controller = makeController({ list });

    await controller.list(mockRequest(), 'XAUUSD', 'M5');

    expect(list).toHaveBeenCalledWith('user-1', {
      symbol: 'XAUUSD',
      timeframe: 'M5',
    });
  });

  it('delegates create() to DrawingsService.create with the caller tier', async () => {
    const create = jest.fn().mockResolvedValue({ success: true, drawing: {} });
    const controller = makeController({ create });
    const dto = {
      symbol: 'XAUUSD',
      timeframe: 'M5',
      type: 'HLINE',
      anchors: [{ time: 1000, price: 1900 }],
      style: { color: '#ff0000', lineWidth: 1, lineStyle: 'solid' },
    } as never;

    await controller.create(mockRequest('user-1', 'PRO'), dto);

    expect(create).toHaveBeenCalledWith('user-1', 'PRO', dto);
  });

  it('delegates update() to DrawingsService.update (no tier argument)', async () => {
    const update = jest.fn().mockResolvedValue({ success: true, drawing: {} });
    const controller = makeController({ update });
    const dto = { anchors: [{ time: 1000, price: 1900 }] } as never;

    await controller.update(mockRequest(), 'drawing-1', dto);

    expect(update).toHaveBeenCalledWith('user-1', 'drawing-1', dto);
  });

  it('delegates remove() to DrawingsService.remove', async () => {
    const remove = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ remove });

    await controller.remove(mockRequest(), 'drawing-1');

    expect(remove).toHaveBeenCalledWith('user-1', 'drawing-1');
  });

  it('every route is guarded by JwtAuthGuard', () => {
    for (const method of ['list', 'create', 'update', 'remove'] as const) {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        DrawingsController.prototype[method]
      );
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    }
  });
});
