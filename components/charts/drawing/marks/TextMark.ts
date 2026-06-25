/**
 * Text / annotation mark — a label box anchored at a price/time point.
 *
 * Not alertable (alertLevels() is empty). Inline text editing is a follow-up;
 * the text lives in `style.text` and defaults to "Text".
 *
 * @module components/charts/drawing/marks/TextMark
 */

import type { Coords } from '../engine/coords';
import type { AlertLevel, Anchor, DrawingStyle } from '../types';
import { BaseMark, type RenderScope } from './BaseMark';

const FONT_SIZE = 13; // media px
const PAD_X = 6; // media px
const PAD_Y = 4; // media px
const CHAR_W = 7; // approx media px per char at FONT_SIZE

export class TextMark extends BaseMark {
  constructor(id: string, anchors: Anchor[], style: DrawingStyle) {
    super(id, 'TEXT', anchors, style);
  }

  private text(): string {
    return typeof this.style['text'] === 'string'
      ? (this.style['text'] as string)
      : 'Text';
  }

  /** Media-pixel bounding box of the label, anchored at its top-left. */
  private box(
    coords: Coords
  ): { x: number; y: number; w: number; h: number } | null {
    const a = this.anchors[0];
    if (!a) return null;
    const p = coords.anchorToPixel(a);
    if (!p) return null;
    const w = this.text().length * CHAR_W + PAD_X * 2;
    const h = FONT_SIZE + PAD_Y * 2;
    return { x: p.x, y: p.y, w, h };
  }

  protected renderMark(scope: RenderScope, coords: Coords): void {
    const box = this.box(coords);
    if (!box) return;
    const { ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;

    ctx.save();
    ctx.setLineDash([]);
    // Background
    ctx.fillStyle = 'rgba(30, 34, 45, 0.85)';
    ctx.fillRect(box.x * hpr, box.y * vpr, box.w * hpr, box.h * vpr);
    // Border when selected
    if (this.selected) {
      ctx.strokeStyle = this.resolvedColor();
      ctx.lineWidth = 1 * hpr;
      ctx.strokeRect(box.x * hpr, box.y * vpr, box.w * hpr, box.h * vpr);
    }
    // Text
    ctx.fillStyle = this.resolvedColor();
    ctx.font = `${FONT_SIZE * vpr}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text(), (box.x + PAD_X) * hpr, (box.y + box.h / 2) * vpr);
    ctx.restore();
  }

  public hitHandle(): string | null {
    return null; // text is moved by body drag
  }

  public hitBody(x: number, y: number): boolean {
    if (!this.coords) return false;
    const box = this.box(this.coords);
    if (!box) return false;
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  }

  public alertLevels(): AlertLevel[] {
    return [];
  }
}
