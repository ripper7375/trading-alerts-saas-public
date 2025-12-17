/**
 * Alert Validation Tests
 *
 * Tests for alert validation schemas.
 */

import {
  createAlertSchema,
  updateAlertSchema,
  listAlertsSchema,
  isSymbolValidForTier,
  getAllowedSymbols,
  createAlertSchemaForTier,
  SYMBOLS,
  FREE_SYMBOLS,
  TIMEFRAMES,
  CONDITION_TYPES,
} from '@/lib/validations/alert';

describe('Alert Validation Schemas', () => {
  describe('createAlertSchema', () => {
    it('should validate valid alert creation data', () => {
      const valid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 2000,
      };

      const result = createAlertSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should validate all optional fields', () => {
      const valid = {
        symbol: 'EURUSD',
        timeframe: 'M15',
        conditionType: 'price_below',
        targetValue: 1.0850,
        name: 'My Alert',
        notes: 'Watch this level',
        enabled: true,
        notifyEmail: true,
        notifyPush: false,
      };

      const result = createAlertSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject invalid symbol', () => {
      const invalid = {
        symbol: 'INVALID',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 2000,
      };

      const result = createAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject invalid timeframe', () => {
      const invalid = {
        symbol: 'XAUUSD',
        timeframe: 'M1',
        conditionType: 'price_above',
        targetValue: 2000,
      };

      const result = createAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject invalid condition type', () => {
      const invalid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'invalid_condition',
        targetValue: 2000,
      };

      const result = createAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject negative target value', () => {
      const invalid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: -100,
      };

      const result = createAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject zero target value', () => {
      const invalid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 0,
      };

      const result = createAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject target value exceeding maximum', () => {
      const invalid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 1000001,
      };

      const result = createAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should default enabled to true', () => {
      const input = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 2000,
      };

      const result = createAlertSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });
  });

  describe('updateAlertSchema', () => {
    it('should validate partial update', () => {
      const valid = {
        id: 'alert-123',
        enabled: false,
      };

      const result = updateAlertSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should require id', () => {
      const invalid = {
        enabled: false,
      };

      const result = updateAlertSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should validate all updatable fields', () => {
      const valid = {
        id: 'alert-123',
        symbol: 'EURUSD',
        timeframe: 'M30',
        conditionType: 'price_below',
        targetValue: 1.0900,
        name: 'Updated Alert',
        notes: 'New notes',
        enabled: true,
        notifyEmail: false,
        notifyPush: true,
      };

      const result = updateAlertSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });
  });

  describe('listAlertsSchema', () => {
    it('should apply defaults', () => {
      const result = listAlertsSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should validate filter options', () => {
      const valid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        enabled: true,
        triggered: false,
        limit: 10,
        offset: 20,
      };

      const result = listAlertsSchema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject limit above 100', () => {
      const invalid = {
        limit: 101,
      };

      const result = listAlertsSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const invalid = {
        offset: -1,
      };

      const result = listAlertsSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });
  });

  describe('isSymbolValidForTier', () => {
    it('should allow XAUUSD for FREE tier', () => {
      expect(isSymbolValidForTier('XAUUSD', 'FREE')).toBe(true);
    });

    it('should reject PRO symbols for FREE tier', () => {
      expect(isSymbolValidForTier('EURUSD', 'FREE')).toBe(false);
      expect(isSymbolValidForTier('BTCUSD', 'FREE')).toBe(false);
    });

    it('should allow all symbols for PRO tier', () => {
      SYMBOLS.forEach((symbol) => {
        expect(isSymbolValidForTier(symbol, 'PRO')).toBe(true);
      });
    });

    it('should reject invalid symbols for any tier', () => {
      expect(isSymbolValidForTier('INVALID', 'FREE')).toBe(false);
      expect(isSymbolValidForTier('INVALID', 'PRO')).toBe(false);
    });
  });

  describe('getAllowedSymbols', () => {
    it('should return FREE_SYMBOLS for FREE tier', () => {
      const symbols = getAllowedSymbols('FREE');

      expect(symbols).toEqual(FREE_SYMBOLS);
      expect(symbols).toContain('XAUUSD');
      expect(symbols.length).toBe(1);
    });

    it('should return all SYMBOLS for PRO tier', () => {
      const symbols = getAllowedSymbols('PRO');

      expect(symbols).toEqual(SYMBOLS);
      expect(symbols.length).toBe(10);
    });
  });

  describe('createAlertSchemaForTier', () => {
    it('should validate FREE tier symbols', () => {
      const schema = createAlertSchemaForTier('FREE');
      const valid = {
        symbol: 'XAUUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 2000,
      };

      const result = schema.safeParse(valid);

      expect(result.success).toBe(true);
    });

    it('should reject PRO symbols for FREE tier', () => {
      const schema = createAlertSchemaForTier('FREE');
      const invalid = {
        symbol: 'EURUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 1.0850,
      };

      const result = schema.safeParse(invalid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('FREE tier');
      }
    });

    it('should allow all symbols for PRO tier', () => {
      const schema = createAlertSchemaForTier('PRO');

      SYMBOLS.forEach((symbol) => {
        const result = schema.safeParse({
          symbol,
          timeframe: 'H1',
          conditionType: 'price_above',
          targetValue: 1000,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Constants', () => {
    it('should export correct SYMBOLS', () => {
      expect(SYMBOLS).toContain('XAUUSD');
      expect(SYMBOLS).toContain('EURUSD');
      expect(SYMBOLS).toContain('BTCUSD');
      expect(SYMBOLS.length).toBe(10);
    });

    it('should export correct TIMEFRAMES', () => {
      expect(TIMEFRAMES).toContain('M15');
      expect(TIMEFRAMES).toContain('H1');
      expect(TIMEFRAMES).toContain('D1');
      expect(TIMEFRAMES.length).toBe(7);
    });

    it('should export correct CONDITION_TYPES', () => {
      expect(CONDITION_TYPES).toContain('price_above');
      expect(CONDITION_TYPES).toContain('price_below');
      expect(CONDITION_TYPES).toContain('price_equals');
    });
  });
});
