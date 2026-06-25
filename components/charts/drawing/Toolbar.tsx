'use client';

/**
 * Toolbar — drawing tool palette. Lets the user arm a tool, return to the
 * cursor (select) mode, and delete the selected mark.
 *
 * @module components/charts/drawing/Toolbar
 */

import {
  Minus,
  MousePointer2,
  MoveDiagonal,
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
  onSelectTool: (tool: DrawingType | null) => void;
  onDelete: () => void;
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
  onSelectTool,
  onDelete,
}: ToolbarProps): JSX.Element {
  const buttonBase =
    'flex h-9 w-9 items-center justify-center rounded-md border transition-colors';
  const idle = 'border-transparent text-[#d1d4dc] hover:bg-[#2a2e39]';
  const active = 'border-[#2962FF] bg-[#2962FF]/20 text-white';

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-lg border border-[#2a2e39] bg-[#1e222d]/95 p-1 shadow-lg">
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

      <div className="my-1 h-px bg-[#2a2e39]" />

      <button
        type="button"
        aria-label="Delete selected"
        title="Delete (Del)"
        disabled={!hasSelection}
        className={`${buttonBase} ${
          hasSelection
            ? 'border-transparent text-[#ef5350] hover:bg-[#2a2e39]'
            : 'cursor-not-allowed border-transparent text-[#4a4e59]'
        }`}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
