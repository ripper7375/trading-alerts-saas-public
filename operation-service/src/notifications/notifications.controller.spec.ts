import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function mockRequest(userId = 'user-1') {
  return { user: { id: userId } } as never;
}

describe('NotificationsController', () => {
  function makeController(service: Partial<NotificationsService>) {
    return new NotificationsController(service as NotificationsService);
  }

  it('delegates list() to NotificationsService.list', async () => {
    const list = jest.fn().mockResolvedValue({ notifications: [] });
    const controller = makeController({ list });
    const query = { status: 'all' as const, page: 1, pageSize: 20 };

    await controller.list(mockRequest(), query);

    expect(list).toHaveBeenCalledWith('user-1', query);
  });

  it('delegates markAllRead() to NotificationsService.markAllRead', async () => {
    const markAllRead = jest
      .fn()
      .mockResolvedValue({ success: true, updatedCount: 0, message: '' });
    const controller = makeController({ markAllRead });

    await controller.markAllRead(mockRequest());

    expect(markAllRead).toHaveBeenCalledWith('user-1');
  });

  it('delegates getById() to NotificationsService.getById', async () => {
    const getById = jest.fn().mockResolvedValue({ id: 'n-1' });
    const controller = makeController({ getById });

    await controller.getById(mockRequest(), 'n-1');

    expect(getById).toHaveBeenCalledWith('user-1', 'n-1');
  });

  it('delegates remove() to NotificationsService.remove', async () => {
    const remove = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ remove });

    await controller.remove(mockRequest(), 'n-1');

    expect(remove).toHaveBeenCalledWith('user-1', 'n-1');
  });

  it('delegates markRead() to NotificationsService.markRead', async () => {
    const markRead = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ markRead });

    await controller.markRead(mockRequest(), 'n-1');

    expect(markRead).toHaveBeenCalledWith('user-1', 'n-1');
  });

  it('every route is guarded by JwtAuthGuard', () => {
    for (const method of [
      'list',
      'markAllRead',
      'getById',
      'remove',
      'markRead',
    ] as const) {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        NotificationsController.prototype[method]
      );
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    }
  });
});
