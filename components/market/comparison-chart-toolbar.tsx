'use client';

/**
 * ComparisonChartToolbar -- a drawing-tool palette for the public XAUX vs
 * USDX comparison chart. A deliberately scoped-down sibling of
 * components/charts/drawing/Toolbar.tsx (the terminal's own toolbar), not a
 * modification of it: this page needs only the 6 drawing tools + style +
 * delete, with no line-touch alerts (no Bell/"Add alert" button, no Alerts
 * panel toggle) and no PRO/tier concept at all, since this page is public
 * and unauthenticated. Kept separate from the terminal's Toolbar so that
 * component -- already covering the authenticated, alert-attaching flow --
 * never has to grow a "hide the alert buttons" branch for a page it has
 * nothing to do with.
 *
 * @module components/market/comparison-chart-toolbar
 */

import {
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

import { TOOL_LABEL_KEY } from '@/components/charts/drawing/Toolbar';
import { useLocale } from '@/lib/context/locale-context';

import {
  DRAWABLE_TOOLS,
  TOOL_DEFINITIONS,
} from '@/components/charts/drawing/tools';
import type { DrawingType } from '@/components/charts/drawing/types';

interface ComparisonChartToolbarProps {
  activeTool: DrawingType | null;
  hasSelection: boolean;
  onSelectTool: (tool: DrawingType | null) => void;
  onDelete: () => void;
  onEditStyle: () => void;
}

const TOOL_ICONS: Partial<Record<DrawingType, JSX.Element>> = {
  HLINE: <Minus className="h-4 w-4" />,
  TRENDLINE: <TrendingUp className="h-4 w-4" />,
  CHANNEL: <Spline className="h-4 w-4" />,
  FIB_RETRACE: <Ruler className="h-4 w-4" />,
  FIB_EXT: <MoveDiagonal className="h-4 w-4" />,
  TEXT: <Type className="h-4 w-4" />,
};

export function ComparisonChartToolbar({
  activeTool,
  hasSelection,
  onSelectTool,
  onDelete,
  onEditStyle,
}: ComparisonChartToolbarProps): JSX.Element {
  const { t } = useLocale();
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

      <div className="my-1 h-px bg-slate-200 dark:bg-[#2a2e39]" />

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
    </div>
  );
}
