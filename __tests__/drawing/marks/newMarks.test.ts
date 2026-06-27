/**
 * Tests for the four marks added in item 4: channel, fib retracement,
 * fib extension, text — exercised through the DrawingEngine (deterministic
 * mocked coords: x = time, y = 1000 - price) plus the shared geometry.
 */

import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
} from 'lightweight-charts';

import { DrawingEngine } from '@/components/charts/drawing/engine/DrawingEngine';
import { levelsForMark } from '@/components/charts/drawing/geometry';

interface Primitive {
  attached?: (param: {
    chart: unknown;
    series: unknown;
    requestUpdate: () => void;
  }) => void;
  detached?: () => void;
}

function makeHarness(): {
  chart: IChartApi;
  series: ISeriesApi<SeriesType, Time>;
  attachedCount: () => number;
} {
  const attached: Primitive[] = [];
  const timeScale = {
    timeToCoordinate: (t: number): number => t,
    coordinateToTime: (x: number): number => x,
    getVisibleRange: (): { from: number; to: number } => ({
      from: 0,
      to: 1000,
    }),
    width: (): number => 800,
  };
  const chart = {
    timeScale: () => timeScale,
    paneSize: () => ({ height: 600, width: 800 }),
    applyOptions: (): void => {},
  };
  const series = {
    priceToCoordinate: (p: number): number => 1000 - p,
    coordinateToPrice: (y: number): number => 1000 - y,
    attachPrimitive: (prim: Primitive): void => {
      attached.push(prim);
      prim.attached?.({ chart, series, requestUpdate: (): void => {} });
    },
    detachPrimitive: (prim: Primitive): void => {
      const i = attached.indexOf(prim);
      if (i >= 0) attached.splice(i, 1);
    },
  };
  return {
    chart: chart as unknown as IChartApi,
    series: series as unknown as ISeriesApi<SeriesType, Time>,
    attachedCount: () => attached.length,
  };
}

describe('DrawingEngine — new tool creation', () => {
  it('creates a channel over 3 clicks (3 anchors)', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('CHANNEL');
    engine.handlePointerDown(100, 300);
    engine.handlePointerDown(200, 300);
    expect(engine.getSnapshots()).toHaveLength(1); // still drawing
    engine.handlePointerDown(150, 250); // 3rd click finalizes
    const snap = engine.getSnapshots()[0];
    expect(snap?.type).toBe('CHANNEL');
    expect(snap?.anchors).toHaveLength(3);
    expect(engine.getActiveTool()).toBeNull();
  });

  it('creates a fib retracement over 2 clicks', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('FIB_RETRACE');
    engine.handlePointerDown(100, 300);
    engine.handlePointerDown(200, 200);
    const snap = engine.getSnapshots()[0];
    expect(snap?.type).toBe('FIB_RETRACE');
    expect(snap?.anchors).toHaveLength(2);
  });

  it('creates a fib extension over 3 clicks', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('FIB_EXT');
    engine.handlePointerDown(100, 300);
    engine.handlePointerDown(150, 250);
    engine.handlePointerDown(200, 280);
    const snap = engine.getSnapshots()[0];
    expect(snap?.type).toBe('FIB_EXT');
    expect(snap?.anchors).toHaveLength(3);
  });

  it('creates a text mark on a single click', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('TEXT');
    engine.handlePointerDown(100, 300);
    const snap = engine.getSnapshots()[0];
    expect(snap?.type).toBe('TEXT');
    expect(snap?.anchors).toHaveLength(1);
  });
});

describe('DrawingEngine — selected alert levels', () => {
  it('exposes alert levels for an alertable selected mark', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('HLINE');
    engine.handlePointerDown(100, 300); // finalizes + selects
    expect(engine.getSelectedAlertLevels().map((l) => l.id)).toEqual(['line']);
  });

  it('returns no levels for a selected text mark', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('TEXT');
    engine.handlePointerDown(100, 300);
    expect(engine.getSelectedAlertLevels()).toEqual([]);
  });
});

describe('DrawingEngine — selected style', () => {
  it('reads and updates the selected mark style (and emits onMarksChange)', () => {
    const h = makeHarness();
    const snaps: { id: string; style: { color?: unknown } }[][] = [];
    const engine = new DrawingEngine(h.chart, h.series, {
      onMarksChange: (s) =>
        snaps.push(
          s as unknown as { id: string; style: { color?: unknown } }[]
        ),
    });
    engine.setActiveTool('HLINE');
    engine.handlePointerDown(100, 300); // finalize + select (1 onMarksChange)

    expect(engine.getSelectedType()).toBe('HLINE');
    expect(engine.getSelectedStyle()?.color).toBe('#2962FF');

    engine.updateSelectedStyle({ color: '#ff0000', lineWidth: 4 });
    expect(engine.getSelectedStyle()).toMatchObject({
      color: '#ff0000',
      lineWidth: 4,
    });
    // onMarksChange fired again on style update -> autosave
    expect(snaps.length).toBeGreaterThanOrEqual(2);
    expect(snaps[snaps.length - 1]?.[0]?.style.color).toBe('#ff0000');
  });

  it('returns null style/type when nothing selected', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    expect(engine.getSelectedStyle()).toBeNull();
    expect(engine.getSelectedType()).toBeNull();
  });
});

describe('shared geometry for new marks', () => {
  const baseStyle = {
    color: '#2962FF',
    lineWidth: 2,
    lineStyle: 'solid' as const,
  };

  it('derives channel offset from a 3rd anchor', () => {
    // base flat at price 100; a3 at price 130 => offset +30
    const levels = levelsForMark({
      id: 'c1',
      type: 'CHANNEL',
      anchors: [
        { time: 0, price: 100 },
        { time: 10, price: 100 },
        { time: 5, price: 130 },
      ],
      style: baseStyle,
    });
    const top = levels.find((l) => l.id === 'channel_top');
    const bottom = levels.find((l) => l.id === 'channel_bottom');
    expect(top?.valueAt(5)).toBeCloseTo(130);
    expect(bottom?.valueAt(5)).toBeCloseTo(100);
  });

  it('text marks expose no alert levels', () => {
    const levels = levelsForMark({
      id: 't1',
      type: 'TEXT',
      anchors: [{ time: 0, price: 100 }],
      style: { ...baseStyle, text: 'hello' },
    });
    expect(levels).toEqual([]);
  });
});
