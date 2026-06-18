/**
 * Horizontal line mark — a full-width constant-price line.
 *
 * @module components/charts/drawing/marks/HorizontalLineMark
 */

import { isNearHorizontal } from '../engine/pixelMath';
import type { Coords } from '../engine/coords';
import type { AlertLevel, Anchor, DrawingStyle } from '../types';
import { BaseMark, type RenderScope } from './BaseMark';

const DEFAULT_HIT_TOL = 8; // media px

export class HorizontalLineMark extends BaseMark {
  constructor(id: string, anchors: Anchor[], style: DrawingStyle) {
    super(id, 'HLINE', anchors, style);
  }

  private price(): number | null {
    const a = this.anchors[0];
    return a ? a.price : null;
  }

  protected renderMark(scope: RenderScope, coords: Coords): void {
    const price = this.price();
    if (price === null) return;
    const y = coords.priceToY(price);
    if (y === null) return;

    const width = coords.paneWidth();
    this.strokeSegment(scope, 0, y, width, y);

    if (this.selected) {
      this.drawHandle(scope, width / 2, y);
    }
  }

  public hitHandle(
    x: number,
    y: number,
    tol: number = DEFAULT_HIT_TOL
  ): string | null {
    if (!this.coords) return null;
    const price = this.price();
    if (price === null) return null;
    const ly = this.coords.priceToY(price);
    if (ly === null) return null;
    const midX = this.coords.paneWidth() / 2;
    if (Math.hypot(x - midX, y - ly) <= tol) return 'move';
    return null;
  }

  public hitBody(x: number, y: number, tol: number = DEFAULT_HIT_TOL): boolean {
    if (!this.coords) return false;
    const price = this.price();
    if (price === null) return false;
    const ly = this.coords.priceToY(price);
    if (ly === null) return false;
    return isNearHorizontal({ x, y }, ly, tol);
  }

  public alertLevels(): AlertLevel[] {
    const price = this.price();
    if (price === null) return [];
    return [{ id: 'line', label: 'Line', valueAt: (): number => price }];
  }
}
