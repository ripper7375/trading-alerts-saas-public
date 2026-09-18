'use client';

/**
 * Toolbar — drawing tool palette. Lets the user arm a tool, return to the
 * cursor (select) mode, and delete the selected mark.
 *
 * @module components/charts/drawing/Toolbar
 */

import {
  Bell,
  ListChecks,
  Minus,
  MousePointer2,
  MoveDiagonal,
  Palette,
  Ruler,
  Spline,
  Trash2,
  TrendingUp,
  Type,
} from 'lucide-react';
import type { JSX } from 'react';

import { useLocale } from '@/lib/context/locale-context';
import { DRAWABLE_TOOLS, TOOL_DEFINITIONS } from './tools';
import type { DrawingType } from './types';

/*
 * Pixel sizes of the markup below, used to decide the layout. They must stay
 * in step with the classes: h-9 buttons, gap-1, p-1 + 1px border, and a
 * separator of h-px + my-1.
 */
const BUTTON_PX = 36;
const GAP_PX = 4;
const FRAME_PX = 10;
const SEPARATOR_PX = 9;
/** The toolbar sits at top-2 and keeps the same 8px clear at the bottom. */
const INSET_PX = 16;

/** Select + the drawable tools. */
const TOOL_COUNT = 1 + DRAWABLE_TOOLS.length;
/** Edit style, alerts panel, add alert, delete. */
const ACTION_COUNT = 4;

export type ToolbarLayout =
  | { mode: 'stacked' }
  | { mode: 'split' }
  | { mode: 'grid'; rows: number };

const columnPx = (buttons: number): number =>
  buttons * BUTTON_PX + (buttons - 1) * GAP_PX;

/**
 * How the toolbar fits a chart of `chartHeight` px. One column needs ~460px,
 * taller than a stacked M5/M15 pane on most screens, where it ran off the
 * bottom of the chart. So: one column when it fits; tools and actions side by
 * side when that fits; otherwise every button in a grid that wraps into as
 * many columns as it needs.
 */
export function toolbarLayout(chartHeight?: number): ToolbarLayout {
  if (chartHeight === undefined) return { mode: 'stacked' };
  const available = chartHeight - INSET_PX;

  const stacked =
    columnPx(TOOL_COUNT + ACTION_COUNT) + GAP_PX + SEPARATOR_PX + FRAME_PX;
  if (available >= stacked) return { mode: 'stacked' };

  const split = columnPx(Math.max(TOOL_COUNT, ACTION_COUNT)) + FRAME_PX;
  if (available >= split) return { mode: 'split' };

  const rows = Math.floor(
    (available - FRAME_PX + GAP_PX) / (BUTTON_PX + GAP_PX)
  );
  return { mode: 'grid', rows: Math.max(1, rows) };
}

interface ToolbarProps {
  /** Height of the chart the toolbar sits on, to fit the toolbar inside it. */
  chartHeight?: number;
  activeTool: DrawingType | null;
  hasSelection: boolean;
  canAddAlert: boolean;
  /** V8: line alerts are PRO-exclusive; false shows a PRO hint on the bell. */
  isPro?: boolean;
  alertsOpen: boolean;
  onSelectTool: (tool: DrawingType | null) => void;
  onDelete: () => void;
  onAddAlert: () => void;
  onEditStyle: () => void;
  onToggleAlerts: () => void;
}

const TOOL_ICONS: Partial<Record<DrawingType, JSX.Element>> = {
  HLINE: <Minus className="h-4 w-4" />,
  TRENDLINE: <TrendingUp className="h-4 w-4" />,
  CHANNEL: <Spline className="h-4 w-4" />,
  FIB_RETRACE: <Ruler className="h-4 w-4" />,
  FIB_EXT: <MoveDiagonal className="h-4 w-4" />,
  TEXT: <Type className="h-4 w-4" />,
};

/**
 * `TOOL_DEFINITIONS[tool].label` is plain English used by the DrawingEngine's
 * own registry, not translated -- Toolbar is the only place that renders it
 * to a viewer (confirmed via search), so the translation lives here rather
 * than in the tool-registry module, which has no locale-hook context.
 */
const TOOL_LABEL_KEY: Partial<Record<DrawingType, string>> = {
  HLINE: 'charts.drawing.tool_hline',
  TRENDLINE: 'charts.drawing.tool_trendline',
  CHANNEL: 'charts.drawing.tool_channel',
  FIB_RETRACE: 'charts.drawing.tool_fib_retrace',
  FIB_EXT: 'charts.drawing.tool_fib_ext',
  TEXT: 'charts.drawing.tool_text',
};

export function Toolbar({
  chartHeight,
  activeTool,
  hasSelection,
  canAddAlert,
  isPro = true,
  alertsOpen,
  onSelectTool,
  onDelete,
  onAddAlert,
  onEditStyle,
  onToggleAlerts,
}: ToolbarProps): JSX.Element {
  const { t } = useLocale();
  const buttonBase =
    'flex h-9 w-9 items-center justify-center rounded-md border transition-colors';
  const idle =
    'border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#d1d4dc] dark:hover:bg-[#2a2e39]';
  const active =
    'border-[#2962FF] bg-[#2962FF]/20 text-blue-700 dark:text-white';
  const frame =
    'rounded-lg border border-slate-200 bg-white/95 p-1 shadow-lg dark:border-[#2a2e39] dark:bg-[#1e222d]/95';
  /**
   * Transparent hover buffer, and the reason the toolbar is wrapped at all.
   *
   * lightweight-charts paints its dashed crosshair whenever the pointer is
   * over the chart element, and it clears it on mouseleave. The toolbar is a
   * sibling of that element, so hovering a tool button already clears the
   * crosshair -- but the gutter around the toolbar was still chart surface,
   * so reaching for a tool flashed a full-height dashed line up the toolbar's
   * own column. Padding is part of an element's hit area, so this extends
   * "not chart surface" a little past the frame without moving it: the
   * left/top padding is the offset the frame used to carry itself.
   */
  const hoverBuffer = 'absolute left-0 top-0 z-10 pb-4 pl-2 pr-4 pt-2';
  const separator = 'bg-slate-200 dark:bg-[#2a2e39]';

  const toolButtons = (
    <>
      <button
        type="button"
        aria-label={t('charts.drawing.select_cursor', 'Select / cursor')}
        title={t('charts.drawing.select_esc', 'Select (Esc)')}
        className={`${buttonBase} ${activeTool === null ? active : idle}`}
        onClick={() => onSelectTool(null)}
      >
        <MousePointer2 className="h-4 w-4" />
      </button>

      {DRAWABLE_TOOLS.map((tool) => {
        const def = TOOL_DEFINITIONS[tool];
        if (!def) return null;
        const labelKey = TOOL_LABEL_KEY[tool];
        const label = labelKey ? t(labelKey, def.label) : def.label;
        return (
          <button
            key={tool}
            type="button"
            aria-label={label}
            title={label}
            className={`${buttonBase} ${activeTool === tool ? active : idle}`}
            onClick={() => onSelectTool(tool)}
          >
            {TOOL_ICONS[tool] ?? <Minus className="h-4 w-4" />}
          </button>
        );
      })}
    </>
  );

  const actionButtons = (
    <>
      <button
        type="button"
        aria-label={t('charts.drawing.edit_style', 'Edit style')}
        title={t('charts.drawing.edit_style', 'Edit style')}
        disabled={!hasSelection}
        className={`${buttonBase} ${
          hasSelection
            ? 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#d1d4dc] dark:hover:bg-[#2a2e39]'
            : 'cursor-not-allowed border-transparent text-slate-300 dark:text-[#4a4e59]'
        }`}
        onClick={onEditStyle}
      >
        <Palette className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label={t(
          'charts.drawing.toggle_alerts_panel',
          'Toggle alerts panel'
        )}
        title={t('charts.drawing.alerts', 'Alerts')}
        className={`${buttonBase} ${alertsOpen ? active : idle}`}
        onClick={onToggleAlerts}
      >
        <ListChecks className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label={t('charts.drawing.add_price_alert', 'Add price alert')}
        title={
          isPro
            ? t('charts.drawing.add_price_alert', 'Add price alert')
            : t(
                'charts.drawing.line_alerts_pro_hint',
                'Line alerts are a PRO feature — upgrade to unlock'
              )
        }
        disabled={!canAddAlert || !isPro}
        className={`${buttonBase} relative ${
          canAddAlert && isPro
            ? 'border-transparent text-[#26a69a] hover:bg-slate-100 dark:hover:bg-[#2a2e39]'
            : 'cursor-not-allowed border-transparent text-slate-300 dark:text-[#4a4e59]'
        }`}
        onClick={onAddAlert}
      >
        <Bell className="h-4 w-4" />
        {!isPro && (
          <span className="absolute -right-1 -top-1 rounded bg-[#2962FF] px-0.5 text-[8px] font-bold leading-3 text-white">
            PRO
          </span>
        )}
      </button>

      <button
        type="button"
        aria-label={t('charts.drawing.delete_selected', 'Delete selected')}
        title={t('charts.drawing.delete_del', 'Delete (Del)')}
        disabled={!hasSelection}
        className={`${buttonBase} ${
          hasSelection
            ? 'border-transparent text-[#ef5350] hover:bg-slate-100 dark:hover:bg-[#2a2e39]'
            : 'cursor-not-allowed border-transparent text-slate-300 dark:text-[#4a4e59]'
        }`}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );

  const layout = toolbarLayout(chartHeight);

  if (layout.mode === 'split') {
    return (
      <div className={hoverBuffer}>
        <div data-layout="split" className={`${frame} flex flex-row gap-1`}>
          <div className="flex flex-col gap-1">{toolButtons}</div>
          <div className={`mx-1 w-px self-stretch ${separator}`} />
          <div className="flex flex-col gap-1">{actionButtons}</div>
        </div>
      </div>
    );
  }

  if (layout.mode === 'grid') {
    return (
      <div className={hoverBuffer}>
        <div
          data-layout="grid"
          className={`${frame} grid grid-flow-col gap-1`}
          style={{ gridTemplateRows: `repeat(${layout.rows}, ${BUTTON_PX}px)` }}
        >
          {toolButtons}
          {actionButtons}
        </div>
      </div>
    );
  }

  return (
    <div className={hoverBuffer}>
      <div data-layout="stacked" className={`${frame} flex flex-col gap-1`}>
        {toolButtons}
        <div className={`my-1 h-px ${separator}`} />
        {actionButtons}
      </div>
    </div>
  );
}
