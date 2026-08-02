import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { MarketDataService } from './market-data.service';

// DI-based construction (mocked PrismaService), matching the established
// Session 4B-2/4B-8 convention for this service.
describe('MarketDataService', () => {
  const mockPrisma = {
    marketDataV6: {
      findMany: jest.fn(),
    },
  };

  function makeService() {
    return new MarketDataService(mockPrisma as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tier gate', () => {
    it('throws ForbiddenException with the exact SOURCE payload for a FREE-tier caller', async () => {
      const service = makeService();

      await expect(
        service.getChannelData('FREE', 'XAUUSD', 'M5', 'best_fit', 300)
      ).rejects.toMatchObject({
        status: 403,
        response: {
          success: false,
          error: 'Multi-timeframe visualization is a PRO feature',
          message:
            'Upgrade to PRO to overlay M5 channel structure on M15 charts.',
        },
      });
      await expect(
        service.getChannelData('FREE', 'XAUUSD', 'M5', 'best_fit', 300)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.marketDataV6.findMany).not.toHaveBeenCalled();
    });
  });

  describe('membership validation (PRO caller)', () => {
    it('rejects an unsupported symbol with the exact SOURCE error text', async () => {
      const service = makeService();

      await expect(
        service.getChannelData('PRO', 'EURUSD', 'M5', 'best_fit', 300)
      ).rejects.toMatchObject({
        status: 400,
        response: {
          success: false,
          error: 'Unsupported symbol (XAUUSD only)',
        },
      });
      await expect(
        service.getChannelData('PRO', 'EURUSD', 'M5', 'best_fit', 300)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unsupported timeframe with the exact SOURCE error text', async () => {
      const service = makeService();

      await expect(
        service.getChannelData('PRO', 'XAUUSD', 'H1', 'best_fit', 300)
      ).rejects.toMatchObject({
        status: 400,
        response: {
          success: false,
          error: 'Unsupported timeframe (M5, M15 only)',
        },
      });
    });

    it('rejects an unsupported variant, listing all 6 available variants', async () => {
      const service = makeService();

      await expect(
        service.getChannelData('PRO', 'XAUUSD', 'M5', 'not_a_variant', 300)
      ).rejects.toMatchObject({
        status: 400,
        response: {
          success: false,
          error:
            'Invalid variant. Available: best_fit, cherry_a, cherry_b, most_recent, non_a, non_b',
        },
      });
    });

    it('checks symbol before timeframe before variant, matching SOURCE order', async () => {
      const service = makeService();

      // All three are invalid — only the symbol error should surface.
      await expect(
        service.getChannelData('PRO', 'EURUSD', 'H1', 'bogus', 300)
      ).rejects.toMatchObject({
        response: { error: 'Unsupported symbol (XAUUSD only)' },
      });
    });
  });

  describe('successful query (PRO caller, valid params)', () => {
    it('queries MarketDataV6 with symbol/timeframe/desc-order/limit and maps rows', async () => {
      mockPrisma.marketDataV6.findMany.mockResolvedValue([
        {
          timestamp: 200,
          best_fit_uoedt: 1901.5,
          best_fit_base_fl: 1900,
          best_fit_loedt: 1898.5,
        },
        {
          timestamp: 100,
          best_fit_uoedt: 1899.5,
          best_fit_base_fl: 1898,
          best_fit_loedt: 1896.5,
        },
      ]);
      const service = makeService();

      // Called with already-uppercased symbol/timeframe, matching what the
      // controller's channelQuerySchema (defaulting-only) hands the service
      // — uppercasing is the Zod schema's job, not the service's.
      const result = await service.getChannelData(
        'PRO',
        'XAUUSD',
        'M5',
        'best_fit',
        300
      );

      expect(mockPrisma.marketDataV6.findMany).toHaveBeenCalledWith({
        where: { symbol: 'XAUUSD', timeframe: 'M5' },
        orderBy: { timestamp: 'desc' },
        take: 300,
      });
      // Rows come back desc (newest first) from Prisma; SOURCE reverses
      // them to chronological order for chart rendering.
      expect(result).toEqual({
        success: true,
        symbol: 'XAUUSD',
        timeframe: 'M5',
        variant: 'best_fit',
        points: [
          { time: 100, upper: 1899.5, mid: 1898, lower: 1896.5 },
          { time: 200, upper: 1901.5, mid: 1900, lower: 1898.5 },
        ],
      });
    });

    it('defaults missing centroid columns to null rather than undefined', async () => {
      mockPrisma.marketDataV6.findMany.mockResolvedValue([{ timestamp: 100 }]);
      const service = makeService();

      const result = await service.getChannelData(
        'PRO',
        'XAUUSD',
        'M5',
        'cherry_a',
        300
      );

      expect(result.points).toEqual([
        { time: 100, upper: null, mid: null, lower: null },
      ]);
    });

    it('reads the requested variant-specific columns, not a hardcoded one', async () => {
      mockPrisma.marketDataV6.findMany.mockResolvedValue([
        {
          timestamp: 100,
          non_b_uoedt: 5,
          non_b_base_fl: 4,
          non_b_loedt: 3,
          best_fit_uoedt: 999,
        },
      ]);
      const service = makeService();

      const result = await service.getChannelData(
        'PRO',
        'XAUUSD',
        'M5',
        'non_b',
        300
      );

      expect(result.points).toEqual([
        { time: 100, upper: 5, mid: 4, lower: 3 },
      ]);
    });
  });
});
