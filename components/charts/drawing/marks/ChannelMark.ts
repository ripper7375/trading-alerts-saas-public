/**
 * Equidistant / parallel channel mark.
 *
 * Anchors: [a1, a2] define the base line; a3 sits on the parallel line and
 * encodes the vertical price offset. Drawn with 3 clicks.
 *
 * @module components/charts/drawing/marks/ChannelMark
 */

import { trendlineValueAt } from '../geometry/trendline';
import { levelsForMark } from '../geometry/levels';
import { isNearSegment, type PixelPoint } from '../engine/pixelMath';
import type { Coords } from '../engine/coords';
import type { AlertLevel, Anchor, DrawingStyle } from '../types';
import { BaseMark, type RenderScope } from './BaseMark';

const DEFAULT_HIT_TOL = 8; // media px

export class ChannelMark extends BaseMark {
  constructor(id: string, anchors: Anchor[], style: DrawingStyle) {
    super(id, 'CHANNEL', anchors, style);
  }

  /** Vertical price offset of the parallel line from the base line. */
  private offset(a1: Anchor, a2: Anchor, a3: Anchor): number {
    const base = trendlineValueAt(a1, a2, a3.time, {
      extendLeft: true,
      extendRight: true,
    });
    return base === null ? 0 : a3.price - base;
  }

  private pixels(coords: Coords): {
    base1: PixelPoint;
    base2: PixelPoint;
    par1: PixelPoint;
    par2: PixelPoint;
    a3: PixelPoint;
  } | null {
    const a1 = this.anchors[0];
    const a2 = this.anchors[1];
    const a3 = this.anchors[2];
    if (!a1 || !a2 || !a3) return null;

    const off = this.offset(a1, a2, a3);
    const base1 = coords.anchorToPixel(a1);
    const base2 = coords.anchorToPixel(a2);
    const par1 = coords.anchorToPixel({ time: a1.time, price: a1.price + off });
    const par2 = coords.anchorToPixel({ time: a2.time, price: a2.price + off });
    const a3p = coords.anchorToPixel(a3);
    if (!base1 || !base2 || !par1 || !par2 || !a3p) return null;
    return { base1, base2, par1, par2, a3: a3p };
  }

  protected renderMark(scope: RenderScope, coords: Coords): void {
    const p = this.pixels(coords);
    if (!p) return;
    this.strokeSegment(scope, p.base1.x, p.base1.y, p.base2.x, p.base2.y);
    this.strokeSegment(scope, p.par1.x, p.par1.y, p.par2.x, p.par2.y);

    if (this.selected) {
      this.drawHandle(scope, p.base1.x, p.base1.y);
      this.drawHandle(scope, p.base2.x, p.base2.y);
      this.drawHandle(scope, p.a3.x, p.a3.y);
    }
  }

  public hitHandle(
    x: number,
    y: number,
    tol: number = DEFAULT_HIT_TOL
  ): string | null {
    if (!this.coords) return null;
    const p = this.pixels(this.coords);
    if (!p) return null;
    const near = (q: PixelPoint): boolean =>
      Math.hypot(x - q.x, y - q.y) <= tol;
    if (near(p.base1)) return 'p0';
    if (near(p.base2)) return 'p1';
    if (near(p.a3)) return 'p2';
    return null;
  }

  public hitBody(x: number, y: number, tol: number = DEFAULT_HIT_TOL): boolean {
    if (!this.coords) return false;
    const p = this.pixels(this.coords);
    if (!p) return false;
    return (
      isNearSegment({ x, y }, p.base1, p.base2, tol) ||
      isNearSegment({ x, y }, p.par1, p.par2, tol)
    );
  }

  public alertLevels(): AlertLevel[] {
    return levelsForMark(this.toSnapshot());
  }
}
