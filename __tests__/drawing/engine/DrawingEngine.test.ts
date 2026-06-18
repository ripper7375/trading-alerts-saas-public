/**
 * Interaction tests for DrawingEngine.
 *
 * The chart + series are mocked so `coords` is deterministic (no real canvas):
 *   x  = time           (timeToCoordinate / coordinateToTime are identity)
 *   y  = 1000 - price   (priceToCoordinate), price = 1000 - y (coordinateToPrice)
 * The mock `attachPrimitive` invokes `attached()` exactly as Lightweight Charts
 * does, so marks receive their coords and hit-testing works.
 */

import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
} from 'lightweight-charts';

import { DrawingEngine } from '@/components/charts/drawing/engine/DrawingEngine';

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
  scrollEnabled: () => boolean;
} {
  const attached: Primitive[] = [];
  let scroll = true;

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
    applyOptions: (o: {
      handleScroll?: boolean;
      handleScale?: boolean;
    }): void => {
      if (typeof o.handleScroll === 'boolean') scroll = o.handleScroll;
    },
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
      prim.detached?.();
    },
  };

  return {
    chart: chart as unknown as IChartApi,
    series: series as unknown as ISeriesApi<SeriesType, Time>,
    attachedCount: () => attached.length,
    scrollEnabled: () => scroll,
  };
}

describe('DrawingEngine — drawing', () => {
  it('creates a horizontal line on a single click and finalizes', () => {
    const h = makeHarness();
    const toolChanges: (string | null)[] = [];
    const engine = new DrawingEngine(h.chart, h.series, {
      onActiveToolChange: (t) => toolChanges.push(t),
    });

    engine.setActiveTool('HLINE');
    engine.handlePointerDown(100, 300); // price = 700

    const snaps = engine.getSnapshots();
    expect(snaps).toHaveLength(1);
    expect(snaps[0]?.type).toBe('HLINE');
    expect(snaps[0]?.anchors[0]?.price).toBeCloseTo(700);
    expect(h.attachedCount()).toBe(1);
    // One-shot: tool resets to null after finalize, new mark selected.
    expect(engine.getActiveTool()).toBeNull();
    expect(engine.hasSelection()).toBe(true);
    expect(toolChanges).toEqual(['HLINE', null]);
  });

  it('creates a trendline over two clicks with live preview', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);

    engine.setActiveTool('TRENDLINE');
    engine.handlePointerDown(100, 300); // a1 = { time:100, price:700 }
    engine.handlePointerMove(200, 250); // preview a2
    let snap = engine.getSnapshots()[0];
    expect(snap?.anchors[1]?.price).toBeCloseTo(750); // preview applied

    engine.handlePointerDown(200, 250); // commit a2
    snap = engine.getSnapshots()[0];
    expect(snap?.type).toBe('TRENDLINE');
    expect(snap?.anchors).toHaveLength(2);
    expect(snap?.anchors[0]).toMatchObject({ time: 100, price: 700 });
    expect(snap?.anchors[1]).toMatchObject({ time: 200, price: 750 });
  });

  it('disables pan while drawing and restores it after finalize', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);

    engine.setActiveTool('TRENDLINE');
    engine.handlePointerDown(100, 300);
    expect(h.scrollEnabled()).toBe(false); // mid-draw
    engine.handlePointerDown(200, 250); // finalize
    expect(h.scrollEnabled()).toBe(true);
  });

  it('Escape cancels an in-progress drawing', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);

    engine.setActiveTool('TRENDLINE');
    engine.handlePointerDown(100, 300); // first click only
    expect(h.attachedCount()).toBe(1);
    engine.handleEscape();
    expect(h.attachedCount()).toBe(0);
    expect(engine.getSnapshots()).toHaveLength(0);
  });
});

describe('DrawingEngine — selection & editing', () => {
  function withHLine(): {
    engine: DrawingEngine;
    h: ReturnType<typeof makeHarness>;
  } {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('HLINE');
    engine.handlePointerDown(100, 300); // HLINE at price 700 (y=300)
    return { engine, h };
  }

  it('selects a mark by click and clears on empty click', () => {
    const { engine } = withHLine();
    const selections: (string | null)[] = [];
    // re-wire selection callback by drawing fresh with callback
    const h = makeHarness();
    const e2 = new DrawingEngine(h.chart, h.series, {
      onSelectionChange: (id) => selections.push(id),
    });
    e2.setActiveTool('HLINE');
    e2.handlePointerDown(100, 300); // finalize selects new mark
    expect(e2.hasSelection()).toBe(true);

    e2.handleSelectAt(400, 50); // empty area (line is at y=300)
    expect(e2.hasSelection()).toBe(false);
    expect(selections[selections.length - 1]).toBeNull();
    void engine;
  });

  it('body-drags a horizontal line to a new price', () => {
    const { engine } = withHLine();
    // already selected after finalize; grab body at (x=100, y=300)
    engine.handlePointerDown(100, 300);
    engine.handlePointerMove(100, 350); // y 300 -> 350 => price 700 -> 650
    engine.handlePointerUp();

    const snap = engine.getSnapshots()[0];
    expect(snap?.anchors[0]?.price).toBeCloseTo(650);
  });

  it('handle-drags a trendline endpoint', () => {
    const h = makeHarness();
    const engine = new DrawingEngine(h.chart, h.series);
    engine.setActiveTool('TRENDLINE');
    engine.handlePointerDown(100, 300); // a1
    engine.handlePointerDown(200, 250); // a2, finalized + selected

    engine.handlePointerDown(100, 300); // grab 'start' handle
    engine.handlePointerMove(120, 280); // -> { time:120, price:720 }
    engine.handlePointerUp();

    const snap = engine.getSnapshots()[0];
    expect(snap?.anchors[0]).toMatchObject({ time: 120, price: 720 });
    expect(snap?.anchors[1]).toMatchObject({ time: 200, price: 750 });
  });

  it('deletes the selected mark', () => {
    const { engine, h } = withHLine();
    expect(h.attachedCount()).toBe(1);
    engine.deleteSelected();
    expect(h.attachedCount()).toBe(0);
    expect(engine.getSnapshots()).toHaveLength(0);
    expect(engine.hasSelection()).toBe(false);
  });
});
