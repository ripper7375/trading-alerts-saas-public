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

import { AlertDialog, type LineAlertValues } from './AlertDialog';
import { DrawingEngine } from './engine/DrawingEngine';
import { PointerController } from './engine/PointerController';
import {
  createDrawingPersistence,
  type DrawingPersistence,
} from './persistence';
import { Toolbar } from './Toolbar';
import type { DrawingType, MarkSnapshot } from './types';

interface DrawingLayerProps {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  symbol: string;
  timeframe: string;
  /** Optional: receive snapshots when marks change (in addition to autosave). */
  onMarksChange?: (snapshots: MarkSnapshot[]) => void;
}

export function DrawingLayer({
  chart,
  series,
  symbol,
  timeframe,
  onMarksChange,
}: DrawingLayerProps): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);
  const persistenceRef = useRef<DrawingPersistence | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [canAddAlert, setCanAddAlert] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLevels, setAlertLevels] = useState<
    { id: string; label: string }[]
  >([]);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const alertDrawingLocalId = useRef<string | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    let cancelled = false;
    const persistence = createDrawingPersistence(symbol, timeframe);
    persistenceRef.current = persistence;

    const engine = new DrawingEngine(chart, series, {
      onOverlayActiveChange: setOverlayActive,
      onSelectionChange: (id) => {
        setHasSelection(id !== null);
        setCanAddAlert(
          id !== null && engine.getSelectedAlertLevels().length > 0
        );
      },
      onActiveToolChange: setActiveTool,
      onMarksChange: (snaps) => {
        void persistence.sync(snaps); // autosave (create/update/delete diff)
        onMarksChange?.(snaps);
      },
    });
    engineRef.current = engine;

    // Load saved drawings for this symbol/timeframe.
    void persistence.load().then((snaps) => {
      if (!cancelled && snaps.length > 0) engine.loadMarks(snaps);
    });

    const pointer = new PointerController(overlay, engine);

    const clickHandler = (param: MouseEventParams<Time>): void => {
      if (!param.point) return;
      engine.handleSelectAt(param.point.x, param.point.y);
    };
    chart.subscribeClick(clickHandler);

    return (): void => {
      cancelled = true;
      chart.unsubscribeClick(clickHandler);
      pointer.destroy();
      engine.destroy();
      engineRef.current = null;
      persistenceRef.current = null;
    };
  }, [chart, series, symbol, timeframe, onMarksChange]);

  const handleSelectTool = (tool: DrawingType | null): void => {
    setActiveTool(tool);
    engineRef.current?.setActiveTool(tool);
  };

  const handleDelete = (): void => {
    engineRef.current?.deleteSelected();
  };

  const handleAddAlert = (): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const levels = engine.getSelectedAlertLevels();
    if (levels.length === 0) return;
    alertDrawingLocalId.current = engine.getSelectedId();
    setAlertLevels(levels);
    setAlertError(null);
    setAlertOpen(true);
  };

  const handleAlertSubmit = async (values: LineAlertValues): Promise<void> => {
    const persistence = persistenceRef.current;
    const localId = alertDrawingLocalId.current;
    if (!persistence || !localId) return;

    setAlertSubmitting(true);
    setAlertError(null);
    try {
      const drawingId = await persistence.resolveServerId(localId);
      if (!drawingId) {
        setAlertError('Drawing is still saving — try again in a moment.');
        return;
      }
      const res = await fetch('/api/alerts/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingId, ...values }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setAlertError(data.message ?? data.error ?? 'Failed to create alert.');
        return;
      }
      setAlertOpen(false);
    } catch {
      setAlertError('Network error — please try again.');
    } finally {
      setAlertSubmitting(false);
    }
  };

  const cursor = activeTool !== null ? 'crosshair' : 'default';

  return (
    <>
      <Toolbar
        activeTool={activeTool}
        hasSelection={hasSelection}
        canAddAlert={canAddAlert}
        onSelectTool={handleSelectTool}
        onDelete={handleDelete}
        onAddAlert={handleAddAlert}
      />
      <div
        ref={overlayRef}
        className="absolute inset-0"
        style={{
          pointerEvents: overlayActive ? 'auto' : 'none',
          cursor,
        }}
      />
      <AlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        levels={alertLevels}
        submitting={alertSubmitting}
        error={alertError}
        onSubmit={(values) => {
          void handleAlertSubmit(values);
        }}
      />
    </>
  );
}
