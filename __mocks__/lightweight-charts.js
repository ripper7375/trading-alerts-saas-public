// Mock for lightweight-charts to prevent Jest module-resolution failures.
//
// lightweight-charts@5 ships ESM-only ("type": "module", exports map with
// only an "import" condition, no "require" fallback). Jest's default
// CommonJS resolver cannot load that, so any test that transitively imports
// a runtime (non-type) binding from this package fails with
// "Cannot find module 'lightweight-charts'" — even when the file is
// genuinely installed on disk. This mock is wired up via jest.config.js's
// moduleNameMapper so Jest never attempts to resolve the real package.
//
// Individual test files can still override this with their own
// jest.mock('lightweight-charts', () => ({ ... })) when they need more
// specific chart/series behavior (e.g. __tests__/components/charts/trading-chart.test.tsx).

const createSeriesStub = () => ({
  setData: jest.fn(),
  update: jest.fn(),
  setMarkers: jest.fn(),
  applyOptions: jest.fn(),
  priceScale: jest.fn(() => ({ applyOptions: jest.fn() })),
});

const createChartStub = () => ({
  addSeries: jest.fn(() => createSeriesStub()),
  addCandlestickSeries: jest.fn(() => createSeriesStub()),
  addLineSeries: jest.fn(() => createSeriesStub()),
  removeSeries: jest.fn(),
  applyOptions: jest.fn(),
  remove: jest.fn(),
  resize: jest.fn(),
  timeScale: jest.fn(() => ({
    fitContent: jest.fn(),
    applyOptions: jest.fn(),
  })),
  priceScale: jest.fn(() => ({ applyOptions: jest.fn() })),
  subscribeCrosshairMove: jest.fn(),
  unsubscribeCrosshairMove: jest.fn(),
  subscribeClick: jest.fn(),
  unsubscribeClick: jest.fn(),
});

module.exports = {
  __esModule: true,
  createChart: jest.fn(() => createChartStub()),
  createSeriesMarkers: jest.fn(() => ({
    setMarkers: jest.fn(),
    markers: jest.fn(() => []),
  })),
  ColorType: { Solid: 'solid', VerticalGradient: 'gradient' },
  LineStyle: {
    Solid: 0,
    Dotted: 1,
    Dashed: 2,
    LargeDashed: 3,
    SparseDotted: 4,
  },
  CrosshairMode: { Normal: 0, Magnet: 1 },
  // Series-type tokens passed to chart.addSeries(<Token>, options) in v5.
  CandlestickSeries: 'Candlestick',
  LineSeries: 'Line',
  AreaSeries: 'Area',
  BarSeries: 'Bar',
  HistogramSeries: 'Histogram',
  BaselineSeries: 'Baseline',
};
