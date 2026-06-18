'use client';

/**
 * DrawingLayer — wires the DrawingEngine to a chart + series, renders the
 * pointer-capture overlay and the Toolbar.
 *
 * Mounting contract: render this INSIDE the same `position: relative` wrapper
 * that holds the chart container, after the chart + series exist. The overlay
 * fills that wrapper (`inset-0`).
 *
 * Overlay capture: the overlay only captures pointer events while a tool is
 * armed or a mark is selected/being edited; otherwise it is click-through so the
 * chart keeps its normal pan/zoom. Idle selection is handled via the chart's
 * `subscribeClick`.
 *
 * @module components/charts/drawing/DrawingLayer
 */

import type {
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  Time,
} from 'lightweight-charts';
import { useEffect, useRef, useState, type JSX } from 'react';

import { DrawingEngine } from './engine/DrawingEngine';
import { PointerController } from './engine/PointerController';
import { Toolbar } from './Toolbar';
import type { DrawingType, MarkSnapshot } from './types';

interface DrawingLayerProps {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  /** Optional: receive snapshots when marks change (persistence hook). */
  onMarksChange?: (snapshots: MarkSnapshot[]) => void;
}

export function DrawingLayer({
  chart,
  series,
  onMarksChange,
}: DrawingLayerProps): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const engine = new DrawingEngine(chart, series, {
      onOverlayActiveChange: setOverlayActive,
      onSelectionChange: (id) => setHasSelection(id !== null),
      onActiveToolChange: setActiveTool,
      onMarksChange,
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
  }, [chart, series, onMarksChange]);

  const handleSelectTool = (tool: DrawingType | null): void => {
    setActiveTool(tool);
    engineRef.current?.setActiveTool(tool);
  };

  const handleDelete = (): void => {
    engineRef.current?.deleteSelected();
  };

  const cursor = activeTool !== null ? 'crosshair' : 'default';

  return (
    <>
      <Toolbar
        activeTool={activeTool}
        hasSelection={hasSelection}
        onSelectTool={handleSelectTool}
        onDelete={handleDelete}
      />
      <div
        ref={overlayRef}
        className="absolute inset-0"
        style={{
          pointerEvents: overlayActive ? 'auto' : 'none',
          cursor,
        }}
      />
    </>
  );
}
