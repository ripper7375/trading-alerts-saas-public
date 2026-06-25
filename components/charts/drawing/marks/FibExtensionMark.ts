/**
 * Fibonacci extension (by price) mark — a 3-point swing (P0→P1→P2) projecting
 * horizontal extension levels.
 *
 * @module components/charts/drawing/marks/FibExtensionMark
 */

import { DEFAULT_FIB_EXT_RATIOS, fibExtensionLevels } from '../geometry/fib';
import { levelsForMark } from '../geometry/levels';
import {
  isNearHorizontal,
  isNearSegment,
  type PixelPoint,
} from '../engine/pixelMath';
import type { Coords } from '../engine/coords';
import type { AlertLevel, Anchor, DrawingStyle } from '../types';
import { BaseMark, type RenderScope } from './BaseMark';

const DEFAULT_HIT_TOL = 8; // media px

export class FibExtensionMark extends BaseMark {
  constructor(id: string, anchors: Anchor[], style: DrawingStyle) {
    super(id, 'FIB_EXT', anchors, style);
  }

  private ratios(): readonly number[] {
    const v = this.style['levels'];
    if (
      Array.isArray(v) &&
      v.every((x): x is number => typeof x === 'number' && Number.isFinite(x))
    ) {
      return v;
    }
    return DEFAULT_FIB_EXT_RATIOS;
  }

  private threeAnchors(): [Anchor, Anchor, Anchor] | null {
    const a0 = this.anchors[0];
    const a1 = this.anchors[1];
    const a2 = this.anchors[2];
    if (!a0 || !a1 || !a2) return null;
    return [a0, a1, a2];
  }

  protected renderMark(scope: RenderScope, coords: Coords): void {
    const tri = this.threeAnchors();
    if (!tri) return;
    const [a0, a1, a2] = tri;

    // Swing path P0->P1->P2 (context for the projection).
    const p0 = coords.anchorToPixel(a0);
    const p1 = coords.anchorToPixel(a1);
    const p2 = coords.anchorToPixel(a2);
    if (p0 && p1) this.strokeSegment(scope, p0.x, p0.y, p1.x, p1.y);
    if (p1 && p2) this.strokeSegment(scope, p1.x, p1.y, p2.x, p2.y);

    const levels = fibExtensionLevels(a0, a1, a2, this.ratios());
    const width = coords.paneWidth();
    for (const [id, price] of Object.entries(levels)) {
      const y = coords.priceToY(price);
      if (y === null) continue;
      this.strokeSegment(scope, 0, y, width, y);
      this.drawRatioLabel(scope, id.replace('fib_ext_', ''), y);
    }

    if (this.selected) {
      if (p0) this.drawHandle(scope, p0.x, p0.y);
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

  private pixelAnchors(): PixelPoint[] {
    if (!this.coords) return [];
    const out: PixelPoint[] = [];
    for (const a of this.anchors) {
      const p = this.coords.anchorToPixel(a);
      if (p) out.push(p);
    }
    return out;
  }

  public hitHandle(
    x: number,
    y: number,
    tol: number = DEFAULT_HIT_TOL
  ): string | null {
    const pts = this.pixelAnchors();
    const ids = ['p0', 'p1', 'p2'];
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      if (p && Math.hypot(x - p.x, y - p.y) <= tol) return ids[i] ?? null;
    }
    return null;
  }

  public hitBody(x: number, y: number, tol: number = DEFAULT_HIT_TOL): boolean {
    if (!this.coords) return false;
    const tri = this.threeAnchors();
    if (!tri) return false;
    // Near the swing path?
    const pts = this.pixelAnchors();
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a && b && isNearSegment({ x, y }, a, b, tol)) return true;
    }
    // Near any projected level?
    const levels = fibExtensionLevels(tri[0], tri[1], tri[2], this.ratios());
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
