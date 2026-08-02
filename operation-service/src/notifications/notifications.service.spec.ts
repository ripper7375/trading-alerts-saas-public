import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { NotificationsService } from './notifications.service';

// DI-based construction (mocked PrismaService), matching the established
// Session 4B-2/4B-5/4B-8 convention for this service.
describe('NotificationsService', () => {
  const mockPrisma = {
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  function makeService() {
    return new NotificationsService(mockPrisma as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    const defaultQuery = {
      status: 'all' as const,
      page: 1,
      pageSize: 20,
    };

    it('returns notifications with pagination and unread count', async () => {
      const notifications = [{ id: 'n-1', userId: 'user-1' }];
      mockPrisma.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(3); // unreadCount
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const result = await makeService().list('user-1', defaultQuery);

      expect(result).toEqual({
        notifications,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        unreadCount: 3,
      });
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        })
      );
    });

    it("filters by status: 'unread' -> read: false", async () => {
      mockPrisma.notification.count.mockResolvedValue(0);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await makeService().list('user-1', { ...defaultQuery, status: 'unread' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', read: false } })
      );
    });

    it("filters by status: 'read' -> read: true", async () => {
      mockPrisma.notification.count.mockResolvedValue(0);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await makeService().list('user-1', { ...defaultQuery, status: 'read' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', read: true } })
      );
    });

    it('filters by type', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await makeService().list('user-1', {
        ...defaultQuery,
        type: 'ALERT',
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', type: 'ALERT' },
        })
      );
    });

    it('applies page/pageSize as skip/take and computes totalPages', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(45) // total
        .mockResolvedValueOnce(0); // unreadCount
      mockPrisma.notification.findMany.mockResolvedValue([]);

      const result = await makeService().list('user-1', {
        ...defaultQuery,
        page: 2,
        pageSize: 20,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 })
      );
      expect(result.totalPages).toBe(3);
    });

    it('queries unreadCount independently of the status filter', async () => {
      mockPrisma.notification.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await makeService().list('user-1', { ...defaultQuery, status: 'read' });

      expect(mockPrisma.notification.count).toHaveBeenNthCalledWith(2, {
        where: { userId: 'user-1', read: false },
      });
    });
  });

  describe('markAllRead', () => {
    it('returns { success, updatedCount, message } (not { success, count })', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await makeService().markAllRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true, readAt: expect.any(Date) },
      });
      expect(result).toEqual({
        success: true,
        updatedCount: 4,
        message: '4 notification(s) marked as read',
      });
    });
  });

  describe('getById', () => {
    it('throws 404 NotFoundException when missing', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        makeService().getById('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 ForbiddenException when owned by another user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-2',
      });

      await expect(
        makeService().getById('user-1', 'n-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the raw notification object (no wrapper) when found and owned', async () => {
      const notification = { id: 'n-1', userId: 'user-1', title: 'Hi' };
      mockPrisma.notification.findUnique.mockResolvedValue(notification);

      const result = await makeService().getById('user-1', 'n-1');

      expect(result).toEqual(notification);
    });
  });

  describe('remove', () => {
    it('throws 404 NotFoundException when missing', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        makeService().remove('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });

    it('throws 403 ForbiddenException when owned by another user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-2',
      });

      await expect(
        makeService().remove('user-1', 'n-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });

    it('hard-deletes and returns { success, message }', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-1',
      });
      mockPrisma.notification.delete.mockResolvedValue({});

      const result = await makeService().remove('user-1', 'n-1');

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'n-1' },
      });
      expect(result).toEqual({
        success: true,
        message: 'Notification deleted successfully',
      });
    });
  });

  describe('markRead', () => {
    it('throws 404 NotFoundException when missing', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        makeService().markRead('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 ForbiddenException when owned by another user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-2',
        read: false,
      });

      await expect(
        makeService().markRead('user-1', 'n-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('already-read invariant: short-circuits WITHOUT calling update, returns no success key', async () => {
      const existing = {
        id: 'n-1',
        userId: 'user-1',
        read: true,
        readAt: new Date('2026-01-01'),
      };
      mockPrisma.notification.findUnique
        .mockResolvedValueOnce({ id: 'n-1', userId: 'user-1', read: true }) // ownership lookup
        .mockResolvedValueOnce(existing); // refetch for the already-read branch

      const result = await makeService().markRead('user-1', 'n-1');

      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        notification: existing,
        alreadyRead: true,
        message: 'Notification was already marked as read',
      });
      expect(result).not.toHaveProperty('success');
    });

    it('marks unread notification as read and returns { notification, success, message }', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-1',
        read: false,
      });
      const updated = {
        id: 'n-1',
        userId: 'user-1',
        read: true,
        readAt: new Date('2026-01-02'),
      };
      mockPrisma.notification.update.mockResolvedValue(updated);

      const result = await makeService().markRead('user-1', 'n-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { read: true, readAt: expect.any(Date) },
        select: expect.any(Object),
      });
      expect(result).toEqual({
        notification: updated,
        success: true,
        message: 'Notification marked as read',
      });
    });
  });
});
