/**
 * Trendline / line-segment mark — a straight line between two anchors, with
 * optional left/right ray extension to the pane edges.
 *
 * @module components/charts/drawing/marks/TrendlineMark
 */

import { trendlineValueAt } from '../geometry/trendline';
import {
  isNearPoint,
  isNearSegment,
  type PixelPoint,
} from '../engine/pixelMath';
import type { Coords } from '../engine/coords';
import type { AlertLevel, Anchor, DrawingStyle } from '../types';
import { BaseMark, type RenderScope } from './BaseMark';

const DEFAULT_HIT_TOL = 8; // media px

export class TrendlineMark extends BaseMark {
  constructor(id: string, anchors: Anchor[], style: DrawingStyle) {
    super(id, 'TRENDLINE', anchors, style);
  }

  private extendLeft(): boolean {
    return this.style['extendLeft'] === true;
  }

  private extendRight(): boolean {
    return this.style['extendRight'] === true;
  }

  /** Media-pixel endpoints of the two anchors, or null. */
  private endpoints(coords: Coords): { a: PixelPoint; b: PixelPoint } | null {
    const a1 = this.anchors[0];
    const a2 = this.anchors[1];
    if (!a1 || !a2) return null;
    const a = coords.anchorToPixel(a1);
    const b = coords.anchorToPixel(a2);
    if (!a || !b) return null;
    return { a, b };
  }

  /**
   * The drawable endpoints after applying ray extension. Extends in pixel space
   * along the line direction to x=0 / x=width when the corresponding flag is on.
   */
  private drawPoints(
    coords: Coords
  ): { p1: PixelPoint; p2: PixelPoint } | null {
    const ends = this.endpoints(coords);
    if (!ends) return null;
    const { a, b } = ends;

    if (b.x === a.x) {
      return { p1: a, p2: b }; // vertical in pixel space; no horizontal extension
    }

    const slope = (b.y - a.y) / (b.x - a.x);
    const yAt = (x: number): number => a.y + slope * (x - a.x);
    const width = coords.paneWidth();

    const left = a.x <= b.x ? a : b;
    const right = a.x <= b.x ? b : a;

    const p1 = this.extendLeft() ? { x: 0, y: yAt(0) } : left;
    const p2 = this.extendRight() ? { x: width, y: yAt(width) } : right;
    return { p1, p2 };
  }

  protected renderMark(scope: RenderScope, coords: Coords): void {
    const pts = this.drawPoints(coords);
    if (!pts) return;
    this.strokeSegment(scope, pts.p1.x, pts.p1.y, pts.p2.x, pts.p2.y);

    if (this.selected) {
      const ends = this.endpoints(coords);
      if (ends) {
        this.drawHandle(scope, ends.a.x, ends.a.y);
        this.drawHandle(scope, ends.b.x, ends.b.y);
      }
    }
  }

  public hitHandle(
    x: number,
    y: number,
    tol: number = DEFAULT_HIT_TOL
  ): string | null {
    if (!this.coords) return null;
    const ends = this.endpoints(this.coords);
    if (!ends) return null;
    if (isNearPoint({ x, y }, ends.a, tol)) return 'start';
    if (isNearPoint({ x, y }, ends.b, tol)) return 'end';
    return null;
  }

  public hitBody(x: number, y: number, tol: number = DEFAULT_HIT_TOL): boolean {
    if (!this.coords) return false;
    const pts = this.drawPoints(this.coords);
    if (!pts) return false;
    return isNearSegment({ x, y }, pts.p1, pts.p2, tol);
  }

  public alertLevels(): AlertLevel[] {
    const a1 = this.anchors[0];
    const a2 = this.anchors[1];
    if (!a1 || !a2) return [];
    const opts = {
      extendLeft: this.extendLeft(),
      extendRight: this.extendRight(),
    };
    return [
      {
        id: 'line',
        label: 'Trendline',
        valueAt: (t: number): number | null =>
          trendlineValueAt(a1, a2, t, opts),
      },
    ];
  }
}
