import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { DrawingsService } from './drawings.service';

// DI-based construction (mocked PrismaService/RedisService), matching the
// established Session 4B-2/4B-5 convention for this service.
describe('DrawingsService', () => {
  const mockPrisma = {
    drawing: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockPublish = jest.fn();
  const mockRedis = {
    getClient: jest.fn(() => ({ publish: mockPublish })),
  };

  function makeService() {
    return new DrawingsService(mockPrisma as never, mockRedis as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it("returns the caller's drawings", async () => {
      const drawings = [{ id: 'drawing-1', symbol: 'XAUUSD' }];
      mockPrisma.drawing.findMany.mockResolvedValue(drawings);

      const result = await makeService().list('user-1', {});

      expect(result).toEqual({ success: true, drawings });
      expect(mockPrisma.drawing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          include: { alerts: true },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('filters by symbol and timeframe', async () => {
      mockPrisma.drawing.findMany.mockResolvedValue([]);
      await makeService().list('user-1', {
        symbol: 'XAUUSD',
        timeframe: 'M5',
      });

      expect(mockPrisma.drawing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', symbol: 'XAUUSD', timeframe: 'M5' },
        })
      );
    });
  });

  describe('create', () => {
    const dto = {
      symbol: 'XAUUSD',
      timeframe: 'M5',
      type: 'HLINE' as const,
      anchors: [{ time: 1000, price: 1900 }],
      style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid' as const },
    };

    it('throws 403 symbol access denied for an unsupported symbol', async () => {
      await expect(
        makeService().create('user-1', 'PRO', { ...dto, symbol: 'EURUSD' })
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          error: 'Symbol access denied',
          message: 'Symbol EURUSD is not available in your PRO tier.',
        }),
      });
      expect(mockPrisma.drawing.create).not.toHaveBeenCalled();
    });

    it('throws 403 timeframe access denied with the exact tier-validation reason string', async () => {
      await expect(
        makeService().create('user-1', 'PRO', { ...dto, timeframe: 'H1' })
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          error: 'Timeframe access denied',
          message:
            'Timeframe H1 is not supported. Available timeframes: M5, M15.',
        }),
      });
    });

    it('throws 403 drawing limit reached at the FREE tier ceiling (10)', async () => {
      mockPrisma.drawing.count.mockResolvedValue(10);

      await expect(
        makeService().create('user-1', 'FREE', dto)
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({ error: 'Drawing limit reached' }),
      });
    });

    it('throws 403 drawing limit reached at the PRO tier ceiling (200)', async () => {
      mockPrisma.drawing.count.mockResolvedValue(200);

      await expect(
        makeService().create('user-1', 'PRO', dto)
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({ error: 'Drawing limit reached' }),
      });
    });

    it('creates the drawing for a user under the limit', async () => {
      mockPrisma.drawing.count.mockResolvedValue(2);
      const created = { id: 'new-drawing', symbol: 'XAUUSD' };
      mockPrisma.drawing.create.mockResolvedValue(created);

      const result = await makeService().create('user-1', 'FREE', dto);

      expect(result).toEqual({ success: true, drawing: created });
      expect(mockPrisma.drawing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            symbol: 'XAUUSD',
            timeframe: 'M5',
            type: 'HLINE',
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('throws 404 when not found', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(null);
      await expect(
        makeService().update('user-1', 'missing', { anchors: undefined })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({ userId: 'user-2' });
      await expect(
        makeService().update('user-1', 'drawing-1', { anchors: undefined })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.drawing.update).not.toHaveBeenCalled();
    });

    it('updates and publishes alerts:changed with reason drawing_updated', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.drawing.update.mockResolvedValue({
        id: 'drawing-1',
        symbol: 'XAUUSD',
        timeframe: 'M5',
      });

      const result = await makeService().update('user-1', 'drawing-1', {
        style: { color: '#00ff00', lineWidth: 1, lineStyle: 'dashed' },
      });

      expect(result.success).toBe(true);
      expect(mockPublish).toHaveBeenCalledWith(
        'alerts:changed',
        expect.stringContaining('"reason":"drawing_updated"')
      );
    });

    it('never throws when Redis publish fails (best-effort)', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.drawing.update.mockResolvedValue({
        id: 'drawing-1',
        symbol: 'XAUUSD',
        timeframe: 'M5',
      });
      mockPublish.mockImplementation(() => {
        throw new Error('redis down');
      });

      await expect(
        makeService().update('user-1', 'drawing-1', { anchors: undefined })
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe('remove', () => {
    it('throws 404 when not found', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(null);
      await expect(
        makeService().remove('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({ userId: 'user-2' });
      await expect(
        makeService().remove('user-1', 'drawing-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.drawing.delete).not.toHaveBeenCalled();
    });

    it('deletes and publishes alerts:changed with reason drawing_deleted', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({
        id: 'drawing-1',
        userId: 'user-1',
        symbol: 'XAUUSD',
        timeframe: 'M5',
      });
      mockPrisma.drawing.delete.mockResolvedValue({});

      const result = await makeService().remove('user-1', 'drawing-1');

      expect(mockPrisma.drawing.delete).toHaveBeenCalledWith({
        where: { id: 'drawing-1' },
      });
      expect(mockPublish).toHaveBeenCalledWith(
        'alerts:changed',
        expect.stringContaining('"reason":"drawing_deleted"')
      );
      expect(result).toEqual({ success: true });
    });
  });
});
