import { BadRequestException, ConflictException } from '@nestjs/common';
import { ValidationService } from '../src/gateway/validation.service';
import { MarketDataDto } from '../src/gateway/dto/market-data.dto';

function validPayload(overrides: Partial<MarketDataDto> = {}): MarketDataDto {
  const now = Math.floor(Date.now() / 1000);
  const base: MarketDataDto = {
    terminal_id: 'push_worker_v5',
    timestamp: now - 300,
    symbol: 'XAUUSD',
    timeframe: 'M5',
    open: 2382.14,
    high: 2383.02,
    low: 2381.55,
    close: 2382.77,
    volume: 214,
    cycle_id: 1,
    collected_at: now,
    calculated_at: now,
  } as MarketDataDto;
  return { ...base, ...overrides };
}

function makeQueueMock(getJobResult: unknown = null) {
  return {
    getJob: jest.fn().mockResolvedValue(getJobResult),
  } as any;
}

describe('ValidationService', () => {
  describe('symbol validation', () => {
    it('rejects a non-XAUUSD symbol', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(validPayload({ symbol: 'EURUSD' }))
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OHLC validation', () => {
    it('rejects high < low', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(validPayload({ high: 2380, low: 2381 }))
      ).rejects.toThrow(/high.*cannot be less than low/i);
    });

    it('rejects high < open', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(validPayload({ high: 2380, low: 2370, open: 2382 }))
      ).rejects.toThrow(/high.*cannot be less than open/i);
    });

    it('rejects non-positive prices', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(
          validPayload({ open: -1, high: 1, low: -1, close: 1 })
        )
      ).rejects.toThrow(/must be positive/i);
    });

    it('accepts a well-formed candle', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(service.validate(validPayload())).resolves.toBeUndefined();
    });
  });

  describe('timestamp validation', () => {
    it('rejects a timestamp too far in the future', async () => {
      const service = new ValidationService(makeQueueMock());
      const future = Math.floor(Date.now() / 1000) + 3600;
      await expect(
        service.validate(validPayload({ timestamp: future }))
      ).rejects.toThrow(/seconds in the future/i);
    });

    it('rejects a timestamp older than 7 days', async () => {
      const service = new ValidationService(makeQueueMock());
      const old = Math.floor(Date.now() / 1000) - 8 * 86400;
      await expect(
        service.validate(validPayload({ timestamp: old }))
      ).rejects.toThrow(/days old/i);
    });
  });

  describe('candle proportion validation', () => {
    it('rejects zero-range candles', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(
          validPayload({ open: 2382, high: 2382, low: 2382, close: 2382 })
        )
      ).rejects.toThrow(/zero range/i);
    });

    it('rejects a spread over 20%', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(
          validPayload({ open: 2000, high: 2600, low: 2000, close: 2300 })
        )
      ).rejects.toThrow(/spread too large/i);
    });
  });

  describe('volume validation', () => {
    it('rejects negative volume', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(validPayload({ volume: -5 }))
      ).rejects.toThrow(/cannot be negative/i);
    });

    it('rejects volume above the 100M ceiling', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(validPayload({ volume: 200_000_000 }))
      ).rejects.toThrow(/exceeds maximum threshold/i);
    });
  });

  describe('zigzag pivot conformance', () => {
    it('rejects a pivot type without a pivot price', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(
          validPayload({ zigzag_point_type: 'Peak', zigzag_current_point: null })
        )
      ).rejects.toThrow(/must both be present or both be null/i);
    });

    it('accepts both null', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(
          validPayload({ zigzag_point_type: null, zigzag_current_point: null })
        )
      ).resolves.toBeUndefined();
    });

    it('accepts both present', async () => {
      const service = new ValidationService(makeQueueMock());
      await expect(
        service.validate(
          validPayload({ zigzag_point_type: 'Peak', zigzag_current_point: 2385.0 })
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('duplicate detection', () => {
    it('rejects when an identical job is already waiting', async () => {
      const job = { getState: jest.fn().mockResolvedValue('waiting') };
      const service = new ValidationService(makeQueueMock(job));
      await expect(service.validate(validPayload())).rejects.toThrow(ConflictException);
    });

    it('allows a re-send once the prior job completed more than 60s ago', async () => {
      const job = {
        getState: jest.fn().mockResolvedValue('completed'),
        finishedOn: Date.now() - 120_000,
      };
      const service = new ValidationService(makeQueueMock(job));
      await expect(service.validate(validPayload())).resolves.toBeUndefined();
    });

    it('does not block ingestion when the duplicate check itself errors', async () => {
      const queue = { getJob: jest.fn().mockRejectedValue(new Error('redis down')) } as any;
      const service = new ValidationService(queue);
      await expect(service.validate(validPayload())).resolves.toBeUndefined();
    });
  });
});
