/**
 * DrawingEngine — orchestrates tool drawing, selection, editing and deletion of
 * marks on a Lightweight Charts series.
 *
 * Interaction model (state machine):
 *   idle ──(tool armed + pointerdown)──► drawing ──(clicks reached)──► idle
 *   idle ──(click on mark)──► selected ──(pointerdown on handle/body)──► editing
 *   editing ──(pointerup)──► selected ;  Esc cancels drawing / clears selection
 *
 * Pointer coordinates are media (CSS) pixels relative to the chart pane.
 *
 * @module components/charts/drawing/engine/DrawingEngine
 */

import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesType,
  Time,
} from 'lightweight-charts';

import {
  TOOL_DEFINITIONS,
  defaultStyle,
  handleToAnchorIndex,
  type ToolDefinition,
} from '../tools';
import type {
  Anchor,
  DrawingMark,
  DrawingStyle,
  DrawingType,
  MarkSnapshot,
} from '../types';
import { createCoords, type Coords } from './coords';

export interface DrawingEngineCallbacks {
  /** Whether the pointer overlay should capture events (drawing or editing). */
  onOverlayActiveChange?: (active: boolean) => void;
  /** Currently selected mark id (or null). */
  onSelectionChange?: (id: string | null) => void;
  /** Fires after marks are added/edited/removed — hook for persistence. */
  onMarksChange?: (snapshots: MarkSnapshot[]) => void;
  /** Fires when a finished drawing deselects the active tool. */
  onActiveToolChange?: (tool: DrawingType | null) => void;
}

type Mode = 'idle' | 'drawing' | 'editing';

interface Draft {
  def: ToolDefinition;
  mark: DrawingMark;
  committed: number;
}

type Drag =
  | { kind: 'handle'; mark: DrawingMark; index: number }
  | { kind: 'body'; mark: DrawingMark; last: Anchor };

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `dmark_${Date.now().toString(36)}_${idCounter}`;
}

export class DrawingEngine {
  private readonly chart: IChartApi;
  private readonly series: ISeriesApi<SeriesType, Time>;
  private readonly coords: Coords;
  private readonly callbacks: DrawingEngineCallbacks;

  private readonly marks = new Map<string, DrawingMark>();
  private activeTool: DrawingType | null = null;
  private mode: Mode = 'idle';
  private draft: Draft | null = null;
  private drag: Drag | null = null;
  private selectedId: string | null = null;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType, Time>,
    callbacks: DrawingEngineCallbacks = {}
  ) {
    this.chart = chart;
    this.series = series;
    this.coords = createCoords(chart, series);
    this.callbacks = callbacks;
  }

  //─────────────────────────────────────────────────────────
  // Public API
  //─────────────────────────────────────────────────────────

  public setActiveTool(tool: DrawingType | null): void {
    this.cancelDraft();
    this.activeTool = tool;
    if (tool !== null) this.clearSelection();
    this.callbacks.onActiveToolChange?.(tool);
    this.notifyOverlay();
  }

  public getActiveTool(): DrawingType | null {
    return this.activeTool;
  }

  public hasSelection(): boolean {
    return this.selectedId !== null;
  }

  public getSelectedId(): string | null {
    return this.selectedId;
  }

  /** Alert levels of the selected mark (empty for none / non-alertable). */
  public getSelectedAlertLevels(): { id: string; label: string }[] {
    if (!this.selectedId) return [];
    const mark = this.marks.get(this.selectedId);
    if (!mark) return [];
    return mark.alertLevels().map((l) => ({ id: l.id, label: l.label }));
  }

  public getSelectedType(): DrawingType | null {
    if (!this.selectedId) return null;
    return this.marks.get(this.selectedId)?.type ?? null;
  }

  public getSelectedStyle(): DrawingStyle | null {
    if (!this.selectedId) return null;
    return this.marks.get(this.selectedId)?.getStyle() ?? null;
  }

  /** Apply a style patch to the selected mark and autosave (emits onMarksChange). */
  public updateSelectedStyle(patch: Partial<DrawingStyle>): void {
    if (!this.selectedId) return;
    const mark = this.marks.get(this.selectedId);
    if (!mark) return;
    mark.setStyle(patch);
    this.emitMarks();
  }

  /** Load persisted marks (snapshots) and attach them. */
  public loadMarks(snapshots: MarkSnapshot[]): void {
    for (const snap of snapshots) {
      const def = TOOL_DEFINITIONS[snap.type];
      if (!def) continue;
      const mark = def.create(snap.id, snap.anchors, snap.style);
      this.attach(mark);
    }
  }

  /** Selection by click (used from the chart's subscribeClick when idle). */
  public handleSelectAt(x: number, y: number): void {
    if (this.activeTool !== null || this.mode !== 'idle') return;
    const hit = this.topMarkAt(x, y);
    this.select(hit ? hit.id : null);
  }

  public handlePointerDown(x: number, y: number): void {
    const anchor = this.coords.pixelToAnchor(x, y);
    if (!anchor) return;

    if (this.activeTool !== null) {
      this.advanceDrawing(anchor);
      return;
    }
    this.beginEditOrSelect(x, y, anchor);
  }

  public handlePointerMove(x: number, y: number): void {
    const anchor = this.coords.pixelToAnchor(x, y);
    if (!anchor) return;

    if (this.mode === 'drawing' && this.draft) {
      if (this.draft.committed < this.draft.def.anchorCount) {
        const anchors = this.draft.mark.getAnchors();
        anchors[this.draft.committed] = anchor;
        this.draft.mark.setAnchors(anchors);
      }
      return;
    }

    if (this.mode === 'editing' && this.drag) {
      this.applyDrag(anchor);
    }
  }

  public handlePointerUp(): void {
    if (this.mode === 'editing' && this.drag) {
      this.drag = null;
      this.mode = 'idle';
      this.enablePan();
      this.emitMarks();
    }
  }

  /** Esc: cancel an in-progress drawing, else clear selection. */
  public handleEscape(): void {
    if (this.draft) {
      this.cancelDraft();
      return;
    }
    this.clearSelection();
  }

  public deleteSelected(): void {
    if (!this.selectedId) return;
    const mark = this.marks.get(this.selectedId);
    if (mark) this.detach(mark);
    this.selectedId = null;
    this.callbacks.onSelectionChange?.(null);
    this.emitMarks();
    this.notifyOverlay();
  }

  public getSnapshots(): MarkSnapshot[] {
    return Array.from(this.marks.values()).map((m) => m.toSnapshot());
  }

  public destroy(): void {
    for (const mark of this.marks.values()) {
      this.series.detachPrimitive(mark as unknown as ISeriesPrimitive<Time>);
    }
    this.marks.clear();
    this.draft = null;
    this.drag = null;
    this.selectedId = null;
  }

  //─────────────────────────────────────────────────────────
  // Drawing
  //─────────────────────────────────────────────────────────

  private advanceDrawing(anchor: Anchor): void {
    if (!this.draft) {
      const def = TOOL_DEFINITIONS[this.activeTool as DrawingType];
      if (!def) return;
      const anchors: Anchor[] = Array.from({ length: def.anchorCount }, () => ({
        ...anchor,
      }));
      const mark = def.create(generateId(), anchors, defaultStyle());
      this.attach(mark);
      this.draft = { def, mark, committed: 1 };
      this.mode = 'drawing';
      this.disablePan();
      this.notifyOverlay();
      if (def.anchorCount === 1) this.finalizeDraft();
      return;
    }

    const anchors = this.draft.mark.getAnchors();
    anchors[this.draft.committed] = anchor;
    this.draft.mark.setAnchors(anchors);
    this.draft.committed += 1;
    if (this.draft.committed >= this.draft.def.anchorCount) {
      this.finalizeDraft();
    }
  }

  private finalizeDraft(): void {
    if (!this.draft) return;
    const finishedId = this.draft.mark.id;
    this.draft = null;
    this.mode = 'idle';
    this.enablePan();
    // One-shot: deselect the tool and select the new mark for immediate editing.
    this.activeTool = null;
    this.callbacks.onActiveToolChange?.(null);
    this.select(finishedId);
    this.emitMarks();
  }

  private cancelDraft(): void {
    if (!this.draft) return;
    this.detach(this.draft.mark);
    this.draft = null;
    this.mode = 'idle';
    this.enablePan();
    this.notifyOverlay();
  }

  //─────────────────────────────────────────────────────────
  // Selection & editing
  //─────────────────────────────────────────────────────────

  private beginEditOrSelect(x: number, y: number, anchor: Anchor): void {
    // If a mark is already selected, try to grab a handle or its body to drag.
    if (this.selectedId) {
      const selected = this.marks.get(this.selectedId);
      if (selected) {
        const handle = selected.hitHandle(x, y);
        if (handle === 'move') {
          this.startBodyDrag(selected, anchor);
          return;
        }
        if (handle) {
          this.startHandleDrag(selected, handleToAnchorIndex(handle));
          return;
        }
        if (selected.hitBody(x, y)) {
          this.startBodyDrag(selected, anchor);
          return;
        }
      }
    }

    // Otherwise (re)select whatever is under the pointer, or clear.
    const hit = this.topMarkAt(x, y);
    this.select(hit ? hit.id : null);
  }

  private startHandleDrag(mark: DrawingMark, index: number): void {
    this.drag = { kind: 'handle', mark, index };
    this.mode = 'editing';
    this.disablePan();
  }

  private startBodyDrag(mark: DrawingMark, anchor: Anchor): void {
    this.drag = { kind: 'body', mark, last: anchor };
    this.mode = 'editing';
    this.disablePan();
  }

  private applyDrag(anchor: Anchor): void {
    if (!this.drag) return;
    if (this.drag.kind === 'handle') {
      const anchors = this.drag.mark.getAnchors();
      anchors[this.drag.index] = anchor;
      this.drag.mark.setAnchors(anchors);
      return;
    }
    const dt = anchor.time - this.drag.last.time;
    const dp = anchor.price - this.drag.last.price;
    const moved = this.drag.mark
      .getAnchors()
      .map((a) => ({ time: a.time + dt, price: a.price + dp }));
    this.drag.mark.setAnchors(moved);
    this.drag.last = anchor;
  }

  private select(id: string | null): void {
    if (this.selectedId === id) return;
    if (this.selectedId) {
      this.marks.get(this.selectedId)?.setSelected(false);
    }
    this.selectedId = id;
    if (id) this.marks.get(id)?.setSelected(true);
    this.callbacks.onSelectionChange?.(id);
    this.notifyOverlay();
  }

  private clearSelection(): void {
    this.select(null);
  }

  /** Topmost mark under the pixel (later marks render on top). */
  private topMarkAt(x: number, y: number): DrawingMark | null {
    const all = Array.from(this.marks.values());
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const mark = all[i];
      if (mark && mark.hitBody(x, y)) return mark;
    }
    return null;
  }

  //─────────────────────────────────────────────────────────
  // Internals
  //─────────────────────────────────────────────────────────

  private attach(mark: DrawingMark): void {
    // Concrete marks (BaseMark subclasses) also implement ISeriesPrimitive.
    this.series.attachPrimitive(mark as unknown as ISeriesPrimitive<Time>);
    this.marks.set(mark.id, mark);
  }

  private detach(mark: DrawingMark): void {
    this.series.detachPrimitive(mark as unknown as ISeriesPrimitive<Time>);
    this.marks.delete(mark.id);
  }

  private disablePan(): void {
    this.chart.applyOptions({ handleScroll: false, handleScale: false });
  }

  private enablePan(): void {
    this.chart.applyOptions({ handleScroll: true, handleScale: true });
  }

  private notifyOverlay(): void {
    const active =
      this.activeTool !== null ||
      this.selectedId !== null ||
      this.mode !== 'idle';
    this.callbacks.onOverlayActiveChange?.(active);
  }

  private emitMarks(): void {
    this.callbacks.onMarksChange?.(this.getSnapshots());
  }
}
