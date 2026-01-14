Based on the work completed in this session, here are all the files modified/deleted related to removing fractal plots and trendline drawings:

Files Deleted (Frontend - Fractal/Trendline Removal)

1. components/charts/indicator-overlay.tsx (256 lines) - Rendered fractals and trendlines

2. frontend/components/charts/indicator-overlay.tsx (duplicate)

Files Modified (Frontend - Fractal/Trendline Removal)

Production Files

3. components/charts/trading-chart.tsx - Simplified to OHLCV-only:
   Removed import IndicatorOverlay
   Removed horizontal/diagonal/fractals data structures
   Removed IndicatorOverlay component rendering
   Updated to only render candlestick data

4. frontend/components/charts/trading-chart.tsx - Same changes as above (duplicate file)

Test Files

5. **tests**/components/charts/trading-chart.test.tsx - Updated tests:
   Removed jest.mock('@/components/charts/indicator-overlay')
   Removed tests for "Try Again" button (2 tests)
   Removed test for current price display
   Removed test for legend "Resistance (P-P1)"
   Updated text expectations to match simplified component
   Changed price formatting tests to verify data loading instead of display
