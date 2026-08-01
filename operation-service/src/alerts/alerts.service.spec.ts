import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { AlertsService } from './alerts.service';

// DI-based construction (mocked PrismaService), matching the established
// Session 4B-2 convention for this service — not jest.mock('@/lib/db/prisma')
// module-singleton mocking, since this is @Injectable() with constructor
// injection. Ported assertions mirror __tests__/api/alerts.test.ts.
describe('AlertsService', () => {
  const mockPrisma = {
    alert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  function makeService() {
    return new AlertsService(mockPrisma as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it("returns the caller's alerts", async () => {
      const alerts = [{ id: 'alert-1', symbol: 'XAUUSD' }];
      mockPrisma.alert.findMany.mockResolvedValue(alerts);

      const result = await makeService().list('user-1', {});

      expect(result).toEqual({ alerts });
      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } })
      );
    });

    it('filters by status=active', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);
      await makeService().list('user-1', { status: 'active' });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', isActive: true }),
        })
      );
    });

    it('filters by symbol', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);
      await makeService().list('user-1', { symbol: 'XAUUSD' });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            symbol: 'XAUUSD',
          }),
        })
      );
    });
  });

  describe('create', () => {
    const input = {
      symbol: 'XAUUSD' as const,
      timeframe: 'M5' as const,
      conditionType: 'price_above' as const,
      targetValue: 1900,
    };

    it('throws 403 PRO_FEATURE for FREE tier (V8: FREE = 0 alerts)', async () => {
      await expect(
        makeService().create('user-1', 'FREE', input)
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          error: 'Alerts are a PRO feature',
        }),
      });
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('throws 403 alert limit exceeded at PRO tier ceiling (100)', async () => {
      mockPrisma.alert.count.mockResolvedValue(100);

      await expect(
        makeService().create('user-1', 'PRO', input)
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({ error: 'Alert limit exceeded' }),
      });
    });

    it('creates the alert for a PRO user under the limit', async () => {
      mockPrisma.alert.count.mockResolvedValue(2);
      const createdAlert = { id: 'new-alert', symbol: 'XAUUSD' };
      mockPrisma.alert.create.mockResolvedValue(createdAlert);

      const result = await makeService().create('user-1', 'PRO', input);

      expect(result).toEqual({
        alert: createdAlert,
        message: 'Alert created successfully',
      });
      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            symbol: 'XAUUSD',
            timeframe: 'M5',
            alertType: 'PRICE_ALERT',
            isActive: true,
          }),
        })
      );
    });
  });

  describe('getById', () => {
    it('throws 404 when not found', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(null);
      await expect(
        makeService().getById('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        userId: 'user-2',
      });
      await expect(
        makeService().getById('user-1', 'alert-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('strips userId from the response', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        userId: 'user-1',
        name: 'Gold Alert',
      });

      const result = await makeService().getById('user-1', 'alert-1');

      expect(result.alert.id).toBe('alert-1');
      expect(
        (result.alert as Record<string, unknown>)['userId']
      ).toBeUndefined();
    });
  });

  describe('update', () => {
    it('throws 403 PRO_FEATURE for non-PRO tier', async () => {
      await expect(
        makeService().update('user-1', 'FREE', 'alert-1', { isActive: true })
      ).rejects.toMatchObject({ status: 403 });
      expect(mockPrisma.alert.findUnique).not.toHaveBeenCalled();
    });

    it('throws 404 when not found', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(null);
      await expect(
        makeService().update('user-1', 'PRO', 'missing', { isActive: false })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({
        userId: 'user-2',
        condition: '{}',
      });
      await expect(
        makeService().update('user-1', 'PRO', 'alert-1', { isActive: false })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('merges targetValue into the existing condition JSON', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({
        userId: 'user-1',
        condition: '{"type":"price_above","targetValue":1900}',
      });
      mockPrisma.alert.update.mockResolvedValue({ id: 'alert-1' });

      await makeService().update('user-1', 'PRO', 'alert-1', {
        targetValue: 2000,
      });

      expect(mockPrisma.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            condition: expect.stringContaining('"targetValue":2000'),
          }),
        })
      );
    });
  });

  describe('remove', () => {
    it('throws 404 when not found', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue(null);
      await expect(
        makeService().remove('user-1', 'missing')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when owned by another user', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({ userId: 'user-2' });
      await expect(
        makeService().remove('user-1', 'alert-1')
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('hard-deletes the row (not a soft isActive=false flip)', async () => {
      mockPrisma.alert.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.alert.delete.mockResolvedValue({});

      const result = await makeService().remove('user-1', 'alert-1');

      expect(mockPrisma.alert.delete).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
      });
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Alert deleted successfully' });
    });
  });
});
