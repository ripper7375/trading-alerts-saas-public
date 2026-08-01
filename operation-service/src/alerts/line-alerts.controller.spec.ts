import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LineAlertsController } from './line-alerts.controller';
import type { LineAlertsService } from './line-alerts.service';

function mockRequest(userId = 'user-1', tier = 'PRO'): AuthenticatedRequest {
  return { user: { id: userId, tier } } as never;
}

describe('LineAlertsController', () => {
  function makeController(service: Partial<LineAlertsService>) {
    return new LineAlertsController(service as LineAlertsService);
  }

  it('delegates list() to LineAlertsService.list', async () => {
    const list = jest.fn().mockResolvedValue({ success: true, alerts: [] });
    const controller = makeController({ list });

    await controller.list(mockRequest(), 'XAUUSD', 'M5');

    expect(list).toHaveBeenCalledWith('user-1', {
      symbol: 'XAUUSD',
      timeframe: 'M5',
    });
  });

  it('delegates attach() to LineAlertsService.attach with the caller tier', async () => {
    const attach = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ attach });
    const dto = { drawingId: 'drawing-1', targetLevel: 'line' } as never;

    await controller.attach(mockRequest('user-1', 'PRO'), dto);

    expect(attach).toHaveBeenCalledWith('user-1', 'PRO', dto);
  });

  it('delegates update() to LineAlertsService.update with the caller tier', async () => {
    const update = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ update });
    const dto = { isActive: false } as never;

    await controller.update(mockRequest('user-1', 'PRO'), 'da-1', dto);

    expect(update).toHaveBeenCalledWith('user-1', 'PRO', 'da-1', dto);
  });

  it('delegates remove() to LineAlertsService.remove', async () => {
    const remove = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ remove });

    await controller.remove(mockRequest(), 'da-1');

    expect(remove).toHaveBeenCalledWith('user-1', 'da-1');
  });

  it('every route is guarded by JwtAuthGuard', () => {
    for (const method of ['list', 'attach', 'update', 'remove'] as const) {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        LineAlertsController.prototype[method]
      );
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    }
  });
});
