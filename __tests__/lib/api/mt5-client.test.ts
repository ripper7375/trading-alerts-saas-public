import {
  MT5ServiceError,
  MT5AccessDeniedError,
} from '@/lib/api/mt5-client';

describe('MT5 Client - Error Classes', () => {
  describe('MT5ServiceError', () => {
    it('should create error with message and status code', () => {
      const error = new MT5ServiceError('Service unavailable', 503);
      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.name).toBe('MT5ServiceError');
    });

    it('should create error with response body', () => {
      const responseBody = { detail: 'Rate limit exceeded' };
      const error = new MT5ServiceError('Too many requests', 429, responseBody);
      expect(error.statusCode).toBe(429);
      expect(error.responseBody).toEqual(responseBody);
    });

    it('should be instance of Error', () => {
      const error = new MT5ServiceError('Test error', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MT5ServiceError);
    });
  });

  describe('MT5AccessDeniedError', () => {
    it('should create error with tier information', () => {
      const error = new MT5AccessDeniedError('Access denied', 'FREE');
      expect(error.message).toBe('Access denied');
      expect(error.tier).toBe('FREE');
      expect(error.name).toBe('MT5AccessDeniedError');
    });

    it('should include accessible symbols and timeframes', () => {
      const error = new MT5AccessDeniedError(
        'Symbol not available',
        'FREE',
        ['BTCUSD', 'EURUSD', 'XAUUSD'],
        ['H1', 'H4', 'D1']
      );
      expect(error.tier).toBe('FREE');
      expect(error.accessibleSymbols).toEqual(['BTCUSD', 'EURUSD', 'XAUUSD']);
      expect(error.accessibleTimeframes).toEqual(['H1', 'H4', 'D1']);
    });

    it('should be instance of Error', () => {
      const error = new MT5AccessDeniedError('Test', 'PRO');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MT5AccessDeniedError);
    });

    it('should handle PRO tier access denied', () => {
      const error = new MT5AccessDeniedError(
        'Rate limit exceeded for PRO tier',
        'PRO',
        ['BTCUSD', 'EURUSD', 'GBPUSD'],
        ['M5', 'M15', 'H1']
      );
      expect(error.tier).toBe('PRO');
      expect(error.accessibleSymbols).toHaveLength(3);
      expect(error.accessibleTimeframes).toHaveLength(3);
    });
  });
});
