import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { LineAlertsService } from './line-alerts.service';

// No usable server-side test suite existed to port from — the order's own
// cited "Parity proof" (__tests__/drawing/alertsApi.test.ts) tests a
// CLIENT-side fetch wrapper (components/charts/drawing/alertsApi.ts), not
// app/api/alerts/line/**'s server route logic at all (found while writing
// this file; recorded in the order's Deviations, LESSONS-LEARNED.md L28
// class). These assertions are authored fresh against the real SOURCE route
// handlers read directly.
describe('LineAlertsService', () => {
  const mockPrisma = {
    drawingAlert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    drawing: { findUnique: jest.fn() },
    alert: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const mockRedis = { getClient: jest.fn() };
  const mockPublish = jest.fn().mockResolvedValue(1);

  function makeService() {
    mockRedis.getClient.mockReturnValue({ publish: mockPublish });
    return new LineAlertsService(mockPrisma as never, mockRedis as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(mockPrisma)
    );
  });

  const HLINE_DRAWING = {
    id: 'drawing-1',
    userId: 'user-1',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    type: 'HLINE',
    anchors: [{ time: 1, price: 1900 }],
    style: { color: '#ffffff', lineWidth: 1, lineStyle: 'solid' },
  };

  const attachInput = {
    drawingId: 'drawing-1',
    targetLevel: 'line',
    direction: 'either' as const,
    tolerance: 0,
    cooldownSec: 60,
    oneShot: false,
  };

  describe('attach', () => {
    it('throws 403 for non-PRO tier (line alerts are PRO-exclusive)', async () => {
      await expect(
        makeService().attach('user-1', 'FREE', attachInput)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.drawing.findUnique).not.toHaveBeenCalled();
    });

    it('throws 404 when the drawing does not exist', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(null);
      await expect(
        makeService().attach('user-1', 'PRO', attachInput)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when the drawing belongs to another user', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({
        ...HLINE_DRAWING,
        userId: 'user-2',
      });
      await expect(
        makeService().attach('user-1', 'PRO', attachInput)
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 400 "Not alertable" when the drawing exposes zero levels (e.g. TEXT)', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue({
        ...HLINE_DRAWING,
        type: 'TEXT',
        anchors: [{ time: 1, price: 1900 }],
      });
      await expect(
        makeService().attach('user-1', 'PRO', attachInput)
      ).rejects.toMatchObject({
        status: 400,
        response: expect.objectContaining({ error: 'Not alertable' }),
      });
    });

    it("throws 400 when targetLevel is not one of the drawing's real levels", async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(HLINE_DRAWING);
      await expect(
        makeService().attach('user-1', 'PRO', {
          ...attachInput,
          targetLevel: 'not-a-real-level',
        })
      ).rejects.toMatchObject({
        status: 400,
        response: expect.objectContaining({ error: 'Invalid target level' }),
      });
    });

    it('throws 403 when the shared 100-alert quota is reached', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(HLINE_DRAWING);
      mockPrisma.alert.count.mockResolvedValue(100);
      await expect(
        makeService().attach('user-1', 'PRO', attachInput)
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({ error: 'Alert limit reached' }),
      });
    });

    it('creates Alert + DrawingAlert atomically and publishes alerts:changed', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(HLINE_DRAWING);
      mockPrisma.alert.count.mockResolvedValue(0);
      mockPrisma.alert.create.mockResolvedValue({ id: 'alert-1' });
      mockPrisma.drawingAlert.create.mockResolvedValue({
        id: 'da-1',
        alertId: 'alert-1',
        drawingId: 'drawing-1',
      });

      const service = makeService();
      const result = await service.attach('user-1', 'PRO', attachInput);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'PRICE_TOUCH_LINE',
            symbol: 'XAUUSD',
            timeframe: 'M5',
          }),
        })
      );
      expect(mockPublish).toHaveBeenCalledWith(
        'alerts:changed',
        expect.stringContaining('"reason":"alert_created"')
      );
      expect(result.success).toBe(true);
    });

    it('never throws when the Redis publish fails (best-effort)', async () => {
      mockPrisma.drawing.findUnique.mockResolvedValue(HLINE_DRAWING);
      mockPrisma.alert.count.mockResolvedValue(0);
      mockPrisma.alert.create.mockResolvedValue({ id: 'alert-1' });
      mockPrisma.drawingAlert.create.mockResolvedValue({
        id: 'da-1',
        alertId: 'alert-1',
        drawingId: 'drawing-1',
      });
      mockPublish.mockRejectedValueOnce(new Error('redis down'));

      await expect(
        makeService().attach('user-1', 'PRO', attachInput)
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe('update', () => {
    const existing = {
      id: 'da-1',
      alertId: 'alert-1',
      drawingId: 'drawing-1',
      drawing: HLINE_DRAWING,
    };

    it('throws 403 for non-PRO tier', async () => {
      await expect(
        makeService().update('user-1', 'FREE', 'da-1', { isActive: false })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.drawingAlert.findUnique).not.toHaveBeenCalled();
    });

    it('throws 404 when not found', async () => {
      mockPrisma.drawingAlert.findUnique.mockResolvedValue(null);
      await expect(
        makeService().update('user-1', 'PRO', 'missing', { isActive: false })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.drawingAlert.findUnique.mockResolvedValue({
        ...existing,
        drawing: { ...HLINE_DRAWING, userId: 'user-2' },
      });
      await expect(
        makeService().update('user-1', 'PRO', 'da-1', { isActive: false })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates and publishes alerts:changed', async () => {
      mockPrisma.drawingAlert.findUnique.mockResolvedValue(existing);
      mockPrisma.drawingAlert.update.mockResolvedValue({});
      const service = makeService();

      await service.update('user-1', 'PRO', 'da-1', { isActive: false });

      expect(mockPublish).toHaveBeenCalledWith(
        'alerts:changed',
        expect.stringContaining('"reason":"alert_updated"')
      );
    });
  });

  describe('remove', () => {
    const existing = {
      id: 'da-1',
      alertId: 'alert-1',
      drawingId: 'drawing-1',
      drawing: HLINE_DRAWING,
    };

    it('throws 404 when not found', async () => {
      mockPrisma.drawingAlert.findUnique.mockResolvedValue(null);
      await expect(
        makeService().remove('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.drawingAlert.findUnique.mockResolvedValue({
        ...existing,
        drawing: { ...HLINE_DRAWING, userId: 'user-2' },
      });
      await expect(
        makeService().remove('user-1', 'da-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('is available regardless of tier (FREE can still delete)', async () => {
      mockPrisma.drawingAlert.findUnique.mockResolvedValue(existing);
      mockPrisma.alert.delete.mockResolvedValue({});
      const service = makeService();

      const result = await service.remove('user-1', 'da-1');

      expect(mockPrisma.alert.delete).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
      });
      expect(mockPublish).toHaveBeenCalledWith(
        'alerts:changed',
        expect.stringContaining('"reason":"alert_deleted"')
      );
      expect(result).toEqual({ success: true });
    });
  });
});
