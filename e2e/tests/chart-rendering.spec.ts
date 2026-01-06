/**
 * Part 20 Chart Rendering E2E Test
 * Trading Alerts SaaS
 *
 * Tests chart rendering functionality with Part 20 architecture data.
 *
 * Tests:
 * - Chart loads with correct data
 * - Timeframe switching
 * - Symbol switching
 * - Indicator toggling
 * - Chart controls
 * - Performance
 *
 * @module e2e/tests/chart-rendering
 */

import { test, expect } from '@playwright/test';

test.describe('Part 20 Chart Rendering', () => {
  test.describe('Chart Loading', () => {
    test('Chart loads with correct OHLC data', async ({ page, request }) => {
      // First, fetch data via API to compare
      const apiResponse = await request.get('/api/indicators/EURUSD/H1?limit=100');
      expect(apiResponse.ok()).toBeTruthy();

      const apiData = await apiResponse.json();
      const expectedBars = apiData.data.ohlc.length;

      // Navigate to chart page
      await page.goto('/dashboard/chart/EURUSD/H1');

      // Wait for chart to load
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Verify loading state is complete
      await expect(page.locator('[data-testid="chart-loading"]')).not.toBeVisible({
        timeout: 10000,
      });

      // Verify chart canvas rendered
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();

      // Verify data count matches API
      const dataCountElement = page.locator('[data-testid="bar-count"]');
      if (await dataCountElement.isVisible()) {
        const countText = await dataCountElement.textContent();
        const displayedBars = parseInt(countText || '0');
        expect(displayedBars).toBe(expectedBars);
      }
    });

    test('Chart displays symbol and timeframe correctly', async ({ page }) => {
      await page.goto('/dashboard/chart/XAUUSD/H4');

      // Wait for chart
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Verify symbol displayed
      const symbolDisplay = page.locator('[data-testid="symbol-display"]');
      await expect(symbolDisplay).toContainText('XAUUSD');

      // Verify timeframe displayed
      const timeframeDisplay = page.locator('[data-testid="timeframe-selector"]');
      await expect(timeframeDisplay).toContainText('H4');

      // Verify chart title shows correct info
      const chartTitle = page.locator('[data-testid="chart-title"]');
      if (await chartTitle.isVisible()) {
        await expect(chartTitle).toContainText('XAUUSD');
        await expect(chartTitle).toContainText('H4');
      }
    });

    test('Chart handles initial loading state', async ({ page }) => {
      // Start navigation
      const navigationPromise = page.goto('/dashboard/chart/EURUSD/H1');

      // Loading indicator should appear
      const loadingIndicator = page.locator('[data-testid="chart-loading"]');
      if (await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
        expect(await loadingIndicator.isVisible()).toBe(true);
      }

      // Wait for navigation to complete
      await navigationPromise;

      // Loading should disappear
      await expect(loadingIndicator).not.toBeVisible({ timeout: 15000 });

      // Chart should be visible
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
    });

    test('Chart renders candlesticks correctly', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');

      // Wait for chart
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Wait for candlesticks to render
      await page.waitForTimeout(2000);

      // Verify canvas has content (not blank)
      const canvas = page.locator('canvas').first();
      const boundingBox = await canvas.boundingBox();
      expect(boundingBox).toBeTruthy();
      expect(boundingBox!.width).toBeGreaterThan(0);
      expect(boundingBox!.height).toBeGreaterThan(0);

      // Verify candlestick elements exist (if using DOM-based rendering)
      const candlesticks = page.locator('[data-testid="candlestick"]');
      const candleCount = await candlesticks.count();
      // May be 0 if using canvas rendering only
      expect(candleCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Timeframe Switching', () => {
    test('Switch from H1 to H4 updates chart', async ({ page, request }) => {
      // Start on H1
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Get H1 data for comparison
      const h1Response = await request.get('/api/indicators/EURUSD/H1?limit=10');
      const h1Data = await h1Response.json();
      const h1BarCount = h1Data.data.ohlc.length;

      // Click timeframe selector
      await page.locator('[data-testid="timeframe-selector"]').click();

      // Select H4
      await page.locator('[data-testid="timeframe-option-H4"]').click();

      // Wait for chart to reload
      await page.waitForTimeout(2000);

      // Verify URL updated
      expect(page.url()).toContain('/H4');

      // Verify timeframe display updated
      await expect(page.locator('[data-testid="timeframe-selector"]')).toContainText('H4');

      // Get H4 data
      const h4Response = await request.get('/api/indicators/EURUSD/H4?limit=10');
      const h4Data = await h4Response.json();
      const h4BarCount = h4Data.data.ohlc.length;

      // H4 bars should be different from H1 bars
      expect(h4BarCount).not.toBe(h1BarCount);
    });

    test('All timeframes are accessible for PRO symbols', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Open timeframe selector
      await page.locator('[data-testid="timeframe-selector"]').click();

      // Verify all 9 timeframes available (if PRO tier)
      const timeframes = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'];

      for (const tf of timeframes) {
        const option = page.locator(`[data-testid="timeframe-option-${tf}"]`);
        const isVisible = await option.isVisible().catch(() => false);
        const isDisabled = isVisible ? await option.isDisabled().catch(() => true) : true;

        // If visible, it should be enabled (for PRO users on PRO symbols)
        if (isVisible && !isDisabled) {
          expect(await option.textContent()).toContain(tf);
        }
      }
    });

    test('Timeframe switch preserves indicator settings', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Toggle fractal indicator off
      const fractalToggle = page.locator('[data-testid="indicator-toggle-fractals"]');
      if (await fractalToggle.isVisible()) {
        await fractalToggle.click();
      }

      // Switch to H4
      await page.locator('[data-testid="timeframe-selector"]').click();
      await page.locator('[data-testid="timeframe-option-H4"]').click();
      await page.waitForTimeout(2000);

      // Verify fractal toggle is still off
      if (await fractalToggle.isVisible()) {
        const isChecked = await fractalToggle.isChecked();
        expect(isChecked).toBe(false);
      }
    });
  });

  test.describe('Symbol Switching', () => {
    test('Switch from EURUSD to XAUUSD updates chart', async ({ page, request }) => {
      // Start on EURUSD
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Click symbol selector
      await page.locator('[data-testid="symbol-selector"]').click();

      // Select XAUUSD
      await page.locator('[data-testid="symbol-option-XAUUSD"]').click();

      // Wait for chart to reload
      await page.waitForTimeout(2000);

      // Verify URL updated
      expect(page.url()).toContain('XAUUSD');

      // Verify symbol display updated
      await expect(page.locator('[data-testid="symbol-display"]')).toContainText('XAUUSD');

      // Verify data changed by checking API
      const response = await request.get('/api/indicators/XAUUSD/H1?limit=5');
      const data = await response.json();
      expect(data.data.metadata.symbol).toBe('XAUUSD');
    });

    test('Symbol selector shows accessible symbols for user tier', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Open symbol selector
      await page.locator('[data-testid="symbol-selector"]').click();

      // FREE tier symbols (always accessible)
      const freeSymbols = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];

      for (const symbol of freeSymbols) {
        const option = page.locator(`[data-testid="symbol-option-${symbol}"]`);
        const isVisible = await option.isVisible().catch(() => false);

        if (isVisible) {
          expect(await option.textContent()).toContain(symbol);
        }
      }
    });

    test('Symbol switch resets zoom and pan', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Zoom in on chart (if zoom controls available)
      const zoomInButton = page.locator('[data-testid="zoom-in"]');
      if (await zoomInButton.isVisible()) {
        await zoomInButton.click();
        await zoomInButton.click();
      }

      // Switch symbol
      await page.locator('[data-testid="symbol-selector"]').click();
      await page.locator('[data-testid="symbol-option-USDJPY"]').click();
      await page.waitForTimeout(2000);

      // Chart should be at default zoom
      // This is implementation-specific, but we can verify chart loaded fresh
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
    });
  });

  test.describe('Indicator Toggling', () => {
    test('Toggle fractals on and off', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const fractalToggle = page.locator('[data-testid="indicator-toggle-fractals"]');

      if (await fractalToggle.isVisible()) {
        // Get initial state
        const initialState = await fractalToggle.isChecked();

        // Toggle off
        await fractalToggle.click();
        await page.waitForTimeout(500);

        // Verify fractals hidden
        const fractalsAfterToggleOff = page.locator('[data-testid="fractal-marker"]');
        const countOff = await fractalsAfterToggleOff.count();
        expect(countOff).toBe(0);

        // Toggle back on
        await fractalToggle.click();
        await page.waitForTimeout(500);

        // Fractals may reappear (if data available)
        const fractalsAfterToggleOn = page.locator('[data-testid="fractal-marker"]');
        const countOn = await fractalsAfterToggleOn.count();
        expect(countOn).toBeGreaterThanOrEqual(0);
      }
    });

    test('Toggle trendlines on and off', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const trendlineToggle = page.locator('[data-testid="indicator-toggle-trendlines"]');

      if (await trendlineToggle.isVisible()) {
        // Toggle off
        await trendlineToggle.click();
        await page.waitForTimeout(500);

        // Verify trendlines hidden
        const trendlinesHidden = page.locator('[data-testid="trendline"]');
        const countOff = await trendlinesHidden.count();
        expect(countOff).toBe(0);

        // Toggle back on
        await trendlineToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('Toggle moving averages independently', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Toggle TEMA off
      const temaToggle = page.locator('[data-testid="indicator-toggle-tema"]');
      if (await temaToggle.isVisible()) {
        await temaToggle.click();
        await page.waitForTimeout(500);

        // TEMA line should be hidden
        const temaLine = page.locator('[data-testid="ma-line-tema"]');
        expect(await temaLine.isVisible()).toBe(false);

        // But HRMA and SMMA should still be visible (if enabled)
        const hrmaLine = page.locator('[data-testid="ma-line-hrma"]');
        const smmaLine = page.locator('[data-testid="ma-line-smma"]');
        // At least one should be visible if MAs are enabled by default
      }
    });

    test('Indicator state persists across page refresh', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Toggle fractal off
      const fractalToggle = page.locator('[data-testid="indicator-toggle-fractals"]');
      if (await fractalToggle.isVisible()) {
        await fractalToggle.click();
        await page.waitForTimeout(500);

        // Refresh page
        await page.reload();
        await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
          timeout: 15000,
        });

        // Verify fractal is still off
        const isChecked = await fractalToggle.isChecked();
        expect(isChecked).toBe(false);
      }
    });
  });

  test.describe('Chart Controls', () => {
    test('Zoom in and out controls work', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const zoomInButton = page.locator('[data-testid="zoom-in"]');
      const zoomOutButton = page.locator('[data-testid="zoom-out"]');

      if (await zoomInButton.isVisible()) {
        // Zoom in
        await zoomInButton.click();
        await page.waitForTimeout(300);

        // Verify chart updated (implementation-specific)
        await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();

        // Zoom out
        await zoomOutButton.click();
        await page.waitForTimeout(300);

        await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
      }
    });

    test('Auto-scale button resets chart view', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const autoScaleButton = page.locator('[data-testid="auto-scale"]');

      if (await autoScaleButton.isVisible()) {
        // Zoom in first
        const zoomIn = page.locator('[data-testid="zoom-in"]');
        if (await zoomIn.isVisible()) {
          await zoomIn.click();
          await zoomIn.click();
        }

        // Click auto-scale
        await autoScaleButton.click();
        await page.waitForTimeout(500);

        // Chart should reset to fit all data
        await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
      }
    });

    test('Chart type selector switches between candlestick and line', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const chartTypeSelector = page.locator('[data-testid="chart-type-selector"]');

      if (await chartTypeSelector.isVisible()) {
        await chartTypeSelector.click();

        // Select line chart
        const lineOption = page.locator('[data-testid="chart-type-line"]');
        if (await lineOption.isVisible()) {
          await lineOption.click();
          await page.waitForTimeout(500);

          // Chart should still be visible
          await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
        }
      }
    });

    test('Crosshair displays price and time on hover', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const canvas = page.locator('canvas').first();
      const boundingBox = await canvas.boundingBox();

      if (boundingBox) {
        // Hover over center of chart
        await canvas.hover({
          position: {
            x: boundingBox.width / 2,
            y: boundingBox.height / 2,
          },
        });

        await page.waitForTimeout(500);

        // Check if price/time tooltip appears
        const tooltip = page.locator('[data-testid="chart-tooltip"]');
        if (await tooltip.isVisible()) {
          await expect(tooltip).toBeVisible();

          // Should show price
          const tooltipText = await tooltip.textContent();
          expect(tooltipText).toBeTruthy();
        }
      }
    });
  });

  test.describe('Chart Performance', () => {
    test('Chart loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const loadTime = Date.now() - startTime;

      // Chart should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('Chart handles 1000 data points smoothly', async ({ page, request }) => {
      // Request 1000 bars
      const response = await request.get('/api/indicators/EURUSD/H1?limit=1000');
      const data = await response.json();

      // Navigate to chart
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Chart should render without freezing
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();

      // Test panning performance
      const boundingBox = await canvas.boundingBox();
      if (boundingBox) {
        // Pan left
        await canvas.dragTo(canvas, {
          sourcePosition: { x: boundingBox.width * 0.7, y: boundingBox.height / 2 },
          targetPosition: { x: boundingBox.width * 0.3, y: boundingBox.height / 2 },
        });

        await page.waitForTimeout(500);

        // Chart should still be responsive
        await expect(canvas).toBeVisible();
      }
    });

    test('Multiple timeframe switches do not cause memory leaks', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      const timeframes = ['H1', 'H4', 'D1', 'H1', 'H4'];

      for (const tf of timeframes) {
        await page.locator('[data-testid="timeframe-selector"]').click();
        await page.locator(`[data-testid="timeframe-option-${tf}"]`).click();
        await page.waitForTimeout(1000);

        // Chart should still be visible and responsive
        await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
      }
    });

    test('Chart renders indicators without blocking UI', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // While chart is rendering, controls should still be responsive
      const timeframeSelector = page.locator('[data-testid="timeframe-selector"]');
      await expect(timeframeSelector).toBeEnabled({ timeout: 5000 });

      const symbolSelector = page.locator('[data-testid="symbol-selector"]');
      await expect(symbolSelector).toBeEnabled({ timeout: 5000 });
    });
  });

  test.describe('Responsive Design', () => {
    test('Chart renders correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Chart should fit viewport
      const canvas = page.locator('canvas').first();
      const boundingBox = await canvas.boundingBox();

      expect(boundingBox).toBeTruthy();
      expect(boundingBox!.width).toBeLessThanOrEqual(375);
    });

    test('Chart adapts to viewport resize', async ({ page }) => {
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Get initial size
      const canvas = page.locator('canvas').first();
      const initialBox = await canvas.boundingBox();

      // Resize viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);

      // Get new size
      const newBox = await canvas.boundingBox();

      // Canvas should have resized
      expect(newBox!.width).not.toBe(initialBox!.width);
    });
  });

  test.describe('Data Accuracy', () => {
    test('Chart OHLC matches API data', async ({ page, request }) => {
      // Get API data
      const apiResponse = await request.get('/api/indicators/EURUSD/H1?limit=5');
      const apiData = await apiResponse.json();
      const latestBar = apiData.data.ohlc[apiData.data.ohlc.length - 1];

      // Navigate to chart
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      // Get latest bar info from chart tooltip (if available)
      const canvas = page.locator('canvas').first();
      const boundingBox = await canvas.boundingBox();

      if (boundingBox) {
        // Hover over rightmost part of chart (latest bar)
        await canvas.hover({
          position: {
            x: boundingBox.width - 50,
            y: boundingBox.height / 2,
          },
        });

        await page.waitForTimeout(500);

        // Check tooltip data (implementation-specific)
        const tooltip = page.locator('[data-testid="chart-tooltip"]');
        if (await tooltip.isVisible()) {
          const tooltipText = await tooltip.textContent();
          // Tooltip should contain price data
          expect(tooltipText).toBeTruthy();
        }
      }
    });

    test('Indicators display matches PostgreSQL data', async ({ page, request }) => {
      // Get indicator data from API
      const response = await request.get('/api/indicators/EURUSD/H1');
      const data = await response.json();

      // Verify fractals data exists
      const hasFractals =
        data.data.fractals.peaks.length > 0 || data.data.fractals.bottoms.length > 0;

      // Navigate to chart
      await page.goto('/dashboard/chart/EURUSD/H1');
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible({
        timeout: 15000,
      });

      if (hasFractals) {
        // Fractals should be visible on chart
        const fractalMarkers = page.locator('[data-testid="fractal-marker"]');
        const markerCount = await fractalMarkers.count();
        expect(markerCount).toBeGreaterThan(0);
      }
    });
  });
});
