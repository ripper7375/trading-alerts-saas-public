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

import { DRAWABLE_TOOLS, TOOL_DEFINITIONS } from './tools';
import type { DrawingType } from './types';

interface ToolbarProps {
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

export function Toolbar({
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
  const buttonBase =
    'flex h-9 w-9 items-center justify-center rounded-md border transition-colors';
  const idle =
    'border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#d1d4dc] dark:hover:bg-[#2a2e39]';
  const active =
    'border-[#2962FF] bg-[#2962FF]/20 text-blue-700 dark:text-white';

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-lg dark:border-[#2a2e39] dark:bg-[#1e222d]/95">
      <button
        type="button"
        aria-label="Select / cursor"
        title="Select (Esc)"
        className={`${buttonBase} ${activeTool === null ? active : idle}`}
        onClick={() => onSelectTool(null)}
      >
        <MousePointer2 className="h-4 w-4" />
      </button>

      {DRAWABLE_TOOLS.map((tool) => {
        const def = TOOL_DEFINITIONS[tool];
        if (!def) return null;
        return (
          <button
            key={tool}
            type="button"
            aria-label={def.label}
            title={def.label}
            className={`${buttonBase} ${activeTool === tool ? active : idle}`}
            onClick={() => onSelectTool(tool)}
          >
            {TOOL_ICONS[tool] ?? <Minus className="h-4 w-4" />}
          </button>
        );
      })}

      <div className="my-1 h-px bg-slate-200 dark:bg-[#2a2e39]" />

      <button
        type="button"
        aria-label="Edit style"
        title="Edit style"
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
        aria-label="Toggle alerts panel"
        title="Alerts"
        className={`${buttonBase} ${alertsOpen ? active : idle}`}
        onClick={onToggleAlerts}
      >
        <ListChecks className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="Add price alert"
        title={
          isPro
            ? 'Add price alert'
            : 'Line alerts are a PRO feature — upgrade to unlock'
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
        aria-label="Delete selected"
        title="Delete (Del)"
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
    </div>
  );
}
