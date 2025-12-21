import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  MT5ServiceError,
  MT5AccessDeniedError,
  checkMT5Health,
  getMT5Symbols,
  getMT5Timeframes,
  fetchIndicatorData,
  isMT5ServiceAvailable,
} from '@/lib/api/mt5-client';

// Store original fetch
const originalFetch = global.fetch;

// Mock fetch for testing
const mockFetch = jest.fn();

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

    it('should handle undefined response body', () => {
      const error = new MT5ServiceError('No body', 404);
      expect(error.responseBody).toBeUndefined();
    });

    it('should preserve stack trace', () => {
      const error = new MT5ServiceError('Stack test', 500);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MT5ServiceError');
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

    it('should handle undefined accessible lists', () => {
      const error = new MT5AccessDeniedError('Denied', 'FREE');
      expect(error.accessibleSymbols).toBeUndefined();
      expect(error.accessibleTimeframes).toBeUndefined();
    });

    it('should handle empty accessible lists', () => {
      const error = new MT5AccessDeniedError('Denied', 'FREE', [], []);
      expect(error.accessibleSymbols).toEqual([]);
      expect(error.accessibleTimeframes).toEqual([]);
    });
  });
});

describe('MT5 Client - API Functions', () => {
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('checkMT5Health', () => {
    it('should return health status when service is healthy', async () => {
      const mockHealth = {
        status: 'ok',
        version: '1.0.0',
        total_terminals: 3,
        connected_terminals: 3,
        terminals: {
          terminal_1: {
            connected: true,
            terminal_id: '1',
            last_check: '2025-12-15T00:00:00Z',
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHealth,
      });

      const result = await checkMT5Health();

      expect(result.status).toBe('ok');
      expect(result.version).toBe('1.0.0');
      expect(result.total_terminals).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/health'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle degraded status', async () => {
      const mockHealth = {
        status: 'degraded',
        version: '1.0.0',
        total_terminals: 3,
        connected_terminals: 2,
        terminals: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHealth,
      });

      const result = await checkMT5Health();

      expect(result.status).toBe('degraded');
      expect(result.connected_terminals).toBe(2);
    });
  });

  describe('getMT5Symbols', () => {
    it('should return symbols for FREE tier', async () => {
      const mockResponse = {
        success: true,
        tier: 'FREE',
        symbols: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getMT5Symbols('FREE');

      expect(result.success).toBe(true);
      expect(result.tier).toBe('FREE');
      expect(result.symbols).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/symbols'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-Tier': 'FREE',
          }),
        })
      );
    });

    it('should return symbols for PRO tier', async () => {
      const mockResponse = {
        success: true,
        tier: 'PRO',
        symbols: ['BTCUSD', 'EURUSD', 'GBPUSD', 'ETHUSD', 'XAUUSD'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getMT5Symbols('PRO');

      expect(result.tier).toBe('PRO');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-Tier': 'PRO',
          }),
        })
      );
    });
  });

  describe('getMT5Timeframes', () => {
    it('should return timeframes for FREE tier', async () => {
      const mockResponse = {
        success: true,
        tier: 'FREE',
        timeframes: ['H1', 'H4', 'D1'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getMT5Timeframes('FREE');

      expect(result.success).toBe(true);
      expect(result.tier).toBe('FREE');
      expect(result.timeframes).toHaveLength(3);
    });

    it('should return timeframes for PRO tier', async () => {
      const mockResponse = {
        success: true,
        tier: 'PRO',
        timeframes: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getMT5Timeframes('PRO');

      expect(result.tier).toBe('PRO');
      expect(result.timeframes).toHaveLength(9);
    });
  });

  describe('fetchIndicatorData', () => {
    const mockIndicatorData = {
      success: true,
      data: {
        ohlc: [
          {
            time: 1702600800,
            open: 2020.5,
            high: 2025.0,
            low: 2018.0,
            close: 2023.5,
            volume: 1000,
          },
        ],
        horizontal: {
          peak_1: [],
          peak_2: [],
          peak_3: [],
          bottom_1: [],
          bottom_2: [],
          bottom_3: [],
        },
        diagonal: {
          ascending_1: [],
          ascending_2: [],
          ascending_3: [],
          descending_1: [],
          descending_2: [],
          descending_3: [],
        },
        fractals: { peaks: [], bottoms: [] },
        metadata: {
          symbol: 'XAUUSD',
          timeframe: 'H1',
          tier: 'FREE',
          bars_returned: 1,
        },
      },
    };

    it('should fetch indicator data successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockIndicatorData,
      });

      const result = await fetchIndicatorData('XAUUSD', 'H1', 'FREE', 500);

      expect(result.ohlc).toHaveLength(1);
      expect(result.metadata.symbol).toBe('XAUUSD');
      expect(result.metadata.timeframe).toBe('H1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/indicators/XAUUSD/H1'),
        expect.anything()
      );
    });

    it('should include bars parameter in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockIndicatorData,
      });

      await fetchIndicatorData('EURUSD', 'H4', 'PRO', 1000);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('bars=1000'),
        expect.anything()
      );
    });

    it('should throw MT5AccessDeniedError for tier restrictions', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Symbol not available for FREE tier',
          upgrade_required: true,
          tier: 'FREE',
          accessible_symbols: ['BTCUSD', 'EURUSD'],
          accessible_timeframes: ['H1', 'H4', 'D1'],
        }),
      });

      await expect(fetchIndicatorData('GBPUSD', 'H1', 'FREE')).rejects.toThrow(
        MT5AccessDeniedError
      );
    });

    it('should throw MT5ServiceError for server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      });

      await expect(fetchIndicatorData('XAUUSD', 'H1', 'FREE')).rejects.toThrow(
        MT5ServiceError
      );
    });

    it('should throw when response success is false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Failed to fetch data',
        }),
      });

      await expect(fetchIndicatorData('XAUUSD', 'H1', 'FREE')).rejects.toThrow(
        MT5ServiceError
      );
    });
  });

  describe('isMT5ServiceAvailable', () => {
    it('should return true when service is healthy', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          version: '1.0.0',
          total_terminals: 1,
          connected_terminals: 1,
          terminals: {},
        }),
      });

      const result = await isMT5ServiceAvailable();

      expect(result).toBe(true);
    });

    it('should return true when service is degraded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'degraded',
          version: '1.0.0',
          total_terminals: 2,
          connected_terminals: 1,
          terminals: {},
        }),
      });

      const result = await isMT5ServiceAvailable();

      expect(result).toBe(true);
    });

    it('should return false when service status is error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'error',
          version: '1.0.0',
          total_terminals: 1,
          connected_terminals: 0,
          terminals: {},
        }),
      });

      const result = await isMT5ServiceAvailable();

      expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await isMT5ServiceAvailable();

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases - Timeout Handling
  // ============================================================================
  describe('timeout handling', () => {
    it('should handle AbortError from aborted requests', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      // Should fail after max retries
      await expect(checkMT5Health()).rejects.toThrow();
    });

    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          version: '1.0.0',
          total_terminals: 1,
          connected_terminals: 1,
          terminals: {},
        }),
      });

      await checkMT5Health();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  // ============================================================================
  // Edge Cases - Retry Logic
  // ============================================================================
  describe('retry logic', () => {
    it('should not retry for 4xx client errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(getMT5Symbols('FREE')).rejects.toThrow(MT5ServiceError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry for 401 unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(getMT5Timeframes('FREE')).rejects.toThrow(MT5ServiceError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry for 404 not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Symbol not found' }),
      });

      await expect(fetchIndicatorData('INVALID', 'H1', 'FREE')).rejects.toThrow(MT5ServiceError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry for access denied errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Access denied',
          upgrade_required: true,
          tier: 'FREE',
        }),
      });

      await expect(fetchIndicatorData('GBPJPY', 'M5', 'FREE')).rejects.toThrow(MT5AccessDeniedError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Edge Cases - Response Handling
  // ============================================================================
  describe('response handling edge cases', () => {
    it('should handle empty OHLC data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ohlc: [],
            horizontal: { peak_1: [], peak_2: [], peak_3: [], bottom_1: [], bottom_2: [], bottom_3: [] },
            diagonal: { ascending_1: [], ascending_2: [], ascending_3: [], descending_1: [], descending_2: [], descending_3: [] },
            fractals: { peaks: [], bottoms: [] },
            metadata: { symbol: 'XAUUSD', timeframe: 'H1', tier: 'FREE', bars_returned: 0 },
          },
        }),
      });

      const result = await fetchIndicatorData('XAUUSD', 'H1', 'FREE');
      expect(result.ohlc).toEqual([]);
      expect(result.metadata.bars_returned).toBe(0);
    });

    it('should handle missing data in success response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          // data is undefined
        }),
      });

      await expect(fetchIndicatorData('XAUUSD', 'H1', 'FREE')).rejects.toThrow(MT5ServiceError);
    });

    it('should handle null response data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
        }),
      });

      await expect(fetchIndicatorData('XAUUSD', 'H1', 'FREE')).rejects.toThrow(MT5ServiceError);
    });

    it('should use default error message when none provided', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}), // No error field
      });

      try {
        await getMT5Symbols('FREE');
      } catch (error) {
        expect(error).toBeInstanceOf(MT5ServiceError);
        expect((error as MT5ServiceError).message).toContain('500');
      }
    });

    it('should handle missing error in success false response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          // No error field
        }),
      });

      try {
        await fetchIndicatorData('XAUUSD', 'H1', 'FREE');
      } catch (error) {
        expect(error).toBeInstanceOf(MT5ServiceError);
        expect((error as MT5ServiceError).message).toContain('Failed to fetch');
      }
    });
  });

  // ============================================================================
  // Edge Cases - Headers and Authentication
  // ============================================================================
  describe('headers and authentication', () => {
    it('should include Content-Type header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          tier: 'FREE',
          symbols: [],
        }),
      });

      await getMT5Symbols('FREE');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should set X-User-Tier header for PRO', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          tier: 'PRO',
          timeframes: ['M5', 'M15'],
        }),
      });

      await getMT5Timeframes('PRO');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-Tier': 'PRO',
          }),
        })
      );
    });
  });

  // ============================================================================
  // Edge Cases - URL Construction
  // ============================================================================
  describe('URL construction', () => {
    it('should construct correct indicator URL with all params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ohlc: [],
            horizontal: { peak_1: [], peak_2: [], peak_3: [], bottom_1: [], bottom_2: [], bottom_3: [] },
            diagonal: { ascending_1: [], ascending_2: [], ascending_3: [], descending_1: [], descending_2: [], descending_3: [] },
            fractals: { peaks: [], bottoms: [] },
            metadata: { symbol: 'BTCUSD', timeframe: 'M15', tier: 'PRO', bars_returned: 100 },
          },
        }),
      });

      await fetchIndicatorData('BTCUSD', 'M15', 'PRO', 100);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/indicators/BTCUSD/M15?bars=100'),
        expect.anything()
      );
    });

    it('should use default bars count when not specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ohlc: [],
            horizontal: { peak_1: [], peak_2: [], peak_3: [], bottom_1: [], bottom_2: [], bottom_3: [] },
            diagonal: { ascending_1: [], ascending_2: [], ascending_3: [], descending_1: [], descending_2: [], descending_3: [] },
            fractals: { peaks: [], bottoms: [] },
            metadata: { symbol: 'EURUSD', timeframe: 'H4', tier: 'FREE', bars_returned: 1000 },
          },
        }),
      });

      await fetchIndicatorData('EURUSD', 'H4', 'FREE');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('bars=1000'),
        expect.anything()
      );
    });
  });

  // ============================================================================
  // Edge Cases - Health Check Scenarios
  // ============================================================================
  describe('health check scenarios', () => {
    it('should handle health check with no terminals', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'error',
          version: '1.0.0',
          total_terminals: 0,
          connected_terminals: 0,
          terminals: {},
        }),
      });

      const result = await checkMT5Health();
      expect(result.total_terminals).toBe(0);
      expect(result.status).toBe('error');
    });

    it('should handle health check with terminal errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'degraded',
          version: '1.0.0',
          total_terminals: 2,
          connected_terminals: 1,
          terminals: {
            terminal_1: {
              connected: true,
              terminal_id: '1',
              last_check: '2025-12-15T00:00:00Z',
            },
            terminal_2: {
              connected: false,
              terminal_id: '2',
              last_check: '2025-12-15T00:00:00Z',
              error: 'Connection timeout',
            },
          },
        }),
      });

      const result = await checkMT5Health();
      expect(result.terminals['terminal_2'].error).toBe('Connection timeout');
      expect(result.terminals['terminal_2'].connected).toBe(false);
    });
  });
});
