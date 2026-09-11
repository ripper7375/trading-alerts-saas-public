/**
 * EventVerticalLine — a lightweight-charts v5 series primitive drawing a
 * full-pane-height vertical line at a fixed time. Used to mark high-impact
 * economic-event times on the candlestick chart.
 *
 * Adapted from the vendored lightweight-charts plugin example at
 * seed-code/lightweight-charts/plugin-examples/src/plugins/vertical-line/
 * vertical-line.ts, trimmed to this app's v1 scope: a line only, no
 * time-axis label -- closely-spaced events would collide on the axis, and a
 * hover tooltip is a natural follow-up rather than something the line
 * itself needs to be useful.
 *
 * `CanvasRenderingTarget2D` (from the `fancy-canvas` package) is derived via
 * `Parameters<IPrimitivePaneRenderer['draw']>[0]` rather than imported by
 * name -- `fancy-canvas` is a transitive dependency of `lightweight-charts`
 * only, not a direct one of this app, so importing it directly is not
 * reliably resolvable under this workspace's pnpm layout.
 *
 * @module components/charts/drawing/EventVerticalLine
 */

import type {
  Coordinate,
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesType,
  Time,
} from 'lightweight-charts';

type CanvasTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface EventVerticalLineOptions {
  color: string;
  width: number;
}

/** amber-500 at low opacity -- matches this app's existing HIGH-impact styling (session-status-banner.tsx). */
const DEFAULT_OPTIONS: EventVerticalLineOptions = {
  color: 'rgba(245, 158, 11, 0.55)',
  width: 1,
};

class EventVerticalLinePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x: Coordinate | null,
    private readonly options: EventVerticalLineOptions
  ) {}

  draw(target: CanvasTarget): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this.x === null) return;
      const ctx = scope.context;
      const ratio = scope.horizontalPixelRatio;
      const width = Math.max(1, Math.round(this.options.width * ratio));
      const position = Math.round(this.x * ratio) - Math.floor(width / 2);
      ctx.fillStyle = this.options.color;
      ctx.fillRect(position, 0, width, scope.bitmapSize.height);
    });
  }
}

class EventVerticalLinePaneView implements IPrimitivePaneView {
  private x: Coordinate | null = null;

  constructor(
    private readonly source: EventVerticalLine,
    private readonly options: EventVerticalLineOptions
  ) {}

  update(): void {
    this.x = this.source.chart.timeScale().timeToCoordinate(this.source.time);
  }

  renderer(): IPrimitivePaneRenderer {
    return new EventVerticalLinePaneRenderer(this.x, this.options);
  }
}

/** One vertical line at a fixed time. Attach one instance per event. */
export class EventVerticalLine implements ISeriesPrimitive<Time> {
  private readonly paneViewInstance: EventVerticalLinePaneView;

  constructor(
    public readonly chart: IChartApi,
    _series: ISeriesApi<SeriesType>,
    public readonly time: Time,
    options?: Partial<EventVerticalLineOptions>
  ) {
    this.paneViewInstance = new EventVerticalLinePaneView(this, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }

  updateAllViews(): void {
    this.paneViewInstance.update();
  }

  paneViews(): IPrimitivePaneView[] {
    return [this.paneViewInstance];
  }
}
