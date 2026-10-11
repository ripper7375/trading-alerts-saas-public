'use client';

/**
 * MtfTopBar — Unified top toolbar above the dual stacked MTF charts.
 *
 * Implements Proposed Design components:
 * - Component 7: Unified horizontal drawing toolbar (relocated from vertical chart strips)
 * - Component 8: Chart display mode toggles (Bar vs Candlestick)
 * - Component 9: M5 Overlay toggle button (relocated from chart divider)
 *
 * @module components/charts/mtf/MtfTopBar
 */

import {
  MousePointer2,
  Minus,
  TrendingUp,
  Spline,
  MoveDiagonal,
  Ruler,
  Type,
  Trash2,
  BarChart2,
  CandlestickChart,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type { DrawingType } from '@/components/charts/drawing/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MtfToggle } from './MtfToggle';

export const INDICATOR_ITEMS = [
  { id: 'EDT', label: 'EDT', fullName: 'Equal Distance Trendline' },
  { id: 'SSA', label: 'SSA', fullName: 'Singular Spectrum Analysis' },
  { id: 'FT', label: 'FT', fullName: 'Fractal' },
  { id: 'SR', label: 'SR', fullName: 'Support and Resistant' },
  { id: 'ZZ', label: 'ZZ', fullName: 'Zigzag' },
] as const;

export type IndicatorId = (typeof INDICATOR_ITEMS)[number]['id'];

export interface MtfTopBarProps {
  activeTool: DrawingType | null;
  onSelectTool: (tool: DrawingType | null) => void;
  onDeleteSelected?: () => void;
  priceMode: 'CANDLE' | 'BAR' | 'HIDE';
  onPriceModeChange: (mode: 'CANDLE' | 'BAR' | 'HIDE') => void;
  isPro: boolean;
  mtfEnabled: boolean;
  mtfLoading?: boolean;
  onToggleMtf: (enabled: boolean) => void;
  /** Active indicators (multi-select) */
  activeIndicators?: IndicatorId[];
  onToggleIndicator?: (id: IndicatorId) => void;
  /** Timeframe timeline sync state between M15 and M5 */
  isTfLocked?: boolean;
  onToggleTfLock?: () => void;
}

interface ToolItem {
  id: DrawingType | null;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

const TOOLS: ToolItem[] = [
  { id: null, icon: MousePointer2, label: 'Select / Cursor' },
  { id: 'HLINE', icon: Minus, label: 'Horizontal Line' },
  { id: 'TRENDLINE', icon: TrendingUp, label: 'Trendline' },
  { id: 'CHANNEL', icon: Spline, label: 'Parallel Channel' },
  { id: 'FIB_RETRACE', icon: Ruler, label: 'Fib Retracement' },
  { id: 'FIB_EXT', icon: MoveDiagonal, label: 'Fib Extension' },
  { id: 'TEXT', icon: Type, label: 'Text Note' },
];

export function MtfTopBar({
  activeTool,
  onSelectTool,
  onDeleteSelected,
  priceMode,
  onPriceModeChange,
  isPro,
  mtfEnabled,
  mtfLoading = false,
  onToggleMtf,
  activeIndicators = [],
  onToggleIndicator,
  isTfLocked = false,
  onToggleTfLock,
}: MtfTopBarProps): React.JSX.Element {
  return (
    <div className="border-border/80 bg-card/60 backdrop-blur-xs scrollbar-none z-10 flex h-10 shrink-0 items-center justify-between gap-1.5 overflow-x-auto overflow-y-hidden border-b px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Component 7: Unified Horizontal Drawing Toolbar */}
      <div className="border-border/70 bg-background/90 shadow-xs flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <Button
              key={tool.id ?? 'select'}
              variant="ghost"
              size="icon"
              className={cn(
                'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
                isActive &&
                  'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
              )}
              onClick={() => onSelectTool(tool.id)}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          );
        })}
        {onDeleteSelected && (
          <>
            <div className="bg-border/60 mx-0.5 h-4 w-px" />
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/15 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-destructive"
              onClick={onDeleteSelected}
              title="Delete selected mark"
              aria-label="Delete selected mark"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Indicators (EDT, SSA, FT, SR, ZZ) + Padlock TF Timeline Sync */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Indicators Multi-select Toggle Group */}
        <div className="border-border/70 bg-background/90 shadow-xs flex items-center gap-0.5 rounded-lg border p-0.5">
          {INDICATOR_ITEMS.map((ind) => {
            const isActive = activeIndicators.includes(ind.id);
            return (
              <Button
                key={ind.id}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 rounded-md px-1.5 font-mono text-[10.5px] font-semibold transition-all',
                  isActive
                    ? 'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
                    : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onToggleIndicator?.(ind.id)}
                title={`${ind.id} : ${ind.fullName}`}
                aria-label={ind.fullName}
                aria-pressed={isActive}
              >
                {ind.label}
              </Button>
            );
          })}
        </div>

        {/* Padlock TF Button: Sync timeline of M15 and M5 */}
        <div className="border-border/70 bg-background/90 shadow-xs flex items-center rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1 rounded-md px-1.5 font-mono text-[11px] transition-all',
              isTfLocked
                ? 'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
                : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
            )}
            onClick={onToggleTfLock}
            title={
              isTfLocked
                ? 'Timeline Sync Active (M15 & M5 synced) - Click to unlock'
                : 'Sync Timeline (M15 & M5) - Click to lock'
            }
            aria-label="Toggle Timeframe Timeline Sync"
            aria-pressed={isTfLocked}
          >
            {isTfLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
            <span className="text-[10.5px] font-bold">TF</span>
          </Button>
        </div>
      </div>

      {/* Right controls: Component 8 (View Mode) + Component 9 (M5 Overlay) */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Component 8: Price Display Mode (Bar vs Candle) */}
        <div className="border-border/70 bg-background/90 shadow-xs flex items-center rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
              priceMode === 'BAR' &&
                'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
            )}
            onClick={() => onPriceModeChange('BAR')}
            title="Price Bar Mode"
            aria-label="Price Bar Mode"
          >
            <BarChart2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
              priceMode === 'CANDLE' &&
                'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
            )}
            onClick={() => onPriceModeChange('CANDLE')}
            title="Price Candle Mode"
            aria-label="Price Candle Mode"
          >
            <CandlestickChart className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hover:bg-muted/60 h-7 w-7 rounded-md text-muted-foreground transition-all hover:text-foreground',
              priceMode === 'HIDE' &&
                'shadow-xs border border-[#2962FF] bg-[#2962FF]/20 font-bold text-[#2962FF] dark:text-blue-400'
            )}
            onClick={() => onPriceModeChange('HIDE')}
            title="Hide Price Mode"
            aria-label="Hide Price Mode"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Component 9: M5 Overlay Button */}
        <MtfToggle
          isPro={isPro}
          enabled={mtfEnabled}
          isLoading={mtfLoading}
          onToggle={onToggleMtf}
        />
      </div>
    </div>
  );
}
