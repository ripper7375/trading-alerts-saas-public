/**
 * Fibonacci retracement mark — horizontal level lines across the range defined
 * by two anchors, each labeled with its ratio.
 *
 * @module components/charts/drawing/marks/FibRetracementMark
 */

import {
  DEFAULT_FIB_RETRACE_RATIOS,
  fibRetracementLevels,
} from '../geometry/fib';
import { levelsForMark } from '../geometry/levels';
import { isNearHorizontal } from '../engine/pixelMath';
import type { Coords } from '../engine/coords';
import type { AlertLevel, Anchor, DrawingStyle } from '../types';
import { BaseMark, type RenderScope } from './BaseMark';

const DEFAULT_HIT_TOL = 8; // media px

export class FibRetracementMark extends BaseMark {
  constructor(id: string, anchors: Anchor[], style: DrawingStyle) {
    super(id, 'FIB_RETRACE', anchors, style);
  }

  private ratios(): readonly number[] {
    const v = this.style['levels'];
    if (
      Array.isArray(v) &&
      v.every((x): x is number => typeof x === 'number' && Number.isFinite(x))
    ) {
      return v;
    }
    return DEFAULT_FIB_RETRACE_RATIOS;
  }

  private levelPrices(): Record<string, number> | null {
    const a1 = this.anchors[0];
    const a2 = this.anchors[1];
    if (!a1 || !a2) return null;
    return fibRetracementLevels(a1, a2, this.ratios());
  }

  protected renderMark(scope: RenderScope, coords: Coords): void {
    const levels = this.levelPrices();
    if (!levels) return;
    const width = coords.paneWidth();

    for (const [id, price] of Object.entries(levels)) {
      const y = coords.priceToY(price);
      if (y === null) continue;
      this.strokeSegment(scope, 0, y, width, y);
      this.drawRatioLabel(scope, id.replace('fib_', ''), y);
    }

    if (this.selected) {
      const a1 = this.anchors[0];
      const a2 = this.anchors[1];
      const p1 = a1 ? coords.anchorToPixel(a1) : null;
      const p2 = a2 ? coords.anchorToPixel(a2) : null;
      if (p1) this.drawHandle(scope, p1.x, p1.y);
      if (p2) this.drawHandle(scope, p2.x, p2.y);
    }
  }

  private drawRatioLabel(scope: RenderScope, text: string, y: number): void {
    const { ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = this.resolvedColor();
    ctx.font = `${10 * vpr}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 4 * hpr, y * vpr);
    ctx.restore();
  }

  public hitHandle(
    x: number,
    y: number,
    tol: number = DEFAULT_HIT_TOL
  ): string | null {
    if (!this.coords) return null;
    const a1 = this.anchors[0];
    const a2 = this.anchors[1];
    const p1 = a1 ? this.coords.anchorToPixel(a1) : null;
    const p2 = a2 ? this.coords.anchorToPixel(a2) : null;
    if (p1 && Math.hypot(x - p1.x, y - p1.y) <= tol) return 'p0';
    if (p2 && Math.hypot(x - p2.x, y - p2.y) <= tol) return 'p1';
    return null;
  }

  public hitBody(x: number, y: number, tol: number = DEFAULT_HIT_TOL): boolean {
    if (!this.coords) return false;
    const levels = this.levelPrices();
    if (!levels) return false;
    for (const price of Object.values(levels)) {
      const ly = this.coords.priceToY(price);
      if (ly !== null && isNearHorizontal({ x, y }, ly, tol)) return true;
    }
    return false;
  }

  public alertLevels(): AlertLevel[] {
    return levelsForMark(this.toSnapshot());
  }
}
