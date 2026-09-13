'use client';

/**
 * ComparisonDrawingLayer -- wires the terminal's own DrawingEngine to the
 * public XAUX vs USDX comparison chart.
 *
 * Deliberately a scoped-down sibling of components/charts/drawing/
 * DrawingLayer.tsx, not a reuse of it: that component is hardwired to an
 * authenticated candlestick chart (`useSession()` for PRO tier gating,
 * DB-backed persistence via `/api/drawings`, and the full "attach an alert
 * to this line" flow via AlertDialog/AlertsPanel). This page is public and
 * unauthenticated, plots a Line series rather than a Candlestick one, and
 * per its own requirement needs ONLY the 6 drawing tools -- no alert
 * creation on drawn lines, and (since there is no signed-in user to own a
 * row) no server-side persistence: drawings live only in the DrawingEngine's
 * in-memory state for as long as this chart stays mounted (surviving an
 * M5/M15 timeframe toggle, since that only swaps the chart's data, not the
 * chart/series instances themselves), and are lost on a page reload.
 *
 * The engine, pointer controller, tool registry, geometry, marks, and style
 * editor underneath are the EXACT SAME modules the terminal uses --
 * `DrawingEngine`/`coords.ts`/`PointerController` are already series-type-
 * and auth-agnostic (verified by reading them directly before building this
 * file), so nothing there needed forking, only this wiring layer and the
 * toolbar (see comparison-chart-toolbar.tsx's own doc comment for why that
 * one is a separate file too).
 *
 * Mounting contract: same as DrawingLayer.tsx -- render this INSIDE the same
 * `position: relative` wrapper that holds the chart container, after the
 * chart + series exist.
 *
 * @module components/market/comparison-drawing-layer
 */

import type {
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  SeriesType,
  Time,
} from 'lightweight-charts';
import { useEffect, useRef, useState, type JSX } from 'react';

import { DrawingEngine } from '@/components/charts/drawing/engine/DrawingEngine';
import { PointerController } from '@/components/charts/drawing/engine/PointerController';
import { StyleEditor } from '@/components/charts/drawing/StyleEditor';
import type {
  DrawingStyle,
  DrawingType,
} from '@/components/charts/drawing/types';

import { ComparisonChartToolbar } from './comparison-chart-toolbar';

interface ComparisonDrawingLayerProps {
  chart: IChartApi;
  series: ISeriesApi<SeriesType, Time>;
}

export function ComparisonDrawingLayer({
  chart,
  series,
}: ComparisonDrawingLayerProps): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);

  const [styleOpen, setStyleOpen] = useState(false);
  const [styleType, setStyleType] = useState<DrawingType | null>(null);
  const [styleValue, setStyleValue] = useState<DrawingStyle | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const engine = new DrawingEngine(chart, series, {
      onOverlayActiveChange: setOverlayActive,
      onSelectionChange: (id) => setHasSelection(id !== null),
      onActiveToolChange: setActiveTool,
    });
    engineRef.current = engine;

    const pointer = new PointerController(overlay, engine);

    const clickHandler = (param: MouseEventParams<Time>): void => {
      if (!param.point) return;
      engine.handleSelectAt(param.point.x, param.point.y);
    };
    chart.subscribeClick(clickHandler);

    return (): void => {
      chart.unsubscribeClick(clickHandler);
      pointer.destroy();
      engine.destroy();
      engineRef.current = null;
    };
  }, [chart, series]);

  const handleSelectTool = (tool: DrawingType | null): void => {
    setActiveTool(tool);
    engineRef.current?.setActiveTool(tool);
  };

  const handleDelete = (): void => {
    engineRef.current?.deleteSelected();
  };

  const handleEditStyle = (): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const style = engine.getSelectedStyle();
    if (!style) return;
    setStyleType(engine.getSelectedType());
    setStyleValue(style);
    setStyleOpen(true);
  };

  const handleStyleChange = (patch: Partial<DrawingStyle>): void => {
    engineRef.current?.updateSelectedStyle(patch);
    setStyleValue((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const cursor = activeTool !== null ? 'crosshair' : 'default';

  return (
    <>
      <ComparisonChartToolbar
        activeTool={activeTool}
        hasSelection={hasSelection}
        onSelectTool={handleSelectTool}
        onDelete={handleDelete}
        onEditStyle={handleEditStyle}
      />
      <div
        ref={overlayRef}
        className="absolute inset-0"
        style={{
          pointerEvents: overlayActive ? 'auto' : 'none',
          cursor,
        }}
      />
      <StyleEditor
        open={styleOpen}
        onOpenChange={setStyleOpen}
        type={styleType}
        style={styleValue}
        onChange={handleStyleChange}
      />
    </>
  );
}
