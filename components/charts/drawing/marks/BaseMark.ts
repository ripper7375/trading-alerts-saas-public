/**
 * BaseMark — shared implementation for all drawing marks.
 *
 * Implements the Lightweight Charts v5 series-primitive interface
 * (`ISeriesPrimitive`) so a mark can be attached with
 * `series.attachPrimitive(mark)`, plus the engine-facing `DrawingMark`
 * contract. Concrete marks implement only their own rendering + hit-testing +
 * alert levels.
 *
 * Rendering happens in the canvas bitmap coordinate space for crisp lines at
 * any device pixel ratio; coordinate helpers (`Coords`) return media (CSS)
 * pixels, which the draw helpers scale by the bitmap pixel ratios.
 *
 * @module components/charts/drawing/marks/BaseMark
 */

import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts';

import { createCoords, type Coords } from '../engine/coords';
import type {
  AlertLevel,
  Anchor,
  DrawingMark,
  DrawingStyle,
  DrawingType,
  MarkSnapshot,
} from '../types';

/** Bitmap rendering scope passed to concrete marks. */
export interface RenderScope {
  ctx: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

const HANDLE_RADIUS = 5; // media px

export abstract class BaseMark implements ISeriesPrimitive<Time>, DrawingMark {
  public readonly id: string;
  public readonly type: DrawingType;

  protected anchors: Anchor[];
  protected style: DrawingStyle;
  protected selected = false;

  protected coords: Coords | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly paneView: IPrimitivePaneView;

  constructor(
    id: string,
    type: DrawingType,
    anchors: Anchor[],
    style: DrawingStyle
  ) {
    this.id = id;
    this.type = type;
    this.anchors = anchors;
    this.style = style;

    const renderer: IPrimitivePaneRenderer = {
      draw: (target): void => {
        target.useBitmapCoordinateSpace((scope) => {
          if (!this.coords) return;
          this.renderMark(
            {
              ctx: scope.context,
              horizontalPixelRatio: scope.horizontalPixelRatio,
              verticalPixelRatio: scope.verticalPixelRatio,
            },
            this.coords
          );
        });
      },
    };

    this.paneView = {
      renderer: (): IPrimitivePaneRenderer => renderer,
      zOrder: (): PrimitivePaneViewZOrder => (this.selected ? 'top' : 'normal'),
    };
  }

  //─────────────────────────────────────────────────────────
  // ISeriesPrimitive
  //─────────────────────────────────────────────────────────

  public attached(param: SeriesAttachedParameter<Time>): void {
    this.coords = createCoords(param.chart, param.series);
    this.requestUpdate = param.requestUpdate;
  }

  public detached(): void {
    this.coords = null;
    this.requestUpdate = null;
  }

  public updateAllViews(): void {
    // Views are rebuilt on each draw; nothing to cache.
  }

  public paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  //─────────────────────────────────────────────────────────
  // DrawingMark
  //─────────────────────────────────────────────────────────

  public getAnchors(): Anchor[] {
    return this.anchors.map((a) => ({ ...a }));
  }

  public setAnchors(anchors: Anchor[]): void {
    this.anchors = anchors;
    this.requestRedraw();
  }

  public getStyle(): DrawingStyle {
    return { ...this.style };
  }

  public setStyle(patch: Partial<DrawingStyle>): void {
    this.style = { ...this.style, ...patch };
    this.requestRedraw();
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    this.requestRedraw();
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public abstract hitHandle(x: number, y: number, tol?: number): string | null;
  public abstract hitBody(x: number, y: number, tol?: number): boolean;
  public abstract alertLevels(): AlertLevel[];

  public toSnapshot(): MarkSnapshot {
    return {
      id: this.id,
      type: this.type,
      anchors: this.getAnchors(),
      style: this.getStyle(),
    };
  }

  //─────────────────────────────────────────────────────────
  // Rendering helpers (media px in, bitmap px out)
  //─────────────────────────────────────────────────────────

  /** Concrete marks draw here using the helpers below. */
  protected abstract renderMark(scope: RenderScope, coords: Coords): void;

  protected requestRedraw(): void {
    this.requestUpdate?.();
  }

  protected resolvedColor(): string {
    return typeof this.style.color === 'string' ? this.style.color : '#2962FF';
  }

  protected resolvedLineWidth(): number {
    return typeof this.style.lineWidth === 'number' ? this.style.lineWidth : 2;
  }

  protected applyStroke(scope: RenderScope): void {
    const { ctx, horizontalPixelRatio } = scope;
    ctx.strokeStyle = this.resolvedColor();
    ctx.lineWidth = this.resolvedLineWidth() * horizontalPixelRatio;
    ctx.lineCap = 'round';
    const dash = this.style.lineStyle;
    if (dash === 'dashed')
      ctx.setLineDash([6 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
    else if (dash === 'dotted')
      ctx.setLineDash([2 * horizontalPixelRatio, 3 * horizontalPixelRatio]);
    else ctx.setLineDash([]);
  }

  /** Stroke a segment given media-pixel endpoints. */
  protected strokeSegment(
    scope: RenderScope,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    const { ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    ctx.save();
    this.applyStroke(scope);
    ctx.beginPath();
    ctx.moveTo(x1 * hpr, y1 * vpr);
    ctx.lineTo(x2 * hpr, y2 * vpr);
    ctx.stroke();
    ctx.restore();
  }

  /** Draw a selection handle at a media-pixel point. */
  protected drawHandle(scope: RenderScope, x: number, y: number): void {
    const { ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const cx = x * hpr;
    const cy = y * vpr;
    const r = HANDLE_RADIUS * hpr;
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = this.resolvedColor();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
