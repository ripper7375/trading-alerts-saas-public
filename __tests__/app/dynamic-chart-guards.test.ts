/**
 * T3-a: the heavy chart canvases and the modals that are closed until asked
 * for are loaded with `next/dynamic(..., { ssr: false })`, behind a skeleton of
 * the chart's own height. A static import of one of them would put it back in
 * the page's first bundle without any other test noticing, so this reads the
 * sources.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const read = (file: string): string =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

interface LazyUse {
  /** The file that must load it on demand. */
  file: string;
  /** The module that must be reached only through `import()`. */
  module: string;
  /** The exported component it is wrapped as. */
  component: string;
  /** The skeleton height constant, when the module shows a placeholder. */
  skeletonHeight?: string;
}

const LAZY_USES: LazyUse[] = [
  {
    file: 'components/currency-index-pro/pro-currency-index-cockpit.tsx',
    module: './chart/relative-strength-chart',
    component: 'RelativeStrengthChart',
    skeletonHeight: 'RELATIVE_STRENGTH_CHART_HEIGHT',
  },
  {
    file: 'components/currency-index-pro/pro-currency-index-cockpit.tsx',
    module: './chart/hrma-smma-detail-modal',
    component: 'HrmaSmmaDetailModal',
  },
  {
    file: 'components/currency-index-pro/pro-currency-index-cockpit.tsx',
    module: './chart/pair-chart-modal',
    component: 'PairChartModal',
  },
  {
    file: 'components/currency-index-comparison/currency-index-comparison-workspace.tsx',
    module: './currency-index-comparison-chart',
    component: 'CurrencyIndexComparisonChart',
    skeletonHeight: 'COMPARISON_CHART_HEIGHT',
  },
  {
    file: 'components/market/xaux-usdx-workspace.tsx',
    module: '@/components/market/xaux-usdx-comparison-chart',
    component: 'XauxUsdxComparisonChart',
    skeletonHeight: 'XAUX_USDX_CHART_HEIGHT',
  },
  {
    file: 'components/admin/analytics/lazy-charts.tsx',
    module: '@/components/admin/analytics/historical-trend-chart',
    component: 'HistoricalTrendChart',
  },
  {
    file: 'components/admin/analytics/lazy-charts.tsx',
    module: '@/components/admin/analytics/donut-market-share',
    component: 'DonutMarketShare',
  },
];

const escape = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

describe.each(LAZY_USES)('$component in $file', (use) => {
  const source = read(use.file);

  it('is reached only through import(), never a static import', () => {
    const staticImport = new RegExp(
      `^import\\s+(?!type\\b)[^;]*from\\s+['"]${escape(use.module)}['"]`,
      'm'
    );
    expect(source).not.toMatch(staticImport);
    expect(source).toMatch(
      new RegExp(`import\\(\\s*['"]${escape(use.module)}['"]\\s*\\)`)
    );
  });

  it('is wrapped in next/dynamic with ssr: false', () => {
    expect(source).toMatch(/import dynamic from 'next\/dynamic'/);
    const wrapper = new RegExp(
      `const\\s+(?:Lazy)?${use.component}\\s*=\\s*dynamic\\(([\\s\\S]*?)\\n\\);`
    );
    const match = source.match(wrapper);
    expect(match).not.toBeNull();
    expect(match?.[1]).toMatch(/ssr:\s*false/);
    expect(match?.[1]).toContain(`mod.${use.component}`);
  });

  if (use.skeletonHeight) {
    it(`holds the chart's height with a skeleton (${use.skeletonHeight})`, () => {
      expect(source).toMatch(
        new RegExp(`<ChartSkeleton\\s+height=\\{${use.skeletonHeight}\\}`)
      );
    });
  }
});

describe("the skeleton heights are the charts' own", () => {
  const heightOf = (file: string, name: string): number => {
    const match = read(file).match(
      new RegExp(`export const ${name}\\s*=\\s*(\\d+);`)
    );
    expect(match).not.toBeNull();
    return Number(match?.[1]);
  };
  const defaultHeightUses = (file: string, name: string): boolean =>
    new RegExp(`^\\s+height = ${name},$`, 'm').test(read(file));

  it.each([
    [
      'components/currency-index-pro/chart/relative-strength-config.ts',
      'components/currency-index-pro/chart/relative-strength-chart.tsx',
      'RELATIVE_STRENGTH_CHART_HEIGHT',
      480,
    ],
    [
      'components/currency-index-comparison/comparison-config.ts',
      'components/currency-index-comparison/currency-index-comparison-chart.tsx',
      'COMPARISON_CHART_HEIGHT',
      520,
    ],
    [
      'components/market/xaux-usdx-chart-config.ts',
      'components/market/xaux-usdx-comparison-chart.tsx',
      'XAUX_USDX_CHART_HEIGHT',
      480,
    ],
  ])(
    '%s sets the default plot height of %s',
    (configFile, chartFile, name, expected) => {
      expect(heightOf(configFile, name)).toBe(expected);
      // The chart's `height` default is that constant, not a copy of its value.
      expect(defaultHeightUses(chartFile, name)).toBe(true);
    }
  );
});

describe('the plain-value modules stay free of the charts', () => {
  it.each([
    'components/currency-index-comparison/comparison-config.ts',
    'components/market/xaux-usdx-chart-config.ts',
    'components/currency-index-pro/chart/relative-strength-config.ts',
  ])('%s imports no chart library and no chart component', (file) => {
    const imports = read(file).match(/^import[^;]*;/gm) ?? [];
    for (const statement of imports) {
      expect(statement).not.toMatch(/lightweight-charts|recharts/);
      expect(statement).toMatch(/^import type\b/);
    }
  });
});
