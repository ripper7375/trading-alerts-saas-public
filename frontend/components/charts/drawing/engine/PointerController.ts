/**
 * PointerController — binds DOM pointer + keyboard events on the overlay element
 * and forwards them (in pane-local pixels) to the DrawingEngine.
 *
 * Framework-agnostic: created and disposed by DrawingLayer.
 *
 * @module components/charts/drawing/engine/PointerController
 */

import type { DrawingEngine } from './DrawingEngine';

export class PointerController {
  private readonly element: HTMLElement;
  private readonly engine: DrawingEngine;

  constructor(element: HTMLElement, engine: DrawingEngine) {
    this.element = element;
    this.engine = engine;
    this.bind();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const { x, y } = this.local(e);
    this.element.setPointerCapture(e.pointerId);
    this.engine.handlePointerDown(x, y);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const { x, y } = this.local(e);
    this.engine.handlePointerMove(x, y);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }
    this.engine.handlePointerUp();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.engine.handleEscape();
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      this.engine.deleteSelected();
    }
  };

  private bind(): void {
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
  }

  public destroy(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
