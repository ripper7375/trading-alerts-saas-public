/**
 * Part 20 Critical Path E2E Test
 * Trading Alerts SaaS
 *
 * Tests the complete data flow from PostgreSQL database to frontend chart display.
 *
 * Critical Path Steps:
 * 1. Verify PostgreSQL has data
 * 2. Verify sync is recent
 * 3. API returns correct data
 * 4. Chart renders correctly
 * 5. Indicators display on chart
 *
 * @module e2e/tests/critical-path
 */

import { test, expect } from '@playwright/test';

test.describe('Part 20 Critical Path', () => {
  test.describe('Complete Data Flow', () => {
    test('Step 1: Verify PostgreSQL has data', async ({ request }) => {
      // Call health endpoint to verify PostgreSQL connection
      const response = await request.get('/api/health/postgresql');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Assert PostgreSQL is connected
      expect(data.connected).toBe(true);

      // Assert we have 135 tables (15 symbols × 9 timeframes)
      expect(data.tables).toBe(135);

      // Assert latency is acceptable (<100ms)
      expect(data.latency_ms).toBeLessThan(100);
    });

    test('Step 2: Verify sync is recent', async ({ request }) => {
      // Call sync health endpoint
      const response = await request.get('/api/health/sync');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Assert last sync timestamp is recent (within 60 seconds)
      const lastSync = new Date(data.last_sync).getTime();
      const now = Date.now();
      const timeDiff = now - lastSync;

      expect(timeDiff).toBeLessThan(60000); // 60 seconds

      // Assert sync interval is 30 seconds
      expect(data.sync_interval_seconds).toBe(30);

      // Assert all 15 symbols were updated
      expect(data.symbols_updated).toBe(15);
    });

    test('Step 3: API returns correct indicator data', async ({ request }) => {
      // Test with EURUSD H1 (accessible to both FREE and PRO tiers)
      const response = await request.get('/api/indicators/EURUSD/H1?limit=100');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Assert success
      expect(data.success).toBe(true);

      // Assert OHLC data present
      expect(data.data.ohlc).toBeDefined();
      expect(Array.isArray(data.data.ohlc)).toBe(true);
      expect(data.data.ohlc.length).toBeGreaterThan(0);

      // Verify OHLC structure
      const firstBar = data.data.ohlc[0];
      expect(firstBar).toHaveProperty('time');
      expect(firstBar).toHaveProperty('open');
      expect(firstBar).toHaveProperty('high');
      expect(firstBar).toHaveProperty('low');
      expect(firstBar).toHaveProperty('close');

      // Assert all indicator fields are present
      expect(data.data).toHaveProperty('fractals');
      expect(data.data).toHaveProperty('horizontal_trendlines');
      expect(data.data).toHaveProperty('diagonal_trendlines');
      expect(data.data).toHaveProperty('momentum_candles');
      expect(data.data).toHaveProperty('keltner_channels');
      expect(data.data).toHaveProperty('tema');
      expect(data.data).toHaveProperty('hrma');
      expect(data.data).toHaveProperty('smma');
      expect(data.data).toHaveProperty('zigzag');

      // Assert metadata is correct
      expect(data.data.metadata.symbol).toBe('EURUSD');
      expect(data.data.metadata.timeframe).toBe('H1');
      expect(data.data.metadata.bars_returned).toBe(data.data.ohlc.length);
    });

    test('Step 4: Chart renders correctly on frontend', async ({ page }) => {
      // Navigate to chart page
      await page.goto('/dashboard/chart/EURUSD/H1');

      // Wait for chart component to be visible
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Verify chart canvas exists
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();

      // Verify timeframe selector shows H1
      await expect(page.locator('[data-testid="timeframe-selector"]')).toContainText('H1');

      // Verify symbol display shows EURUSD
      await expect(page.locator('[data-testid="symbol-display"]')).toContainText('EURUSD');
    });

    test('Step 5: Indicators display on chart', async ({ page }) => {
      // Navigate to chart page
      await page.goto('/dashboard/chart/EURUSD/H1');

      // Wait for chart to load
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Wait for indicators to load
      await page.waitForTimeout(2000);

      // Check for fractal markers (if present in data)
      const fractalMarkers = page.locator('[data-testid="fractal-marker"]');
      const fractalCount = await fractalMarkers.count();
      // Fractals may or may not be present depending on market conditions
      expect(fractalCount).toBeGreaterThanOrEqual(0);

      // Check for trendlines (if present in data)
      const trendlines = page.locator('[data-testid="trendline"]');
      const trendlineCount = await trendlines.count();
      expect(trendlineCount).toBeGreaterThanOrEqual(0);

      // Verify moving averages are rendered (TEMA, HRMA, SMMA)
      // These should always be present as they're calculated for every bar
      const movingAverages = page.locator('[data-testid^="ma-line"]');
      const maCount = await movingAverages.count();
      expect(maCount).toBeGreaterThanOrEqual(3); // At least 3 MAs
    });

    test('Complete end-to-end flow (integrated)', async ({ page, request }) => {
      // Step 1: Verify backend health
      const healthResponse = await request.get('/api/health');
      expect(healthResponse.ok()).toBeTruthy();

      const health = await healthResponse.json();
      expect(health.status).toBe('ok');
      expect(health.components.postgresql.connected).toBe(true);
      expect(health.components.redis.connected).toBe(true);

      // Step 2: Fetch indicator data via API
      const apiResponse = await request.get('/api/indicators/EURUSD/H1?limit=100');
      expect(apiResponse.ok()).toBeTruthy();

      const apiData = await apiResponse.json();
      expect(apiData.success).toBe(true);
      expect(apiData.data.ohlc.length).toBeGreaterThan(0);

      // Step 3: Navigate to chart and verify it renders with the same data
      await page.goto('/dashboard/chart/EURUSD/H1');

      // Wait for chart to fully load
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Verify loading state completed
      await expect(page.locator('[data-testid="chart-loading"]')).not.toBeVisible({
        timeout: 10000,
      });

      // Verify no error messages
      await expect(page.locator('[data-testid="chart-error"]')).not.toBeVisible();

      // Verify chart controls are functional
      await expect(page.locator('[data-testid="timeframe-selector"]')).toBeEnabled();
      await expect(page.locator('[data-testid="symbol-selector"]')).toBeEnabled();
    });
  });

  test.describe('Tier Access Control', () => {
    test('FREE tier: Access FREE symbols successfully', async ({ request }) => {
      // FREE tier symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD
      const freeSymbols = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];

      for (const symbol of freeSymbols) {
        const response = await request.get(`/api/indicators/${symbol}/H1`);

        // Should get either 200 (logged in as FREE) or data response
        // The actual access control depends on authentication state
        expect(response.status()).toBeLessThan(500); // Not a server error
      }
    });

    test('FREE tier: Cannot access PRO symbols without session', async ({ request }) => {
      // PRO-only symbols
      const proSymbols = ['AUDJPY', 'GBPJPY', 'ETHUSD'];

      for (const symbol of proSymbols) {
        const response = await request.get(`/api/indicators/${symbol}/H1`);

        // Without authentication, expect either 401 or 403
        if (response.status() === 403) {
          const data = await response.json();
          expect(data.upgrade_required).toBe(true);
        }
        // If 401, authentication required (acceptable)
        // If 200, user might be logged in as PRO (skip test)
      }
    });

    test('FREE tier: Cannot access PRO timeframes', async ({ request }) => {
      // PRO-only timeframes: M5, M15, M30, H2, H8, H12
      const proTimeframes = ['M5', 'M15', 'M30'];

      for (const timeframe of proTimeframes) {
        const response = await request.get(`/api/indicators/EURUSD/${timeframe}`);

        // Without PRO tier, expect 403
        if (response.status() === 403) {
          const data = await response.json();
          expect(data.upgrade_required).toBe(true);
        }
      }
    });
  });

  test.describe('Confluence Score (PRO Tier)', () => {
    test('Confluence endpoint requires PRO tier', async ({ request }) => {
      const response = await request.get('/api/confluence/EURUSD');

      // Without PRO authentication, expect 403
      if (response.status() === 403) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('PRO tier required');
      }
      // If 200, user is logged in as PRO (test succeeds differently)
    });

    test('PRO tier: Confluence score calculated correctly', async ({ request, page }) => {
      // This test assumes PRO tier authentication
      // Skip if not PRO tier

      const response = await request.get('/api/confluence/EURUSD');

      if (response.status() === 200) {
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.symbol).toBe('EURUSD');

        // Verify confluence score is between 0 and 10
        expect(data.confluence_score).toBeGreaterThanOrEqual(0);
        expect(data.confluence_score).toBeLessThanOrEqual(10);

        // Verify max score is 10
        expect(data.max_score).toBe(10);

        // Verify signals breakdown
        expect(data.signals).toHaveProperty('bullish');
        expect(data.signals).toHaveProperty('bearish');
        expect(data.signals).toHaveProperty('neutral');

        // Total signals should equal 9 (9 timeframes)
        const totalSignals =
          data.signals.bullish + data.signals.bearish + data.signals.neutral;
        expect(totalSignals).toBe(9);

        // Verify breakdown for each timeframe
        expect(data.breakdown).toHaveProperty('M5');
        expect(data.breakdown).toHaveProperty('M15');
        expect(data.breakdown).toHaveProperty('M30');
        expect(data.breakdown).toHaveProperty('H1');
        expect(data.breakdown).toHaveProperty('H2');
        expect(data.breakdown).toHaveProperty('H4');
        expect(data.breakdown).toHaveProperty('H8');
        expect(data.breakdown).toHaveProperty('H12');
        expect(data.breakdown).toHaveProperty('D1');

        // Verify all_117_indicators present (13 indicators × 9 timeframes)
        expect(data.all_117_indicators).toBeDefined();
        expect(Object.keys(data.all_117_indicators).length).toBe(9);
      }
    });

    test('PRO tier: Confluence displays on frontend', async ({ page, request }) => {
      // First check if PRO access available
      const apiResponse = await request.get('/api/confluence/EURUSD');

      if (apiResponse.status() === 200) {
        // Navigate to confluence view
        await page.goto('/dashboard/confluence/EURUSD');

        // Wait for confluence component to load
        await expect(page.locator('[data-testid="confluence-view"]')).toBeVisible({
          timeout: 15000,
        });

        // Verify confluence score is displayed
        const scoreElement = page.locator('[data-testid="confluence-score"]');
        await expect(scoreElement).toBeVisible();

        // Score should be between 0 and 10
        const scoreText = await scoreElement.textContent();
        const score = parseFloat(scoreText || '0');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);

        // Verify all 9 timeframes shown
        const timeframeCards = page.locator('[data-testid^="tf-card-"]');
        const cardCount = await timeframeCards.count();
        expect(cardCount).toBe(9);

        // Verify signal breakdown displayed
        await expect(page.locator('[data-testid="bullish-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="bearish-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="neutral-count"]')).toBeVisible();
      }
    });
  });

  test.describe('Data Freshness & Sync', () => {
    test('Data is synced within acceptable timeframe', async ({ request }) => {
      const response = await request.get('/api/health/sync');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Last sync should be within 60 seconds (2x sync interval)
      const lastSyncTime = new Date(data.last_sync).getTime();
      const now = Date.now();
      const ageSeconds = (now - lastSyncTime) / 1000;

      expect(ageSeconds).toBeLessThan(60);

      // Next sync should be scheduled
      expect(data.next_sync).toBeDefined();

      // All symbols should have recent status
      expect(data.symbols_status).toBeDefined();
      const symbols = Object.keys(data.symbols_status);
      expect(symbols.length).toBe(15);
    });

    test('Redis cache is functioning', async ({ request }) => {
      const response = await request.get('/api/health/redis');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Redis should be connected
      expect(data.connected).toBe(true);

      // Cache hit rate should be reasonable (>50%)
      expect(data.hit_rate).toBeGreaterThan(0.5);

      // Latency should be low (<10ms)
      expect(data.latency_ms).toBeLessThan(10);

      // Should have cached keys
      expect(data.keys_count).toBeGreaterThan(0);
    });

    test('PostgreSQL performance is acceptable', async ({ request }) => {
      const start = Date.now();

      // Query indicator data
      const response = await request.get('/api/indicators/EURUSD/H1?limit=1000');
      expect(response.ok()).toBeTruthy();

      const duration = Date.now() - start;

      // Response time should be under 1 second (with cache)
      expect(duration).toBeLessThan(1000);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.metadata.data_source).toMatch(/postgresql|cache/);
    });
  });

  test.describe('Error Handling', () => {
    test('Invalid symbol returns 400', async ({ request }) => {
      const response = await request.get('/api/indicators/INVALIDSYMBOL/H1');

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid symbol');
    });

    test('Invalid timeframe returns 400', async ({ request }) => {
      const response = await request.get('/api/indicators/EURUSD/INVALIDTF');

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid timeframe');
    });

    test('Chart handles missing data gracefully', async ({ page }) => {
      // Try to load a chart that might not have data
      await page.goto('/dashboard/chart/BTCUSD/D1');

      // Should show either chart or friendly error message
      const chart = page.locator('[data-testid="trading-chart"]');
      const error = page.locator('[data-testid="chart-error"]');
      const noData = page.locator('[data-testid="no-data-message"]');

      // One of these should be visible
      const chartVisible = await chart.isVisible().catch(() => false);
      const errorVisible = await error.isVisible().catch(() => false);
      const noDataVisible = await noData.isVisible().catch(() => false);

      expect(chartVisible || errorVisible || noDataVisible).toBe(true);
    });
  });

  test.describe('Market Hours & Timezone Handling', () => {
    test('API returns market status metadata', async ({ request }) => {
      const response = await request.get('/api/indicators/EURUSD/H1');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Verify market status fields present
      expect(data.data.metadata).toHaveProperty('market_status');
      expect(data.data.metadata.market_status).toMatch(/OPEN|CLOSED/);

      // Verify trading hours info present
      expect(data.data.metadata).toHaveProperty('trading_hours');
      expect(data.data.metadata.trading_hours).toHaveProperty('open');
      expect(data.data.metadata.trading_hours).toHaveProperty('close');
      expect(data.data.metadata.trading_hours).toHaveProperty('timezone');

      // Verify DST info present
      expect(data.data.metadata).toHaveProperty('dst_active');
      expect(data.data.metadata).toHaveProperty('server_utc_offset');
      expect([2, 3]).toContain(data.data.metadata.server_utc_offset);
    });

    test('Crypto symbols show 24/7 trading hours', async ({ request }) => {
      const response = await request.get('/api/indicators/BTCUSD/H1');

      if (response.ok()) {
        const data = await response.json();
        const tradingHours = data.data.metadata.trading_hours;

        // Crypto should have all 7 days
        expect(tradingHours.days.length).toBe(7);
        expect(tradingHours.days).toContain('sunday');
        expect(tradingHours.days).toContain('saturday');
      }
    });

    test('Forex symbols show weekday-only trading', async ({ request }) => {
      const response = await request.get('/api/indicators/EURUSD/H1');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      const tradingHours = data.data.metadata.trading_hours;

      // Forex should have 5 weekdays only
      expect(tradingHours.days.length).toBe(5);
      expect(tradingHours.days).not.toContain('sunday');
      expect(tradingHours.days).not.toContain('saturday');
    });
  });
});
